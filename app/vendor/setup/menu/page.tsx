"use client";

// Menú del negocio — hub completo (paridad con MenuHubScreen del app):
// importar con foto (IA), agregar, EDITAR, duplicar, eliminar (con las mismas
// guardas que el app: último platillo / usado en recompensas), foto del
// platillo, buscar, filtrar por categoría y marcar agotado/disponible.
// El menú del cliente y la caja ya filtran isAvailable — "Agotado" aquí
// saca el platillo de venta al instante en web y app por igual.

import { useCallback, useEffect, useRef, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import { wizardDoneKeys } from "@/lib/vendorReadiness";
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
import {
  parseOptionGroupsFromDescription,
  resolveOptionGroups,
  optionAvailabilityChanges,
  applyOptionAvailabilityChangesToMenu,
  type MenuItemOptionGroup,
} from "@/lib/menu/optionGroups";
import { OptionGroupsEditor, cleanOptionGroups } from "@/components/vendor/OptionGroupsEditor";

// ─── Opción A (23-sep-2026, lienzo "Sistema Comeleal") ───────────────────────
// Los mismos tokens que Panel, Pedidos, Caja y Clientes: crema de fondo, tinta
// para el texto, UNA serif (Lora) solo en títulos, naranja solo en la acción
// principal. Iconos de trazo, sin emojis ni sombras.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const CREAM = "#FAF9F5";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const TILE = "#F0EBE1";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const DANGER = "#B91C1C";
const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconPlus() { return <svg {...ICON}><path d="M12 5v14M5 12h14" /></svg>; }
function IconCamera() { return <svg {...ICON}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>; }
function IconClose() { return <svg {...ICON} width={20} height={20}><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function IconSearch({ size = 18 }: { size?: number }) { return <svg {...ICON} width={size} height={size} stroke={INK_SOFT}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>; }
/** Plato con cubiertos: la miniatura de un platillo sin foto. */
function IconDish({ size = 20 }: { size?: number }) {
  return (
    <svg {...ICON} width={size} height={size} stroke={INK_SOFT}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

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

/**
 * "Estos dos renglones son el mismo platillo en dos tamaños."
 *
 * Lo propone la IA al leer la foto (`functions/menu_size_grouping_ai.js`) y lo
 * confirma el dueño. NUNCA se aplica solo: juntar mal le borra un platillo.
 * Los precios vienen de lo que se leyó de la foto, no del modelo.
 */
interface SizeSuggestion {
  dishName: string;
  groupName: string;
  basePrice: number;
  options: {
    sourceName: string;
    sizeLabel: string;
    price: number;
    priceDelta: number;
  }[];
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
  // 9-sep: en /vendor/menu el editor vive DENTRO del panel (sidebar): sin su
  // propio encabezado "← Volver" y al guardar regresa al panel, no al setup.
  const inPanel = usePathname() === "/vendor/menu";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [stepperDone, setStepperDone] = useState<Array<"horario" | "menu"> | undefined>(undefined);
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
  const [sizeSuggestions, setSizeSuggestions] = useState<SizeSuggestion[]>([]);
  // Familias que el dueño ACEPTÓ juntar. Vacío = todo se queda separado, que
  // es el comportamiento de siempre.
  const [juntadas, setJuntadas] = useState<Set<number>>(new Set());
  /**
   * Nombres que YA no se listan solos porque quedaron absorbidos por una
   * familia aceptada. Se hace por NOMBRE y no por indice: los draftItems
   * llegan de Firestore ordenados por id, no en el orden en que se
   * extrajeron, asi que un indice aqui seria una bomba de tiempo.
   */
  const ocultoPorJuntar = useMemo(() => {
    const set = new Set<string>();
    for (const i of juntadas) {
      for (const o of sizeSuggestions[i]?.options ?? []) set.add(o.sourceName);
    }
    return set;
  }, [juntadas, sizeSuggestions]);

  /**
   * Cuantos platillos se van a escribir de verdad: los sueltos que quedan
   * seleccionados MAS uno por cada familia aceptada. Contar solo los
   * seleccionados mentia en cuanto juntabas algo.
   */
  const totalAPublicar = useMemo(
    () =>
      draftItems.filter((d) => d.selected && !ocultoPorJuntar.has(d.name)).length +
      juntadas.size,
    [draftItems, juntadas, ocultoPorJuntar],
  );
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
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar?modo=entrar"); return; }
      // La palomita del stepper sale del readiness, no de la posición.
      const rSnap = await getDoc(doc(db, "restaurants", rid));
      setStepperDone(wizardDoneKeys(rSnap.data()?.setupIncompleteReasons));
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
        "No pudimos leer el menú a tiempo. Prueba con otra foto o agrega los platillos uno por uno."
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
          setSizeSuggestions(
            Array.isArray(data.sizeSuggestions)
              ? (data.sizeSuggestions as SizeSuggestion[]).filter(
                  (f) => Array.isArray(f?.options) && f.options.length >= 2,
                )
              : [],
          );
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
          setAiError("No pudimos leer el menú. Prueba con otra foto o agrega los platillos uno por uno.");
          setPhotoStep("idle");
        }
      },
      () => {
        // Snapshot listener error (permissions/network) — fail gracefully
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAiError("Se perdió la conexión al leer el menú. Vuelve a intentar o agrega los platillos uno por uno.");
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
    if (selected.length === 0 && juntadas.size === 0) return;
    setPhotoStep("publishing");
    try {
      const db = getFirebaseDb();
      const batch = writeBatch(db);

      // ── Las familias que el dueño aceptó juntar ─────────────────────────
      // Cada una se guarda como UN platillo, al precio del más barato, con un
      // grupo `Tamaño` OBLIGATORIO: una pizza sin tamaño no es un pedido. Las
      // filas que quedaron absorbidas ya no se escriben por separado.
      for (const i of juntadas) {
        const f = sizeSuggestions[i];
        if (!f) continue;
        const base = selected.find((d) => d.name === f.options[0]?.sourceName)
          ?? draftItems.find((d) => d.name === f.options[0]?.sourceName);
        const newRef = doc(collection(db, "restaurants", restaurantId, "menu"));
        batch.set(newRef, {
          name: f.dishName,
          description: base?.description ?? "",
          // El precio base es el del tamaño más barato; los demás entran como
          // sobreprecio, así ningún delta es negativo.
          price: f.basePrice,
          category: base?.category ?? "",
          isAvailable: true,
          optionGroups: [
            {
              id: "tamano",
              name: f.groupName || "Tamaño",
              required: true,
              min: 1,
              max: 1,
              options: f.options.map((o) => ({
                id: o.sizeLabel
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
                name: o.sizeLabel,
                priceDelta: o.priceDelta,
              })),
            },
          ],
          createdAt: serverTimestamp(),
          importedFromJob: jobId,
          mergedFromSizes: f.options.map((o) => o.sourceName),
        });
      }

      for (const item of selected) {
        // Lo que quedó dentro de una familia aceptada no se escribe solo.
        if (ocultoPorJuntar.has(item.name)) continue;
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

      // Cierra el loop de la IA de tamaños: el job ya trae las PROPUESTAS
      // (sizeSuggestions); esto deja en el mismo doc cuántas ACEPTÓ el dueño.
      // propuestas vs aceptadas = la nota del detector, medible con una sola
      // lectura. Espejo del publishJob del app Flutter.
      if (jobId) {
        batch.update(doc(db, "restaurants", restaurantId, "menuImportJobs", jobId), {
          sizeFamiliesAccepted: juntadas.size,
          updatedAt: serverTimestamp(),
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
      // 7-sep: Recompensas salió del embudo; con horario y menú el local
      // está completo y el siguiente paso es el festejo.
      setTimeout(() => router.push(isWizard ? "/vendor/setup/done" : inPanel ? "/vendor" : "/vendor/setup"), 800);
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


  // Agrupado por categoría para pintar títulos de grupo (Lora 17) con su
  // conteo. Los platillos ya vienen ordenados por categoría y nombre.
  const grupos: { name: string; items: MenuItem[] }[] = [];
  for (const it of visibleItems) {
    const name = it.category.trim() || "Sin categoría";
    const last = grupos[grupos.length - 1];
    if (last && last.name === name) last.items.push(it);
    else grupos.push({ name, items: [it] });
  }

  const nPlatillos = menuItems.length;
  const nGrupos = categories.length;
  const caption =
    nPlatillos === 0
      ? "Todavía no hay platillos"
      : `${nPlatillos} platillo${nPlatillos !== 1 ? "s" : ""} · ${nGrupos} grupo${nGrupos !== 1 ? "s" : ""}`;
  const importBusy = photoStep !== "idle";

  if (loading) return <Spinner />;

  return (
    <div className={inPanel ? "" : "min-h-screen"} style={{ background: CREAM }}>
      {/* Nav (solo fuera del panel): el stepper del wizard, o "← Volver". */}
      {inPanel ? null : (
        <div className="sticky top-0 z-10" style={{ background: CREAM }}>
          {isWizard ? (
            <WizardStepper current="menu" doneKeys={stepperDone} />
          ) : (
            <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <div className="mx-auto flex max-w-lg items-center gap-3">
                <Link href="/vendor/setup" className="text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
                  Volver
                </Link>
                <span style={{ color: BORDER }}>/</span>
                <span className="text-[14px] font-semibold" style={{ color: INK }}>Menú</span>
              </div>
            </div>
          )}
        </div>
      )}

      <main className={inPanel ? "max-w-2xl px-5 pb-24 pt-5 md:px-8 md:pt-7" : "mx-auto max-w-lg px-5 pb-24 pt-5"}>
        {/* Título de pantalla (Lora) + qué hay debajo */}
        <div className="mb-5 flex flex-col gap-0.5">
          <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Menú</h1>
          <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{caption}</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-[14px] leading-[18px]" style={{ color: DANGER }}>{error}</p>
        )}
        {aiError && (
          <p role="alert" className="mb-4 text-[14px] leading-[18px]" style={{ color: DANGER }}>{aiError}</p>
        )}

        {/* El input de la foto vive aquí, sea cual sea el estado: lo abren
            "Subir foto del menú" (arriba o en el estado vacío). */}
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

        {/* ── Acciones de arriba: UN botón principal, el resto con borde ── */}
        {photoStep === "idle" && nPlatillos > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition hover:opacity-90"
              style={{ background: BRAND, color: INK }}
            >
              <IconPlus />
              Agregar platillo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              <IconCamera />
              Subir foto del menú
            </button>
          </div>
        )}

        {/* ── Leyendo la foto ── */}
        {(photoStep === "uploading" || photoStep === "processing") && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3.5" style={{ border: `1px solid ${BORDER}` }}>
            <Spin />
            <div className="min-w-0">
              <p className="text-[15px] leading-5" style={{ color: INK }}>
                {photoStep === "uploading" ? "Subiendo la foto…" : "Leyendo tu menú…"}
              </p>
              <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>Esto toma unos segundos</p>
            </div>
          </div>
        )}

        {/* ── Revisar lo que se leyó de la foto ── */}
        {photoStep === "review" && draftItems.length > 0 && (
          <section className="mb-7">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
                Encontramos {draftItems.length} platillo{draftItems.length !== 1 ? "s" : ""}
              </h2>
              <span className="text-[13px] leading-4" style={{ color: INK_SOFT }}>Revisa y confirma</span>
            </div>

            {/* ── El mismo platillo en dos tamaños ───────────────────────
                Se detecta al leer la foto; el dueño decide. Nunca se junta
                solo: "Personal queso" y "Queso y albahaca" pueden ser la
                misma pizza o no, y solo él lo sabe. */}
            {sizeSuggestions.length > 0 && (
              <div className="mb-3 space-y-2">
                {sizeSuggestions.map((f, i) => {
                  const junta = juntadas.has(i);
                  return (
                    <div
                      key={`${f.dishName}-${i}`}
                      className="rounded-xl bg-white p-3.5"
                      style={{ border: `1px solid ${junta ? INK : BORDER}` }}
                    >
                      <p className="text-[15px] leading-5" style={{ color: INK }}>
                        ¿<span className="font-semibold">{f.dishName}</span> es el mismo platillo en {f.options.length} tamaños?
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {f.options.map((o) => (
                          <li key={o.sourceName} className="text-[13px] leading-[18px] tabular-nums" style={{ color: INK_MUTED }}>
                            {o.sourceName} — ${o.price.toFixed(0)}
                            <span style={{ color: INK_SOFT }}>
                              {"  →  "}{o.sizeLabel}
                              {o.priceDelta > 0 ? ` +$${o.priceDelta.toFixed(0)}` : " (base)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>
                        {junta
                          ? `Se guarda como un platillo de $${f.basePrice.toFixed(0)} y el cliente elige el tamaño.`
                          : "Si los juntas, tu cliente elige el tamaño en vez de buscar en dos categorías."}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setJuntadas((prev) => {
                            const n = new Set(prev);
                            if (n.has(i)) n.delete(i); else n.add(i);
                            return n;
                          })
                        }
                        className="mt-2.5 flex h-10 items-center justify-center rounded-xl px-4 text-[14px] font-semibold transition hover:opacity-90"
                        style={junta ? { background: TILE, color: INK } : { background: "#FFFFFF", border: `1px solid ${INK}`, color: INK }}
                      >
                        {junta ? "Dejarlos separados" : "Sí, juntarlos"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-xl bg-white px-3.5" style={{ border: `1px solid ${BORDER}` }}>
              {draftItems.map((item, i) => (
                ocultoPorJuntar.has(item.name) ? null : (
                <label
                  key={item.id}
                  className="flex min-h-[56px] cursor-pointer items-center gap-3 py-2.5"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => {
                      const updated = [...draftItems];
                      updated[i] = { ...item, selected: e.target.checked };
                      setDraftItems(updated);
                    }}
                    className="h-5 w-5 shrink-0 rounded"
                    style={{ accentColor: INK }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] leading-5" style={{ color: INK }}>{item.name}</p>
                    {(item.description || item.category) && (
                      <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>
                        {item.category}
                        {item.category && item.description ? " · " : ""}
                        {item.description}
                      </p>
                    )}
                  </div>
                  {item.price > 0 && (
                    <span className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: INK }}>${item.price.toFixed(2)}</span>
                  )}
                </label>
              )))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handlePublishDrafts}
                disabled={totalAPublicar === 0}
                className="flex h-12 flex-1 items-center justify-center rounded-xl px-4 text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: INK, color: CREAM }}
              >
                Agregar {totalAPublicar} {totalAPublicar === 1 ? "platillo" : "platillos"}
              </button>
              <button
                type="button"
                onClick={() => { setPhotoStep("idle"); setDraftItems([]); setJobId(null); }}
                className="flex h-12 items-center justify-center rounded-xl bg-white px-5 text-[14px] font-semibold transition hover:opacity-90"
                style={{ border: `1px solid ${BORDER}`, color: INK }}
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        {photoStep === "publishing" && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3.5" style={{ border: `1px solid ${BORDER}` }}>
            <Spin />
            <p className="text-[15px] leading-5" style={{ color: INK }}>Guardando platillos…</p>
          </div>
        )}

        {/* ── Estado vacío: sin platillos todavía ── */}
        {nPlatillos === 0 && !importBusy && (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}><IconDish size={22} /></div>
            <p className="mt-4 text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>Todavía no hay platillos</p>
            <p className="mt-1 max-w-xs text-[14px] leading-5" style={{ color: INK_MUTED }}>
              Sube una foto de tu menú y los leemos por ti, o agrégalos uno por uno.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition hover:opacity-90"
              style={{ background: BRAND, color: INK }}
            >
              <IconCamera />
              Subir foto del menú
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[14px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              <IconPlus />
              Agregar platillo
            </button>
          </div>
        )}

        {/* ── Lista del menú: buscar, chips, grupos con filas ── */}
        {nPlatillos > 0 && (
          <section>
            {/* Búsqueda: 48px, letra de 16 (sin zoom en iPhone) */}
            <label className="flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5" style={{ border: `1px solid ${BORDER}` }}>
              <IconSearch />
              <span className="sr-only">Buscar platillo</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar platillo"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
                style={{ color: INK }}
              />
            </label>

            {/* Chips: saltan entre grupos y estados; activo = tinta */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              <FilterChip label="Todos" selected={availFilter === "all" && catFilter === null} onClick={() => { setAvailFilter("all"); setCatFilter(null); }} />
              <FilterChip label="Disponibles" selected={availFilter === "on"} onClick={() => setAvailFilter(availFilter === "on" ? "all" : "on")} />
              <FilterChip label="Agotados" selected={availFilter === "off"} onClick={() => setAvailFilter(availFilter === "off" ? "all" : "off")} />
              {categories.map((c) => (
                <FilterChip key={c} label={c} selected={catFilter === c} onClick={() => setCatFilter(catFilter === c ? null : c)} />
              ))}
            </div>

            {hasFilters && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
                  {visibleItems.length} de {nPlatillos} platillos
                </span>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setCatFilter(null); setAvailFilter("all"); }}
                  className="text-[14px] font-semibold hover:underline"
                  style={{ color: LINK }}
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}><IconSearch size={22} /></div>
                <p className="mt-4 text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>No hay platillos que coincidan</p>
                <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>Prueba con otro nombre o quita los filtros.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-7">
                {grupos.map((g) => (
                  <div key={g.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h2 className="truncate text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>{g.name}</h2>
                      <span className="shrink-0 text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
                        {g.items.length} platillo{g.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div>
                      {g.items.map((item) => (
                        <MenuRow
                          key={item.id}
                          item={item}
                          toggling={togglingId === item.id}
                          onEdit={() => setModal({ mode: "edit", item })}
                          onToggle={() => handleToggleAvailability(item)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Guardar: cierra el paso del wizard o regresa al panel. Botón
            fuerte en tinta; el naranja ya lo lleva "Agregar platillo". ── */}
        {nPlatillos > 0 && (
          <button
            type="button"
            onClick={handleDone}
            disabled={saving || saved}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-60"
            style={{ background: INK, color: CREAM }}
          >
            {saved ? "Guardado" : saving ? <><Spin light />Guardando…</> : isWizard ? "Guardar menú y continuar" : inPanel ? "Guardar menú y volver al panel" : "Guardar menú"}
          </button>
        )}
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

// ─── Fila de platillo ─────────────────────────────────────────────────────────
// 64px: miniatura 48 (o el plato de trazo sobre tostado), nombre 15, descripción
// 13 en una línea, precio tabular a la derecha y, debajo, la pastilla de estado
// que también es el toggle (misma escritura que el app: isAvailable + updatedAt).

function MenuRow({
  item,
  toggling,
  onEdit,
  onToggle,
}: {
  item: MenuItem;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const off = !item.isAvailable;
  return (
    <div className="flex min-h-[64px] items-center gap-3 py-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${item.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-80"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" style={off ? { opacity: 0.5 } : undefined} />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: TILE }}><IconDish /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-5" style={{ color: off ? INK_SOFT : INK }}>{item.name}</p>
          {item.description && (
            <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>{item.description}</p>
          )}
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {item.price > 0 && (
          <span className="text-[15px] font-bold leading-5 tabular-nums" style={{ color: off ? INK_SOFT : INK }}>${item.price.toFixed(2)}</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-pressed={off}
          aria-label={off ? `Marcar ${item.name} como disponible` : `Marcar ${item.name} como agotado`}
          title={off ? "Volver a vender" : "Dejar de vender por ahora"}
          className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
          style={off ? { background: TILE, color: INK_MUTED } : { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK_MUTED }}
        >
          {off && <span className="h-1.5 w-1.5 rounded-full" style={{ background: INK_SOFT }} />}
          {off ? "Agotado" : "Disponible"}
        </button>
      </div>
    </div>
  );
}

// ─── Chip de filtro (36px, borde; activo = tinta) ────────────────────────────

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] transition hover:opacity-90"
      style={selected ? { background: INK, color: CREAM } : { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK }}
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

      // "Agotado" en TODO el menú (10-sep-2026, igual que la Caja): si el dueño
      // cambió la casilla de una opción que ya existía, se reparte a cada platillo
      // que la lleva. Lee el menú completo (también los apagados) y guarda en un
      // lote ANTES de onChanged, que recarga la lista: si no, el siguiente
      // platillo que se guarde traería la copia vieja y lo desharía.
      if (mode === "edit" && item) {
        const antes = item.optionGroups?.length
          ? item.optionGroups
          : parseOptionGroupsFromDescription(item.description);
        const cambios = optionAvailabilityChanges(antes, fields.optionGroups);
        if (cambios.length > 0) {
          try {
            const menuRef = collection(db, "restaurants", rid, "menu");
            const snap = await getDocs(menuRef);
            const otros = applyOptionAvailabilityChangesToMenu(
              snap.docs
                .filter((d) => d.id !== item.id)
                .map((d) => ({ id: d.id, groups: resolveOptionGroups(d.data()) })),
              cambios,
            );
            if (otros.length > 0) {
              const lote = writeBatch(db);
              for (const o of otros) {
                lote.update(doc(menuRef, o.id), { optionGroups: o.groups, updatedAt: serverTimestamp() });
              }
              await lote.commit();
            }
          } catch (e) {
            // Este platillo SÍ se guardó; lo que falló es repartirlo. Se dice tal
            // cual y el modal sigue abierto: volver a guardar lo reintenta.
            console.error(e);
            setModalError("Se guardó este platillo, pero no se pudo cambiar en los demás. Toca Guardar otra vez.");
            setBusy(null);
            return;
          }
        }
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


  const field =
    "h-12 w-full rounded-xl bg-white px-3.5 text-[16px] outline-none";
  const fieldStyle = { border: `1px solid ${BORDER}`, color: INK };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-item-form-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-5 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="menu-item-form-title" className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
            {mode === "edit" ? "Editar platillo" : "Nuevo platillo"}
          </h3>
          <button
            type="button"
            onClick={() => { if (!busy) onClose(); }}
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-70"
            style={{ color: INK_SOFT }}
            aria-label="Cerrar"
          >
            <IconClose />
          </button>
        </div>

        {modalError && (
          <p role="alert" className="mb-3 text-[14px] leading-[18px]" style={{ color: DANGER }}>
            {modalError}
          </p>
        )}

        <div className="space-y-4">
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
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
                  style={{ border: `1px solid ${BORDER}`, color: INK }}
                >
                  Cambiar foto
                </button>
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); }}
                  className="h-9 px-4 text-[14px] font-semibold hover:underline"
                  style={{ color: DANGER }}
                >
                  Quitar foto
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              <IconCamera />
              Agregar foto del platillo
              <span className="font-normal" style={{ color: INK_SOFT }}>· opcional</span>
            </button>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[13px] leading-4" style={{ color: INK_MUTED }}>Nombre</span>
            <input
              type="text"
              placeholder="Ej. Torta de pierna"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              className={field}
              style={fieldStyle}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] leading-4" style={{ color: INK_MUTED }}>Descripción <span style={{ color: INK_SOFT }}>· opcional</span></span>
            <textarea
              placeholder="Qué lleva, cómo viene"
              value={fDesc}
              rows={2}
              onChange={(e) => setFDesc(e.target.value)}
              className="w-full resize-none rounded-xl bg-white px-3.5 py-3 text-[16px] leading-6 outline-none"
              style={fieldStyle}
            />
          </label>

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
            <label className="block w-32 shrink-0">
              <span className="mb-1.5 block text-[13px] leading-4" style={{ color: INK_MUTED }}>Precio</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={fPrice}
                min={0}
                step={0.5}
                onChange={(e) => setFPrice(e.target.value)}
                className={`${field} tabular-nums`}
                style={fieldStyle}
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-[13px] leading-4" style={{ color: INK_MUTED }}>Categoría</span>
              <input
                type="text"
                placeholder="Ej. Bebidas"
                value={fCategory}
                list="menu-hub-categories"
                onChange={(e) => setFCategory(e.target.value)}
                className={field}
                style={fieldStyle}
              />
            </label>
            <datalist id="menu-hub-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Disponible: fila de 48 con interruptor en tinta */}
          <button
            type="button"
            role="switch"
            aria-checked={fAvailable}
            onClick={() => setFAvailable((v) => !v)}
            className="flex h-12 w-full items-center justify-between rounded-xl bg-white px-3.5 transition"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <span className="text-[15px]" style={{ color: INK }}>Disponible en el menú</span>
            <span
              className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              style={{ background: fAvailable ? INK : BORDER }}
            >
              <span
                className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                style={{ transform: fAvailable ? "translateX(22px)" : "translateX(2px)" }}
              />
            </span>
          </button>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null || !fName.trim()}
              className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: BRAND, color: INK }}
            >
              {busy === "save" ? "Guardando…" : "Guardar platillo"}
            </button>
            <button
              type="button"
              onClick={() => { if (!busy) onClose(); }}
              disabled={busy !== null}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              Cancelar
            </button>
          </div>

          {mode === "edit" && !confirmDelete && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={busy !== null}
                className="h-10 px-2 text-[14px] font-semibold hover:underline disabled:opacity-50"
                style={{ color: LINK }}
              >
                {busy === "duplicate" ? "Duplicando…" : "Duplicar platillo"}
              </button>
              <button
                type="button"
                onClick={() => { setModalError(null); setConfirmDelete(true); }}
                disabled={busy !== null}
                className="h-10 px-2 text-[14px] font-semibold hover:underline disabled:opacity-50"
                style={{ color: DANGER }}
              >
                Eliminar platillo
              </button>
            </div>
          )}

          {mode === "edit" && confirmDelete && (
            <div className="rounded-xl p-3.5" style={{ background: TILE }}>
              <p className="text-[14px] leading-[18px]" style={{ color: INK }}>
                ¿Eliminar “{item?.name}”? Esta acción no se puede deshacer.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ border: `1px solid ${DANGER}`, color: DANGER }}
                >
                  {busy === "delete" ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy !== null}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl text-[14px] font-semibold hover:underline disabled:opacity-50"
                  style={{ color: LINK }}
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
    <div className="flex min-h-screen items-center justify-center" style={{ background: CREAM }}>
      <svg className="h-6 w-6 animate-spin" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
      </svg>
    </div>
  );
}

function Spin({ light = false }: { light?: boolean }) {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin" style={{ color: light ? CREAM : INK }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
    </svg>
  );
}
