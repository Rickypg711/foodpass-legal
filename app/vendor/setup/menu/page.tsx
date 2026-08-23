"use client";

// Menú del negocio — hub completo (paridad con MenuHubScreen del app):
// importar con foto (IA), agregar, EDITAR, duplicar, eliminar (con las mismas
// guardas que el app: último platillo / usado en recompensas), foto del
// platillo, buscar, filtrar por categoría y marcar agotado/disponible.
// El menú del cliente y la caja ya filtran isAvailable — "Agotado" aquí
// saca el platillo de venta al instante en web y app por igual.

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseStorage, getFirebaseApp } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness } from "@/lib/vendorReadiness";
import { parseOptionGroupsFromDescription, type MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import { OptionGroupsEditor, cleanOptionGroups } from "@/components/vendor/OptionGroupsEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  /** Opciones que el cliente elige al ordenar (salsa, aderezo, extras). */
  optionGroups: MenuItemOptionGroup[];
  /** Doc completo — preserva modifiers y demás campos que la web no edita. */
  raw: Record<string, unknown>;
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

type ModalState = { mode: "create" } | { mode: "edit"; item: MenuItem } | null;

// ─── Helpers compartidos (mismas reglas que MenuService del app) ─────────────

function parseMenuItem(id: string, data: Record<string, unknown>): MenuItem {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
    price: typeof data.price === "number" ? data.price : 0,
    category: typeof data.category === "string" ? data.category : "",
    imageUrl: typeof data.imageUrl === "string" && data.imageUrl ? data.imageUrl : null,
    isAvailable: data.isAvailable !== false,
    optionGroups: Array.isArray(data.optionGroups)
      ? (data.optionGroups as MenuItemOptionGroup[])
      : [],
    raw: data,
  };
}

/** Misma ruta que el app: restaurants/{rid}/menu/{rid}_{millis}_{nombre}.jpg */
async function uploadItemImage(rid: string, itemName: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  const fileName = `${rid}_${Date.now()}_${itemName.replace(/ /g, "_")}.jpg`;
  const storageRef = ref(storage, `restaurants/${rid}/menu/${fileName}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

/** Igual que el app: borrar imagen nunca es crítico — si falla, se ignora. */
async function deleteImageBestEffort(imageUrl: string | null) {
  if (!imageUrl) return;
  try {
    await deleteObject(ref(getFirebaseStorage(), imageUrl));
  } catch {
    // no crítico
  }
}

/**
 * Mismas guardas y MISMOS mensajes que getMenuItemDeleteBlockReason del app:
 * último platillo del menú, o usado en firstPurchaseReward / rewardTiers.
 */
async function deleteBlockReason(
  db: Firestore,
  rid: string,
  itemId: string,
  totalItems: number,
): Promise<string | null> {
  if (totalItems <= 1) return "No puedes eliminar el último platillo del menú.";
  const usedInRewards = "No puedes eliminar este producto porque está siendo usado en recompensas.";
  const snap = await getDoc(doc(db, "restaurants", rid));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const fpr = data.firstPurchaseReward;
  if (fpr && typeof fpr === "object") {
    const mid = (fpr as Record<string, unknown>).menuItemId;
    if (typeof mid === "string" && mid.trim() && mid.trim() === itemId) return usedInRewards;
  }
  const tiers = Array.isArray(data.rewardTiers) ? data.rewardTiers : [];
  for (const t of tiers) {
    if (!t || typeof t !== "object") continue;
    const mid = (t as Record<string, unknown>).menuItemId;
    if (typeof mid === "string" && mid.trim() && mid.trim() === itemId) return usedInRewards;
  }
  return null;
}

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

  // Hub: buscar / filtrar / editar
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [availFilter, setAvailFilter] = useState<"all" | "on" | "off">("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // AI photo import
  const [photoStep, setPhotoStep] = useState<PhotoStep>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadMenu = useCallback(async (rid: string) => {
    const db = getFirebaseDb();
    const menuSnap = await getDocs(collection(db, "restaurants", rid, "menu"));
    const items = menuSnap.docs.map((d) => parseMenuItem(d.id, d.data() as Record<string, unknown>));
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    setMenuItems(items);
  }, []);

  // Load auth + existing menu
  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      await reloadMenu(rid);
      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router, reloadMenu]);

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

      await reloadMenu(restaurantId);
      setDraftItems([]);
      setJobId(null);
      setPhotoStep("idle");
    } catch (e) {
      console.error(e);
      setPhotoStep("review");
    }
  }

  // Agotado/disponible directo en la tarjeta (misma escritura que el app:
  // toggleMenuItemAvailability → isAvailable + updatedAt).
  async function handleToggleAvailability(item: MenuItem) {
    if (!restaurantId || togglingId) return;
    setTogglingId(item.id);
    const next = !item.isAvailable;
    setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i)));
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId, "menu", item.id), {
        isAvailable: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !next } : i)));
      setError("No se pudo actualizar la disponibilidad. Intenta de nuevo.");
    } finally {
      setTogglingId(null);
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

  // ── Derivados del hub ──
  const categories = Array.from(new Set(menuItems.map((i) => i.category.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const q = search.trim().toLowerCase();
  const visibleItems = menuItems.filter((i) => {
    if (availFilter === "on" && !i.isAvailable) return false;
    if (availFilter === "off" && i.isAvailable) return false;
    if (catFilter && i.category.trim() !== catFilter) return false;
    if (q && !`${i.name} ${i.category} ${i.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const hasFilters = q !== "" || catFilter !== null || availFilter !== "all";

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
            Toca un platillo para editarlo. Márcalo agotado y deja de venderse al instante.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── AI Photo Import Section ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F28C38]/10 text-lg">✨</div>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#F28C38]/30 bg-[#F28C38]/5 px-4 py-5 text-sm font-medium text-[#F28C38] hover:border-[#F28C38]/60 hover:bg-[#F28C38]/10 transition-all"
              >
                📷 Subir foto del menú
              </button>
            </>
          )}

          {(photoStep === "uploading" || photoStep === "processing") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="h-7 w-7 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
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
              <p className="text-xs font-semibold uppercase tracking-widest text-[#F28C38]">
                Encontramos {draftItems.length} platillos — revisa y confirma
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {draftItems.map((item, i) => (
                  <label key={item.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    item.selected ? "border-[#F28C38]/30 bg-[#F28C38]/5" : "border-[#141413]/8 bg-white"
                  }`}>
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => {
                        const updated = [...draftItems];
                        updated[i] = { ...item, selected: e.target.checked };
                        setDraftItems(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded accent-[#F28C38]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#141413] truncate">{item.name}</p>
                      {item.description && <p className="text-xs text-[#141413]/45 truncate">{item.description}</p>}
                      {item.price > 0 && <p className="text-xs text-[#F28C38] font-medium">${item.price.toFixed(2)}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePublishDrafts}
                  disabled={draftItems.filter((d) => d.selected).length === 0}
                  className="flex-1 rounded-xl bg-[#F28C38] py-2.5 text-sm font-semibold text-white hover:bg-[#c46644] disabled:opacity-50 transition-colors"
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
              <svg className="h-4 w-4 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
              </svg>
              Guardando platillos…
            </div>
          )}
        </div>

        {/* ── Agregar manualmente ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">✏️</span>
              <p className="text-sm font-semibold text-[#141413]">Agregar manualmente</p>
            </div>
            <button
              onClick={() => setModal({ mode: "create" })}
              className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#141413]/80 transition-colors"
            >
              + Agregar
            </button>
          </div>
        </div>

        {/* ── Current Menu Hub ── */}
        {menuItems.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#141413]/45">
              Menú actual · {menuItems.length} platillo{menuItems.length !== 1 ? "s" : ""}
              {hasFilters && visibleItems.length !== menuItems.length ? ` · mostrando ${visibleItems.length}` : ""}
            </p>

            {/* Buscar */}
            <input
              type="text"
              placeholder="🔍 Buscar platillo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 w-full rounded-xl border border-[#141413]/12 bg-white px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#141413]/35 focus:border-[#F28C38] focus:outline-none"
            />

            {/* Filtros */}
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip label="Todos" selected={availFilter === "all" && catFilter === null} onClick={() => { setAvailFilter("all"); setCatFilter(null); }} />
              <FilterChip label="Disponibles" selected={availFilter === "on"} onClick={() => setAvailFilter(availFilter === "on" ? "all" : "on")} />
              <FilterChip label="Agotados" selected={availFilter === "off"} onClick={() => setAvailFilter(availFilter === "off" ? "all" : "off")} />
              {categories.map((c) => (
                <FilterChip key={c} label={c} selected={catFilter === c} onClick={() => setCatFilter(catFilter === c ? null : c)} />
              ))}
            </div>

            {visibleItems.length === 0 ? (
              <div className="rounded-2xl border border-[#141413]/8 bg-white px-4 py-8 text-center">
                <p className="text-sm font-medium text-[#141413]">No hay platillos que coincidan</p>
                <button
                  onClick={() => { setSearch(""); setCatFilter(null); setAvailFilter("all"); }}
                  className="mt-2 text-xs font-semibold text-[#F28C38] hover:text-[#c46644]"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setModal({ mode: "edit", item })}
                    className={`flex w-full items-center gap-3 rounded-xl border border-[#141413]/8 bg-white px-3.5 py-3 text-left transition-all hover:border-[#F28C38]/40 hover:shadow-sm ${
                      item.isAvailable ? "" : "opacity-60"
                    }`}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#faf9f5] text-sm">🍽️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#141413] truncate">{item.name}</p>
                      <p className="text-xs text-[#141413]/40 truncate">
                        {item.category}
                        {item.description ? ` · ${item.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {item.price > 0 && (
                        <span className="text-xs font-semibold text-[#F28C38]">${item.price.toFixed(2)}</span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleToggleAvailability(item); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleToggleAvailability(item); }
                        }}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                          item.isAvailable
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            : "bg-red-50 text-red-500 hover:bg-red-100"
                        } ${togglingId === item.id ? "opacity-50" : ""}`}
                      >
                        {item.isAvailable ? "Disponible" : "Agotado"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Done ── */}
        <button
          onClick={handleDone}
          disabled={saving || saved || menuItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-60"
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : menuItems.length === 0 ? "Agrega al menos un platillo" : `Guardar menú (${menuItems.length}) →`}
        </button>
      </main>

      {/* ── Modal crear/editar ── */}
      {modal && restaurantId && (
        <ItemFormModal
          key={modal.mode === "edit" ? modal.item.id : "create"}
          rid={restaurantId}
          mode={modal.mode}
          item={modal.mode === "edit" ? modal.item : null}
          categories={categories}
          totalItems={menuItems.length}
          onClose={() => setModal(null)}
          onChanged={async () => {
            setModal(null);
            await reloadMenu(restaurantId);
          }}
        />
      )}
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "border-[#F28C38] bg-[#F28C38]/10 text-[#F28C38]"
          : "border-[#141413]/12 bg-white text-[#141413]/55 hover:border-[#141413]/25"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Modal crear / editar platillo ───────────────────────────────────────────
// Paridad con menu_product_form_page del app: nombre, descripción, precio,
// categoría, foto, disponible; y en editar: duplicar y eliminar (con las
// mismas guardas del app). Los modifiers del app se preservan sin tocarse.

function ItemFormModal({
  rid,
  mode,
  item,
  categories,
  totalItems,
  onClose,
  onChanged,
}: {
  rid: string;
  mode: "create" | "edit";
  item: MenuItem | null;
  categories: string[];
  totalItems: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [fName, setFName] = useState(item?.name ?? "");
  const [fDesc, setFDesc] = useState(item?.description ?? "");
  const [fPrice, setFPrice] = useState<string>(item && item.price > 0 ? String(item.price) : "");
  const [fCategory, setFCategory] = useState(item?.category ?? "");
  const [fAvailable, setFAvailable] = useState(item?.isAvailable ?? true);
  // Los grupos guardados mandan; si el platillo no tiene, se arranca con lo
  // que se detecte en la descripción para no hacer al dueño teclearlo de nuevo.
  const [fGroups, setFGroups] = useState<MenuItemOptionGroup[]>(
    item?.optionGroups?.length
      ? item.optionGroups
      : parseOptionGroupsFromDescription(item?.description),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);

  const [busy, setBusy] = useState<null | "save" | "duplicate" | "delete">(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function pickImage(f: File) {
    setImageFile(f);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  async function handleSave() {
    const name = fName.trim();
    if (!name || busy) return;
    setBusy("save");
    setModalError(null);
    try {
      const db = getFirebaseDb();
      // Imagen: igual que updateMenuItem del app — si llega nueva, se borra la
      // anterior de Storage y se sube la nueva; si se quita, solo se borra.
      let imageUrl: string | null = item?.imageUrl ?? null;
      if (imageFile) {
        await deleteImageBestEffort(item?.imageUrl ?? null);
        imageUrl = await uploadItemImage(rid, name, imageFile);
      } else if (removeImage) {
        await deleteImageBestEffort(item?.imageUrl ?? null);
        imageUrl = null;
      }

      const fields = {
        name,
        description: fDesc.trim(),
        price: parseFloat(fPrice) || 0,
        category: fCategory.trim(),
        imageUrl,
        isAvailable: fAvailable,
        optionGroups: cleanOptionGroups(fGroups),
        updatedAt: serverTimestamp(),
      };

      if (mode === "edit" && item) {
        await updateDoc(doc(db, "restaurants", rid, "menu", item.id), fields);
      } else {
        await addDoc(collection(db, "restaurants", rid, "menu"), {
          ...fields,
          createdAt: serverTimestamp(),
        });
      }
      await persistReadiness(rid);
      await onChanged();
    } catch (e) {
      console.error(e);
      setModalError("No se pudo guardar. Intenta de nuevo.");
      setBusy(null);
    }
  }

  // Igual que _duplicateItem del app: copia exacta (comparte la foto).
  async function handleDuplicate() {
    if (!item || busy) return;
    setBusy("duplicate");
    setModalError(null);
    try {
      const db = getFirebaseDb();
      const copy: Record<string, unknown> = { ...item.raw };
      delete copy.createdAt;
      delete copy.updatedAt;
      delete copy.importedFromJob;
      await addDoc(collection(db, "restaurants", rid, "menu"), {
        ...copy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await persistReadiness(rid);
      await onChanged();
    } catch (e) {
      console.error(e);
      setModalError("No se pudo duplicar. Intenta de nuevo.");
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!item || busy) return;
    setBusy("delete");
    setModalError(null);
    try {
      const db = getFirebaseDb();
      const blocked = await deleteBlockReason(db, rid, item.id, totalItems);
      if (blocked) {
        setModalError(blocked);
        setConfirmDelete(false);
        setBusy(null);
        return;
      }
      await deleteDoc(doc(db, "restaurants", rid, "menu", item.id));
      await deleteImageBestEffort(item.imageUrl);
      await persistReadiness(rid);
      await onChanged();
    } catch (e) {
      console.error(e);
      setModalError("No se pudo eliminar. Intenta de nuevo.");
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#141413]">
            {mode === "edit" ? "Editar platillo" : "Nuevo platillo"}
          </h3>
          <button
            onClick={() => { if (!busy) onClose(); }}
            className="rounded-lg px-2 py-1 text-sm text-[#141413]/40 hover:text-[#141413] transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {modalError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
            {modalError}
          </div>
        )}

        <div className="space-y-3">
          {/* Foto */}
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
              e.target.value = "";
            }}
          />
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="h-36 w-full object-cover" />
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                <button
                  onClick={() => imgInputRef.current?.click()}
                  className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-[#141413] shadow-sm hover:bg-white transition-colors"
                >
                  Cambiar
                </button>
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); }}
                  className="rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-red-500 shadow-sm hover:bg-white transition-colors"
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => imgInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#141413]/15 bg-[#faf9f5] px-4 py-6 text-xs font-medium text-[#141413]/45 hover:border-[#F28C38]/50 hover:text-[#F28C38] transition-all"
            >
              📷 Agregar foto del platillo (opcional)
            </button>
          )}

          <input
            type="text"
            placeholder="Nombre del platillo *"
            value={fName}
            onChange={(e) => setFName(e.target.value)}
            className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
          />
          <textarea
            placeholder="Descripción (opcional)"
            value={fDesc}
            rows={2}
            onChange={(e) => setFDesc(e.target.value)}
            className="w-full resize-none rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
          />

          {/* Opciones que el cliente elige al ordenar. Arranca con lo que se
              detecte en la descripción ("Elige tu salsa: A, B, C") y de ahí el
              dueño lo edita: nombres, precios de extras, obligatorio o no. Lo
              guardado manda sobre lo detectado. */}
          <OptionGroupsEditor
            groups={fGroups}
            onChange={setFGroups}
            detectedHint={
              parseOptionGroupsFromDescription(fDesc).length > 0
                ? "Detectamos opciones en la descripción. Dale a + Grupo para editarlas y ponerles precio."
                : null
            }
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Precio"
              value={fPrice}
              min={0}
              step={0.5}
              onChange={(e) => setFPrice(e.target.value)}
              className="w-28 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Categoría (ej. Bebidas)"
              value={fCategory}
              list="menu-hub-categories"
              onChange={(e) => setFCategory(e.target.value)}
              className="flex-1 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
            />
            <datalist id="menu-hub-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Disponible */}
          <button
            onClick={() => setFAvailable((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 transition-colors"
          >
            <span className="text-sm text-[#141413]">Disponible en el menú</span>
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                fAvailable ? "bg-emerald-500" : "bg-[#141413]/20"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  fAvailable ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={busy !== null || !fName.trim()}
            className="w-full rounded-xl bg-[#141413] py-3 text-sm font-semibold text-white hover:bg-[#141413]/80 disabled:opacity-50 transition-colors"
          >
            {busy === "save" ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Agregar platillo"}
          </button>

          {mode === "edit" && !confirmDelete && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleDuplicate}
                disabled={busy !== null}
                className="flex-1 rounded-xl border border-[#141413]/12 py-2.5 text-xs font-semibold text-[#141413]/60 hover:text-[#141413] disabled:opacity-50 transition-colors"
              >
                {busy === "duplicate" ? "Duplicando…" : "⧉ Duplicar"}
              </button>
              <button
                onClick={() => { setModalError(null); setConfirmDelete(true); }}
                disabled={busy !== null}
                className="flex-1 rounded-xl border border-red-200 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                🗑 Eliminar
              </button>
            </div>
          )}

          {mode === "edit" && confirmDelete && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-600">
                ¿Eliminar “{item?.name}”? Esta acción no se puede deshacer.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {busy === "delete" ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy !== null}
                  className="flex-1 rounded-lg border border-red-200 bg-white py-2 text-xs font-semibold text-red-500 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
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
      <svg className="h-6 w-6 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
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
