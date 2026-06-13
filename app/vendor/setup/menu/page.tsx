"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseStorage, getFirebaseApp } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness } from "@/lib/vendorReadiness";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable?: boolean;
}

interface DraftItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  selected: boolean;
}

type PhotoStep =
  | "idle"         // waiting to upload
  | "uploading"    // uploading to Storage
  | "processing"   // CF is running Gemini Vision
  | "review"       // draftItems ready
  | "publishing";  // writing to menu subcollection

// ─── Page ─────────────────────────────────────────────────────────────────────

function MenuSetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWizard = searchParams.get("wizard") === "1";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Existing menu
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Manual add form
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState<MenuItem>({ name: "", description: "", price: 0, category: "" });
  const [addingManual, setAddingManual] = useState(false);

  // AI photo import
  const [photoStep, setPhotoStep] = useState<PhotoStep>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load auth + existing menu
  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }

      // Load existing menu items
      const menuSnap = await getDocs(collection(db, "restaurants", rid, "menu"));
      const items: MenuItem[] = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) }));
      setMenuItems(items);
      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  // Listen to menuImportJob for AI parsing result
  useEffect(() => {
    if (!jobId || !restaurantId) return;
    const db = getFirebaseDb();

    let settled = false;

    // Safety net: ONLY for the case where the job silently dies and never writes
    // a terminal status. The server function (onMenuImportJobUpdated) is allowed
    // up to 540s, so we wait past that (570s) — a legit slow/large menu finishes
    // well within the server limit and is unaffected. This only ever trips when
    // the server is truly dead. (If a late result still arrives, the listener
    // below stays attached and recovers into the review screen.)
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setAiError(
        "La IA no respondió a tiempo. Puedes reintentar con otra foto o agregar los platillos manualmente."
      );
      setPhotoStep("idle");
    }, 570_000);

    const unsub = onSnapshot(
      doc(db, "restaurants", restaurantId, "menuImportJobs", jobId),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        const status = data.status as string;
        if (status === "needs_review") {
          settled = true;
          clearTimeout(timeoutId);
          // Load draftItems subcollection
          getDocs(collection(db, "restaurants", restaurantId, "menuImportJobs", jobId, "draftItems")).then((s) => {
            setDraftItems(
              s.docs.map((d) => ({
                id: d.id,
                selected: true,
                name: d.data().name ?? "",
                description: d.data().description ?? "",
                price: d.data().price ?? 0,
                category: d.data().category ?? "",
              }))
            );
            setPhotoStep("review");
          });
        } else if (status === "failed" || status === "error") {
          settled = true;
          clearTimeout(timeoutId);
          setAiError("La IA no pudo leer el menú. Intenta con otra foto o agrega los platillos manualmente.");
          setPhotoStep("idle");
        }
      },
      () => {
        // Snapshot listener error (permissions/network) — fail gracefully
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAiError("Se perdió la conexión al leer el menú. Reintenta o agrega los platillos manualmente.");
        setPhotoStep("idle");
      }
    );
    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [jobId, restaurantId]);

  // Handle photo upload
  async function handlePhotoUpload(file: File) {
    if (!restaurantId) return;
    setAiError(null);
    setPhotoStep("uploading");
    try {
      const db = getFirebaseDb();
      // Step 1: create job with empty photoPaths (CF uses onDocumentUpdated,
      // so it needs an UPDATE where photoPaths goes from [] to [path])
      const jobRef = await addDoc(collection(db, "restaurants", restaurantId, "menuImportJobs"), {
        photoPaths: [],
        status: "processing",
        createdAt: serverTimestamp(),
      });
      setJobId(jobRef.id);

      // Step 2: upload image
      const storage = getFirebaseStorage();
      const storageRef = ref(storage, `menuImports/${restaurantId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);

      setPhotoStep("processing");
      // Step 3: update photoPaths — this triggers the CF
      await updateDoc(jobRef, {
        photoPaths: [storageRef.fullPath],
      });
    } catch (e) {
      console.error(e);
      setAiError("No se pudo subir la foto. Intenta de nuevo.");
      setPhotoStep("idle");
    }
  }

  // Add single manual item
  async function handleAddManual() {
    if (!restaurantId || !manualForm.name.trim()) return;
    setAddingManual(true);
    try {
      const db = getFirebaseDb();
      const newItem: MenuItem = {
        name: manualForm.name.trim(),
        description: manualForm.description.trim(),
        price: Number(manualForm.price) || 0,
        category: manualForm.category.trim(),
        isAvailable: true,
      };
      const ref2 = await addDoc(collection(db, "restaurants", restaurantId, "menu"), {
        ...newItem,
        createdAt: serverTimestamp(),
      });
      setMenuItems((prev) => [...prev, { ...newItem, id: ref2.id }]);
      setManualForm({ name: "", description: "", price: 0, category: "" });
      setShowManual(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingManual(false);
    }
  }

  // Publish selected draft items
  async function handlePublishDrafts() {
    if (!restaurantId) return;
    const selected = draftItems.filter((d) => d.selected);
    if (selected.length === 0) return;
    setPhotoStep("publishing");
    try {
      const db = getFirebaseDb();
      const batch = writeBatch(db);
      for (const item of selected) {
        const newRef = doc(collection(db, "restaurants", restaurantId, "menu"));
        batch.set(newRef, {
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          isAvailable: true,
          createdAt: serverTimestamp(),
          importedFromJob: jobId,
        });
      }
      await batch.commit();

      // Fire reward draft generation in the background so the draft is ready
      // when the vendor reaches the recompensas page — non-blocking, intentional.
      try {
        const fns = getFunctions(getFirebaseApp(), "us-central1");
        httpsCallable(fns, "generateRewardDraft")({ restaurantId }).catch(() => {
          // Silently swallow — recompensas page has a manual fallback button
        });
      } catch {
        // ignore
      }

      // Reload menu items
      const menuSnap = await getDocs(collection(db, "restaurants", restaurantId, "menu"));
      setMenuItems(menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) })));
      setDraftItems([]);
      setJobId(null);
      setPhotoStep("idle");
    } catch (e) {
      console.error(e);
      setPhotoStep("review");
    }
  }

  // Final save & readiness update
  async function handleDone() {
    if (!restaurantId) return;
    if (menuItems.length === 0) { setError("Agrega al menos un platillo antes de continuar."); return; }
    setSaving(true);
    setError(null);
    try {
      await persistReadiness(restaurantId);
      setSaved(true);
      setTimeout(() => router.push(isWizard ? "/vendor/setup/recompensas?wizard=1" : "/vendor/setup"), 800);
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        {isWizard ? (
          <WizardStepper current="menu" />
        ) : (
          <div className="border-b border-[#141413]/8 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <Link href="/vendor/setup" className="text-sm text-[#141413]/45 hover:text-[#141413] transition-colors">← Volver</Link>
              <span className="text-[#141413]/20">/</span>
              <h1 className="text-sm font-semibold text-[#141413]">Menú</h1>
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#141413]">¿Qué sirves?</h2>
          <p className="mt-1 text-sm text-[#141413]/50">
            Tus platillos ayudan a la IA a sugerir recompensas personalizadas.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── AI Photo Import Section ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d97757]/10 text-lg">✨</div>
            <div>
              <p className="text-sm font-semibold text-[#141413]">Importar con foto de menú</p>
              <p className="mt-0.5 text-xs text-[#141413]/50">La IA lee tu menú físico y agrega los platillos automáticamente</p>
            </div>
          </div>

          {aiError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{aiError}</div>
          )}

          {photoStep === "idle" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d97757]/30 bg-[#d97757]/5 px-4 py-5 text-sm font-medium text-[#d97757] hover:border-[#d97757]/60 hover:bg-[#d97757]/10 transition-all"
              >
                📷 Subir foto del menú
              </button>
            </>
          )}

          {(photoStep === "uploading" || photoStep === "processing") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="h-7 w-7 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
              </svg>
              <p className="text-sm text-[#141413]/60">
                {photoStep === "uploading" ? "Subiendo foto…" : "La IA está leyendo tu menú…"}
              </p>
              <p className="text-xs text-[#141413]/35">Esto toma unos segundos</p>
            </div>
          )}

          {photoStep === "review" && draftItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#d97757]">
                Encontramos {draftItems.length} platillos — revisa y confirma
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {draftItems.map((item, i) => (
                  <label key={item.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    item.selected ? "border-[#d97757]/30 bg-[#d97757]/5" : "border-[#141413]/8 bg-white"
                  }`}>
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => {
                        const updated = [...draftItems];
                        updated[i] = { ...item, selected: e.target.checked };
                        setDraftItems(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded accent-[#d97757]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#141413] truncate">{item.name}</p>
                      {item.description && <p className="text-xs text-[#141413]/45 truncate">{item.description}</p>}
                      {item.price > 0 && <p className="text-xs text-[#d97757] font-medium">${item.price.toFixed(2)}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePublishDrafts}
                  disabled={draftItems.filter((d) => d.selected).length === 0}
                  className="flex-1 rounded-xl bg-[#d97757] py-2.5 text-sm font-semibold text-white hover:bg-[#c46644] disabled:opacity-50 transition-colors"
                >
                  Agregar {draftItems.filter((d) => d.selected).length} platillos ✓
                </button>
                <button
                  onClick={() => { setPhotoStep("idle"); setDraftItems([]); setJobId(null); }}
                  className="rounded-xl border border-[#141413]/12 px-4 py-2.5 text-sm text-[#141413]/50 hover:text-[#141413] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {photoStep === "publishing" && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-[#141413]/60">
              <svg className="h-4 w-4 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
              </svg>
              Guardando platillos…
            </div>
          )}
        </div>

        {/* ── Manual Add ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">✏️</span>
              <p className="text-sm font-semibold text-[#141413]">Agregar manualmente</p>
            </div>
            <button
              onClick={() => setShowManual((v) => !v)}
              className="text-xs text-[#d97757] font-medium hover:text-[#c46644] transition-colors"
            >
              {showManual ? "Cancelar" : "+ Agregar"}
            </button>
          </div>

          {showManual && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del platillo *"
                value={manualForm.name}
                onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={manualForm.description}
                onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Precio"
                  value={manualForm.price || ""}
                  min={0}
                  step={0.5}
                  onChange={(e) => setManualForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  className="w-28 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Categoría (ej. Bebidas)"
                  value={manualForm.category}
                  onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}
                  className="flex-1 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddManual}
                disabled={addingManual || !manualForm.name.trim()}
                className="w-full rounded-xl bg-[#141413] py-2.5 text-sm font-semibold text-white hover:bg-[#141413]/80 disabled:opacity-50 transition-colors"
              >
                {addingManual ? "Agregando…" : "Agregar platillo"}
              </button>
            </div>
          )}
        </div>

        {/* ── Current Menu List ── */}
        {menuItems.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#141413]/45">
              Menú actual · {menuItems.length} platillo{menuItems.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {menuItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[#141413]/8 bg-white px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#faf9f5] text-sm">🍽️</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#141413] truncate">{item.name}</p>
                    {item.category && <p className="text-xs text-[#141413]/40">{item.category}</p>}
                  </div>
                  {item.price > 0 && (
                    <span className="text-xs font-semibold text-[#d97757]">${item.price.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Done ── */}
        <button
          onClick={handleDone}
          disabled={saving || saved || menuItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-60"
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : menuItems.length === 0 ? "Agrega al menos un platillo" : `Guardar menú (${menuItems.length}) →`}
        </button>
      </main>
    </div>
  );
}

export default function MenuSetupPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MenuSetupPageInner />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <svg className="h-6 w-6 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
      </svg>
    </div>
  );
}

function Spin() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
    </svg>
  );
}
