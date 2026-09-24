"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseApp } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness, wizardDoneKeys, evaluateReadiness } from "@/lib/vendorReadiness";

// must match hardFailRatio/bumpStartRatio in FOODPASS functions/reward_recommendation_core.js
const HARD_FAIL_RATIO = 0.20;
const BUMP_START_RATIO = 0.15;
// Piso del rango sano. Abajo de esto el premio es tan chico que no engancha.
const HEALTHY_MIN_RATIO = 0.10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  optionGroups?: Array<{
    name?: string;
    required?: boolean;
    options?: Array<{ name?: string; priceDelta?: number }>;
  }>;
}

/**
 * Si el platillo tiene tamaños, el premio es el tamaño BASE (el del precio
 * mostrado — así colapsan las familias). Sin decirlo, "Pepperoni ($100)"
 * con Personal/Grande arma pleito en el mostrador (cazado por Ricardo,
 * 26-ago): el cliente pide el Grande gratis y el staff no tiene respaldo.
 */
function etiquetaTamanoBase(item: MenuItem | undefined): string {
  const g = item?.optionGroups?.find(
    (x) => x.required && (x.options?.length ?? 0) > 1 &&
      (x.options ?? []).some((o) => (o.priceDelta ?? 0) > 0),
  );
  if (!g) return "";
  const base = (g.options ?? []).find((o) => (o.priceDelta ?? 0) === 0);
  return base?.name ? ` — tamaño ${base.name}` : "";
}

interface RewardTier {
  id?: string;
  pointsRequired: number;
  visitsRequired?: number; // back-compat
  menuItemId?: string;
  menuItemName: string;
  menuItemImageUrl?: string;
  menuItemDescription?: string;
  hasMenuItem: boolean;
}

interface FirstPurchaseReward {
  enabled: boolean;
  menuItemId?: string;
  menuItemName: string;
  menuItemImageUrl?: string;
  menuItemDescription?: string;
  pointsAwarded: number;
}

interface RewardDraft {
  id: string;
  firstPurchaseReward: FirstPurchaseReward;
  rewardTiers: RewardTier[];
  reasoning?: string;
}

type AiStep =
  | "idle"          // hasn't generated yet
  | "generating"    // CF running
  | "review"        // draft ready
  | "saving";       // applying

// ─── Piel Opción A (24-sep-2026) ─────────────────────────────────────────────
// Mismos tokens que Panel, Pedidos, Caja, Clientes y la página de
// Recompensas: crema + tinta, Lora solo en títulos, naranja solo en el
// botón principal (con tinta encima), sin sombras, sin emojis, sin eyebrows.
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
const WARN = "#B45309";
const WARN_SURFACE = "#FFFBEB";
const SUCCESS = "#15803D";
const DANGER = "#B91C1C";

/** Campo: 48px, blanco, borde, radio 12, letra 16 (evita el zoom del iPhone). */
const INPUT_CLS =
  "h-12 w-full rounded-xl border border-[#D9D2C5] bg-white px-3.5 text-[16px] text-[#1C2526] outline-none transition-colors placeholder:text-[#5B6366] focus:border-[#1C2526] disabled:opacity-50";
const BTN_PRIMARY =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#D9D2C5] bg-white px-3.5 text-[14px] font-semibold text-[#1C2526] transition hover:bg-[#FAF9F5] disabled:opacity-50";
const BTN_SECONDARY_STRONG =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1C2526] bg-white px-4 text-[14px] font-semibold text-[#1C2526] transition hover:bg-[#FAF9F5] disabled:opacity-50";
const BTN_TERTIARY = "inline-flex h-11 items-center justify-center text-[14px] font-semibold text-[#8A4B12] hover:underline disabled:opacity-50";

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconChevronDown() { return <svg {...ICON} stroke={INK_SOFT} aria-hidden><path d="M6 9l6 6 6-6" /></svg>; }
function IconGift() { return <svg {...ICON} stroke={INK_SOFT} aria-hidden><path d="M3.5 11h17v9.5h-17zM3 7.5h18V11H3zM12 7.5v13M12 7.5c-1.5-2.5-3.5-4-5-3s-.5 3 .5 3zM12 7.5c1.5-2.5 3.5-4 5-3s.5 3-.5 3z" /></svg>; }

/** Interruptor: pista tinta cuando está prendido, línea fina cuando no. */
function Switch({ on }: { on: boolean }) {
  return (
    <span className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: on ? INK : HAIRLINE }} aria-hidden>
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: on ? "22px" : "2px", border: on ? "none" : `1px solid ${BORDER}` }}
      />
    </span>
  );
}

/** Encabezado de sección con interruptor: título 15/600 a la izquierda,
 *  switch a la derecha. Toda la fila es el botón (toque de 48px). */
function SwitchHeader({ on, onToggle, title, caption }: { on: boolean; onToggle: () => void; title: string; caption?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex min-h-12 w-full items-center justify-between gap-4 py-1 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-5" style={{ color: INK }}>{title}</span>
        {caption ? <span className="mt-0.5 block text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>{caption}</span> : null}
      </span>
      <Switch on={on} />
    </button>
  );
}

/** Select con la misma anatomía que el campo: 48px, borde, chevron de trazo. */
function SelectField({ value, onChange, children, ariaLabel }: { value: string; onChange: (v: string) => void; children: React.ReactNode; ariaLabel: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`${INPUT_CLS} appearance-none pr-10`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"><IconChevronDown /></span>
    </div>
  );
}

/** Vista previa "Así lo ve tu cliente": miniatura 40, nombre 15, pastilla tile. */
function ClientPreview({ foto, name, description, pill }: { foto?: string; name: string; description?: string; pill: string }) {
  return (
    <div className="mt-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <p className="mt-3 text-[13px] leading-4" style={{ color: INK_SOFT }}>Así lo ve tu cliente</p>
      <div className="mt-2 flex items-center gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: TILE }}><IconGift /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-5" style={{ color: INK }}>{name}</p>
          {description ? <p className="mt-0.5 line-clamp-1 text-[13px] leading-4" style={{ color: INK_SOFT }}>{description}</p> : null}
        </div>
        <span className="inline-flex h-[24px] shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold tabular-nums" style={{ background: TILE, color: INK_MUTED }}>{pill}</span>
      </div>
    </div>
  );
}

/** Hoja de confirmación: blanco, borde, radio 12; título Lora 17; principal
 *  naranja con tinta y terciario como link. */
function ConfirmSheet({ title, children, primaryLabel, onPrimary, secondaryLabel, onSecondary, busy = false }: {
  title: string;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" style={{ background: "rgba(28,37,38,0.5)" }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
        <h3 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>{title}</h3>
        <p className="mt-2 text-[14px] leading-5" style={{ color: INK_MUTED }}>{children}</p>
        <button type="button" disabled={busy} onClick={onPrimary} className={`${BTN_PRIMARY} mt-5`} style={{ background: BRAND }}>
          {primaryLabel}
        </button>
        <div className="mt-1 flex justify-center">
          <button type="button" disabled={busy} onClick={onSecondary} className={BTN_TERTIARY}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RecompensasSetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWizard = searchParams.get("wizard") === "1";
  // Quien llega desde la página de Recompensas del panel debe VOLVER ahí —
  // Volver y Guardar lo aventaban a /vendor/setup, otro mundo (cazado por
  // Ricardo, 1-sep). El botón Editar ya mandaba ?from=recompensas; ahora sí
  // se escucha.
  // 9-sep: en /vendor/recompensas/editar el editor vive DENTRO del panel
  // (sidebar): sin su propio encabezado "← Volver" y al guardar o descartar
  // regresa a /vendor/recompensas, no al setup (mismo patrón que /vendor/menu).
  const inPanel = usePathname() === "/vendor/recompensas/editar";
  const cameFromPanel = inPanel || searchParams.get("from") === "recompensas";
  const backHref = cameFromPanel ? "/vendor/recompensas" : "/vendor/setup";
  // born=demo: el claim disparó la generación de la IA hace SEGUNDOS y el
  // dueño llega aquí más rápido que el borrador. Sin esto veía el formulario
  // vacío ("-- Selecciona un platillo --") justo después de la promesa "la
  // IA ya te preparó una propuesta", picaba ← Panel y nacía un atorado —
  // el race que fabricó el muro #1 (cazado en vivo, 1-sep).
  const bornFromDemo = searchParams.get("born") === "demo";

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [stepperDone, setStepperDone] = useState<Array<"horario" | "menu"> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [spendStepAmount, setSpendStepAmount] = useState<number>(30);

  // Current rewards (pre-existing or after apply)
  const [currentFPR, setCurrentFPR] = useState<FirstPurchaseReward>({
    enabled: true,
    menuItemId: "",
    menuItemName: "",
    menuItemImageUrl: "",
    menuItemDescription: "",
    pointsAwarded: 100,
  });
  const [currentTiers, setCurrentTiers] = useState<RewardTier[]>([
    { pointsRequired: 30, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
    { pointsRequired: 70, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
    { pointsRequired: 120, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
  ]);

  // AI recommendation state
  const [aiStep, setAiStep] = useState<AiStep>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Atajada al salir con la propuesta sin aplicar (muro #1 del embudo, 1-sep):
  // el "← Panel" sigue existiendo — solo pregunta UNA vez antes de dejar ir.
  const [showExitOffer, setShowExitOffer] = useState(false);

  // Apagar cuesta una pantalla, no el negocio (decisión 2-sep): el toggle
  // de bienvenida y el ÚLTIMO premio por puntos preguntan una vez, con el
  // argumento del dueño, antes de apagarse. Prender jamás pregunta.
  const [offAsk, setOffAsk] = useState<null | { kind: "welcome" } | { kind: "tier"; index: number }>(null);

  // El doc vivo del restaurante, para calcular con el MISMO evaluador de
  // readiness qué pasa si apaga algo — la consecuencia nunca se escribe a
  // mano aquí: cuando la bienvenida deje de bloquear `active`, la frase
  // desaparece sola.
  const [restaurantData, setRestaurantData] = useState<Record<string, unknown> | null>(null);

  // El error de guardado se limpia en cuanto el usuario edita algo.
  // Antes se quedaba pegado hasta el siguiente guardado exitoso y
  // hacia ver como si ajustar los puntos no sirviera de nada.
  useEffect(() => { setError(null); }, [currentTiers, currentFPR]);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar?modo=entrar"); return; }

      // Load existing menu items
      const menuSnap = await getDocs(collection(db, "restaurants", rid, "menu"));
      const items = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
      setMenuItems(items);

      const rSnap = await getDoc(doc(db, "restaurants", rid));
      const data = rSnap.data();
      setRestaurantData((data ?? {}) as Record<string, unknown>);
      setStepperDone(wizardDoneKeys(data?.setupIncompleteReasons));

      const loyaltyEarnPolicy = data?.loyaltyEarnPolicy as any;
      if (loyaltyEarnPolicy && typeof loyaltyEarnPolicy.spendStepAmount === "number" && loyaltyEarnPolicy.spendStepAmount > 0) {
        setSpendStepAmount(loyaltyEarnPolicy.spendStepAmount);
      }

      let hasRewards = false;
      if (data?.firstPurchaseReward) {
        const fpr = data.firstPurchaseReward as any;
        if (fpr.menuItemId && fpr.enabled) {
          setCurrentFPR({
            enabled: fpr.enabled ?? true,
            menuItemId: fpr.menuItemId ?? "",
            menuItemName: fpr.menuItemName ?? "",
            menuItemImageUrl: fpr.menuItemImageUrl ?? "",
            menuItemDescription: fpr.menuItemDescription ?? "",
            pointsAwarded: fpr.pointsAwarded ?? 0,
          });
          hasRewards = true;
        }
      }
      if (Array.isArray(data?.rewardTiers) && (data.rewardTiers as any[]).length > 0) {
        const mapped = (data.rewardTiers as any[]).map((t, index) => ({
          id: t.id ?? `tier_${index + 1}`,
          pointsRequired: t.pointsRequired ?? t.visitsRequired ?? 0,
          visitsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
          menuItemId: t.menuItemId ?? "",
          menuItemName: t.menuItemName ?? "",
          menuItemDescription: t.menuItemDescription ?? "",
          menuItemImageUrl: t.menuItemImageUrl ?? "",
          hasMenuItem: t.hasMenuItem ?? !!t.menuItemId,
        }));
        setCurrentTiers(mapped);
        if (mapped.some(t => t.menuItemId && t.hasMenuItem)) {
          hasRewards = true;
        }
      }

      // Check for latest draft recommendation
      const draftsSnap = await getDocs(
        query(
          collection(db, "restaurants", rid, "rewardRecommendationDrafts"),
          orderBy("createdAt", "desc"),
          limit(1)
        )
      );
      // El borrador del claim aún no aterriza: escuchar con el mismo
      // mecanismo de "Armarlos por mí" (listener + timeout de 120s) en vez
      // de enseñar el formulario vacío. Cuando el borrador cae, se llena
      // solo frente a sus ojos.
      if (draftsSnap.empty && bornFromDemo && !hasRewards) {
        setAiStep("generating");
      }
      if (!draftsSnap.empty) {
        const d = draftsSnap.docs[0];
        const draftData = d.data();
        if (draftData.status === "draft" || draftData.status === "ready") {
          const fpr = draftData.proposedFirstPurchaseReward || draftData.firstPurchaseReward;
          const tiers = draftData.proposedRewardTiers || draftData.rewardTiers || [];
          const notes = draftData.proposedNotes || draftData.reasoning || "";

          // Auto-populate the form if the restaurant has no existing rewards
          if (!hasRewards) {
            if (fpr) {
              setCurrentFPR({
                enabled: fpr.enabled ?? true,
                menuItemId: fpr.menuItemId ?? "",
                menuItemName: fpr.menuItemName ?? "",
                menuItemImageUrl: fpr.menuItemImageUrl ?? "",
                menuItemDescription: fpr.menuItemDescription ?? "",
                pointsAwarded: fpr.pointsAwarded ?? 100,
              });
            }
            if (tiers.length > 0) {
              setCurrentTiers((tiers as any[]).map((t, idx) => ({
                id: t.id ?? `tier_${idx + 1}`,
                pointsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
                visitsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
                menuItemId: t.menuItemId ?? "",
                menuItemName: t.menuItemName ?? "",
                menuItemDescription: t.menuItemDescription ?? "",
                menuItemImageUrl: t.menuItemImageUrl ?? "",
                hasMenuItem: !!t.menuItemId,
              })));
            }
            setAiApplied(true);
          }
          setAiReasoning(notes);
          setActiveDraftId(d.id);
        }
      }

      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  // Listen for AI draft once generating
  useEffect(() => {
    if (aiStep !== "generating" || !restaurantId) return;
    const db = getFirebaseDb();

    let settled = false;

    // Safety net: ONLY for the case where generation silently dies and never
    // writes a draft/failed doc. The server callable (generateRewardDraft) has a
    // 90s timeout, so we wait past that (120s) — a normal generation resolves
    // well before this and is unaffected. This only trips when the server is
    // truly dead, so it can't false-alarm on a slow-but-working draft.
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      setAiError("No pudimos armar la propuesta a tiempo. Vuelve a intentar o ponlos a mano.");
      setAiStep("idle");
    }, 120_000);

    const unsub = onSnapshot(
      query(
        collection(db, "restaurants", restaurantId, "rewardRecommendationDrafts"),
        orderBy("createdAt", "desc"),
        limit(1)
      ),
      (snap) => {
        if (snap.empty) return;
        const d = snap.docs[0];
        const data = d.data();

        // CF writes status as 'draft' or 'failed', keys are prefixed with 'proposed'.
        // Un borrador ya cerrado (superseded / dismissed / applied) NO es éxito:
        // al "Regenerar", el primer snapshot trae el borrador viejo recién
        // reemplazado y lo volvía a pintar como si fuera el nuevo (cazado 9-sep).
        const closed = data.status === "superseded" || data.status === "dismissed" || data.status === "applied";
        if (closed) return; // esperar al borrador nuevo
        const isSuccess = data.status === "draft" || data.status === "ready" || (!data.status && (data.firstPurchaseReward || data.proposedFirstPurchaseReward));
        const isFailed = data.status === "failed" || data.status === "error";

        if (isSuccess) {
          const fpr = data.proposedFirstPurchaseReward || data.firstPurchaseReward;
          const tiers = data.proposedRewardTiers || data.rewardTiers || [];
          const notes = data.proposedNotes || data.reasoning || "";

          // Auto-populate the form directly
          setCurrentFPR({
            enabled: fpr.enabled ?? true,
            menuItemId: fpr.menuItemId ?? "",
            menuItemName: fpr.menuItemName ?? "",
            menuItemImageUrl: fpr.menuItemImageUrl ?? "",
            menuItemDescription: fpr.menuItemDescription ?? "",
            pointsAwarded: fpr.pointsAwarded ?? 0,
          });

          setCurrentTiers((tiers as any[]).map((t, idx) => ({
            id: t.id ?? `tier_${idx + 1}`,
            pointsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
            visitsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
            menuItemId: t.menuItemId ?? "",
            menuItemName: t.menuItemName ?? "",
            menuItemDescription: t.menuItemDescription ?? "",
            menuItemImageUrl: t.menuItemImageUrl ?? "",
            hasMenuItem: !!t.menuItemId,
          })));

          setAiReasoning(notes);
          setActiveDraftId(d.id);
          setAiApplied(true);
          settled = true;
          clearTimeout(timeoutId);
          setAiStep("idle");
        } else if (isFailed) {
          settled = true;
          clearTimeout(timeoutId);
          setAiError("No pudimos armar la propuesta ahora. Ponlos a mano.");
          setAiStep("idle");
        }
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAiError("Se perdió la conexión. Vuelve a intentar o ponlos a mano.");
        setAiStep("idle");
      }
    );
    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [aiStep, restaurantId]);

  async function handleGenerateDraft() {
    if (!restaurantId) return;
    setAiError(null);
    setAiStep("generating");
    try {
      // "Regenerar" con un borrador abierto: el servidor contesta "existing"
      // y NO genera (cazado 9-sep: botón muerto sin decir nada). El borrador
      // viejo se marca reemplazado y se pide uno nuevo — el loop cerrado
      // (applied / dismissed / superseded) sigue midiendo la aceptación.
      if (activeDraftId) {
        const db = getFirebaseDb();
        const { updateDoc, serverTimestamp } = await import("firebase/firestore");
        // Las rules solo dejan al cliente tocar status + updatedAt
        // (rewardRecommendationDraftClientUpdateOnly): ni un campo más.
        await updateDoc(doc(db, "restaurants", restaurantId, "rewardRecommendationDrafts", activeDraftId), {
          status: "superseded",
          updatedAt: serverTimestamp(),
        });
        setActiveDraftId(null);
      }
      const functions = getFunctions(getFirebaseApp(), "us-central1");
      const generateRewardDraft = httpsCallable(functions, "generateRewardDraft");
      const res = await generateRewardDraft({ restaurantId });
      const resultData = res.data as { status: string; reason?: string };
      if (resultData?.status === "existing") {
        setAiError("Ya hay una propuesta abierta. Descártala para pedir otra.");
        setAiStep("idle");
      }
      if (resultData?.status === "skipped") {
        if (resultData.reason === "insufficient_menu_items") {
          setAiError("Agrega al menos 2 platillos a tu menú para que te propongamos premios.");
        } else if (resultData.reason === "rate_limited") {
          setAiError("Ya pediste muchas propuestas hoy. Intenta más tarde.");
        } else {
          setAiError("No pudimos armar la propuesta ahora. Ponlos a mano.");
        }
        setAiStep("idle");
      }
    } catch (e) {
      console.error(e);
      setAiError("No pudimos conectar. Ponlos a mano.");
      setAiStep("idle");
    }
  }

  async function handleDismissDraft() {
    if (!restaurantId || !activeDraftId) return;
    try {
      const db = getFirebaseDb();
      const { updateDoc } = await import("firebase/firestore");
      // El "no me latió" también se mide (loop cerrado): con applied vs
      // dismissed sale la tasa de aceptación de la IA de premios. Las rules
      // solo dejan al cliente tocar status + updatedAt — `dismissedAt` hacía
      // que ESTE botón fallara con "insufficient permissions" (cazado 9-sep);
      // updatedAt ya es la fecha del descarte.
      await updateDoc(doc(db, "restaurants", restaurantId, "rewardRecommendationDrafts", activeDraftId), {
        status: "dismissed",
        updatedAt: (await import("firebase/firestore")).serverTimestamp(),
      });
      setCurrentFPR({
        enabled: true,
        menuItemId: "",
        menuItemName: "",
        menuItemImageUrl: "",
        menuItemDescription: "",
        pointsAwarded: 100,
      });
      setCurrentTiers([
        { pointsRequired: 30, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
        { pointsRequired: 70, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
        { pointsRequired: 120, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
      ]);
      setAiReasoning(null);
      setActiveDraftId(null);
      setAiApplied(false);
      // Dentro del panel, descartar cierra la puerta: de vuelta a la página
      // de Recompensas (ahí ya no hay borrador y se ofrece armarlos a mano).
      if (inPanel) router.push("/vendor/recompensas");
    } catch (e) {
      console.error(e);
    }
  }

  const getTierValidation = (tier: RewardTier) => {
    if (!tier.hasMenuItem || !tier.menuItemId) return null;
    
    // Skip welcome / first-visit reward
    if (tier.pointsRequired <= 0 || tier.id === "tier_welcome") {
      return null;
    }

    const item = menuItems.find((m) => m.id === tier.menuItemId);
    // Skip if item has no price or <= 0
    if (!item || typeof item.price !== "number" || item.price <= 0) {
      return null;
    }

    const ratio = item.price / (tier.pointsRequired * spendStepAmount);

    const pct = Math.round(ratio * 100);
    const maxPct = Math.round(BUMP_START_RATIO * 100);
    const minPct = Math.round(HEALTHY_MIN_RATIO * 100);
    // Rango de puntos que deja el premio dentro del rango sano.
    // Menos puntos = regalas mas; mas puntos = regalas menos.
    const pocosPuntos = Math.ceil(item.price / (BUMP_START_RATIO * spendStepAmount));
    // floor, no ceil: con ceil el tope alto caía 1 punto FUERA del 10% (un
    // refresco de $28 daba 10 pts = 9.3%) y el propio consejo se contradecía.
    // Misma regla que applyHealthyBandFinalPass en el servidor (9-sep).
    const muchosPuntos = Math.max(pocosPuntos, Math.floor(item.price / (HEALTHY_MIN_RATIO * spendStepAmount)));
    // El consejo trae su arreglo: el punto medio del rango sano, en número
    // redondo. Antes la advertencia le dejaba la matemática al dueño ("ponlo
    // entre 23 y 34") y NADIE la hacía — hasta Luzz tenía 2 premios fuera de
    // rango (cazado por Ricardo, 1-sep).
    let fixPoints = Math.round((pocosPuntos + muchosPuntos) / 2 / 5) * 5;
    if (fixPoints < pocosPuntos) fixPoints = pocosPuntos;
    if (fixPoints > muchosPuntos) fixPoints = muchosPuntos;
    // Que el arreglo no choque con otro premio (dos premios a los mismos
    // puntos rompen la escalerita): esquiva hacia arriba dentro del rango
    // sano, y si no cabe, hacia abajo.
    const otherPoints = new Set(
      currentTiers.filter((t) => t !== tier && t.hasMenuItem).map((t) => t.pointsRequired),
    );
    let up = fixPoints;
    while (otherPoints.has(up) && up + 5 <= muchosPuntos) up += 5;
    if (otherPoints.has(up)) {
      let down = fixPoints;
      while (otherPoints.has(down) && down - 5 >= pocosPuntos) down -= 5;
      if (!otherPoints.has(down)) up = down;
    }
    fixPoints = up;

    if (ratio > HARD_FAIL_RATIO + 1e-12) {
      return {
        type: "error" as const,
        fixPoints,
        message:
          `Así te cuesta de más: a ${tier.pointsRequired} puntos regalas el ${pct}% ` +
          `de lo que gasta tu cliente. Lo sano es ${minPct}%–${maxPct}%.`,
      };
    }
    if (ratio > BUMP_START_RATIO + 1e-12) {
      return {
        type: "warning" as const,
        fixPoints,
        message:
          `Un poco caro: a ${tier.pointsRequired} puntos regalas el ${pct}% ` +
          `de lo que gasta tu cliente. Lo sano es ${minPct}%–${maxPct}%.`,
      };
    }
    if (ratio < HEALTHY_MIN_RATIO - 1e-12) {
      return {
        type: "info" as const,
        fixPoints,
        message:
          `Así el premio tarda mucho en llegar: regalas solo el ${pct}% de lo que ` +
          `gasta tu cliente, y se puede aburrir antes de ganarlo. Lo sano es ${minPct}%–${maxPct}%.`,
      };
    }
    return {
      type: "ok" as const,
      message: `Bien puesto: regalas el ${pct}% de lo que gasta tu cliente, dentro de lo sano (${minPct}%–${maxPct}%).`,
    };
  };

  async function handleSave(exitTo?: string) {
    if (!restaurantId) return;

    // Todo apagado A PROPÓSITO se guarda tal cual (2-sep). Un formulario
    // vacío porque nunca se armó sigue pidiendo un premio.
    const allOff = !formHasContent;
    if (allOff && !formIsDeliberatelyOff) {
      setError("Prende al menos un premio por puntos — es lo que tus clientes van a perseguir.");
      return;
    }

    if (!allOff) {
      // Validate first purchase reward
      if (currentFPR.enabled && !currentFPR.menuItemId) {
        setError("Selecciona un platillo del menú para la recompensa de bienvenida.");
        return;
      }
      // Con bienvenida prendida y cero premios por puntos, el servidor
      // rechaza la lista vacía — mejor decirlo en cristiano que tronar
      // (QA de Ricardo, 1-sep).
      if (!currentTiers.some((t) => t.hasMenuItem && t.menuItemId)) {
        setError("Prende al menos un premio por puntos — es lo que tus clientes van a perseguir.");
        return;
      }
      if (currentTiers.some((t) => t.hasMenuItem && !t.menuItemId)) {
        setError("Selecciona un platillo del menú para todos los niveles activos.");
        return;
      }

      // Economics Safeguard Validation
      for (const tier of currentTiers) {
        const val = getTierValidation(tier);
        if (val && val.type === "error") {
          setError(val.message);
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      const functions = getFunctions(getFirebaseApp(), "us-central1");

      // Map rewardTiers pointsRequired -> visitsRequired and ensure id/menuItemId are correctly populated
      const mappedTiers = currentTiers.map((t, idx) => ({
        id: t.id || `tier_${idx + 1}`,
        visitsRequired: t.pointsRequired,
        pointsRequired: t.pointsRequired,
        menuItemId: t.menuItemId || null,
        menuItemName: t.menuItemName || null,
        menuItemImageUrl: t.menuItemImageUrl || null,
        menuItemDescription: t.menuItemDescription || null,
        hasMenuItem: !!t.menuItemId,
      }));

      const mappedFPR = {
        enabled: currentFPR.enabled,
        menuItemId: currentFPR.menuItemId || null,
        menuItemName: currentFPR.menuItemName || null,
        menuItemImageUrl: currentFPR.menuItemImageUrl || null,
        menuItemDescription: currentFPR.menuItemDescription || null,
        pointsAwarded: currentFPR.pointsAwarded,
      };

      if (allOff) {
        // Apagado a propósito: applyRewardDraft rechaza una lista vacía, así
        // que se escribe directo. El borrador se queda como propuesta viva
        // (el panel se lo recuerda) por si cambia de opinión.
        const { updateDoc, serverTimestamp } = await import("firebase/firestore");
        await updateDoc(doc(getFirebaseDb(), "restaurants", restaurantId), {
          firstPurchaseReward: { ...mappedFPR, enabled: false },
          rewardTiers: [],
          rewardsConfigured: true,
          lastUpdated: serverTimestamp(),
        });
      } else if (activeDraftId) {
        const applyRewardDraft = httpsCallable(functions, "applyRewardDraft");
        await applyRewardDraft({
          restaurantId,
          draftId: activeDraftId,
          firstPurchaseReward: mappedFPR,
          rewardTiers: mappedTiers.filter((t) => t.hasMenuItem),
        });
      } else {
        // No draft — save directly to Firestore
        const { updateDoc } = await import("firebase/firestore");
        const { serverTimestamp } = await import("firebase/firestore");
        const db = getFirebaseDb();
        await updateDoc(doc(db, "restaurants", restaurantId), {
          firstPurchaseReward: mappedFPR,
          rewardTiers: mappedTiers,
          rewardsConfigured: true,
          lastUpdated: serverTimestamp(),
        });
      }

      const readiness = await persistReadiness(restaurantId);
      setSaved(true);
      // Sin premios no hay festejo: de vuelta al panel, donde el consejo
      // le dice con sus números lo que eso significa.
      if (allOff) {
        setTimeout(() => router.push(exitTo ?? backHref), 800);
        return;
      }
      // El festejo se GANA (espejo del fix de la app, 1-sep): el camino del
      // demo brinca horario (claim → premios), así que el dueño llegaba a
      // "¡está listo!" SIN horario y con el escáner apagado — así se
      // atoraron KAMPAI, YUZU, Taco caliente y TEJABAN en business_hours.
      // Si falta horario, el wizard lo lleva ahí; el festejo espera al final.
      const faltaHorario = !!readiness?.reasons?.includes("business_hours");
      const wizardTarget = faltaHorario
        ? "/vendor/setup/horario?wizard=1"
        : "/vendor/setup/done";
      setTimeout(() => router.push(exitTo ?? (isWizard ? wizardTarget : backHref)), 800);
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar. Intenta de nuevo.");
      setShowExitOffer(false);
    } finally {
      setSaving(false);
    }
  }

  // ¿El formulario tiene algo PRENDIDO que guardar? Gobierna quién es el rey
  // de la página: vacío → "Armarlos por mí"; con contenido → "Guardar mis
  // premios". Cuenta solo lo ENCENDIDO: con todo apagado el guardado moriría
  // en el servidor con lista vacía (QA de Ricardo, 1-sep) — mejor apagar el
  // botón que tronar con error genérico.
  const formHasContent =
    (currentFPR.enabled && !!currentFPR.menuItemId) ||
    currentTiers.some((t) => t.hasMenuItem && t.menuItemId);

  // ¿Está vacío porque nunca se armó, o porque el dueño APAGÓ lo que ya
  // tenía? Lo segundo es una decisión suya y se puede guardar (2-sep):
  // antes "todo apagado" dejaba Guardar muerto y la página no decía nada.
  const formIsDeliberatelyOff =
    !formHasContent &&
    (!!currentFPR.menuItemId || currentTiers.some((t) => !!t.menuItemId));

  const anyTierOn = currentTiers.some((t) => t.hasMenuItem && t.menuItemId);

  /**
   * ¿Quedaría SIN nada que ganar con este parche? Desde el 5-sep apagar
   * premios ya no degrada a `setup` (guardar la pantalla es la decisión del
   * dueño: `rewardsConfigured`), pero sí deja el escáner en pausa y saca al
   * local de la lista de puntos de la app. Eso es lo que la hoja avisa. Se
   * calcula con evaluateReadiness, la misma verdad que decide `active`.
   */
  function loyaltyOffIf(patch: Record<string, unknown>): boolean {
    if (!restaurantData) return false;
    return !evaluateReadiness(
      { ...restaurantData, ...patch, rewardsConfigured: true },
      menuItems.length,
    ).loyaltyReady;
  }
  const formAsRestaurantPatch = {
    firstPurchaseReward: { enabled: currentFPR.enabled, menuItemId: currentFPR.menuItemId || null },
    rewardTiers: currentTiers
      .filter((t) => t.hasMenuItem && t.menuItemId)
      .map((t) => ({ menuItemId: t.menuItemId, visitsRequired: t.pointsRequired })),
  };
  // ¿Lo apagado, tal como está el formulario, deja el escáner en pausa?
  const rewardsOffBlocksNow = loyaltyOffIf(formAsRestaurantPatch);
  const welcomeOffWouldBlock = loyaltyOffIf({
    ...formAsRestaurantPatch,
    firstPurchaseReward: { enabled: false, menuItemId: null },
  });
  const tiersOffWouldBlock = loyaltyOffIf({ ...formAsRestaurantPatch, rewardTiers: [] });

  function flipTier(i: number) {
    const updated = [...currentTiers];
    updated[i] = { ...updated[i], hasMenuItem: !updated[i].hasMenuItem };
    setCurrentTiers(updated);
  }
  function requestWelcomeToggle() {
    if (!currentFPR.enabled) {
      setCurrentFPR((f) => ({ ...f, enabled: true }));
      return;
    }
    setOffAsk({ kind: "welcome" });
  }
  function requestTierToggle(i: number) {
    const tier = currentTiers[i];
    const othersOn = currentTiers.some((t, j) => j !== i && t.hasMenuItem && t.menuItemId);
    if (tier.hasMenuItem && !!tier.menuItemId && !othersOn) {
      setOffAsk({ kind: "tier", index: i });
      return;
    }
    flipTier(i);
  }
  function confirmOff() {
    if (!offAsk) return;
    if (offAsk.kind === "welcome") setCurrentFPR((f) => ({ ...f, enabled: false }));
    else flipTier(offAsk.index);
    setOffAsk(null);
  }

  // ¿Vale la pena atajar la salida? Solo si hay una propuesta cargada que aún
  // no se guarda y el formulario está completo (un tap la deja publicada).
  const exitOfferAvailable =
    !!activeDraftId && aiApplied && !saved &&
    !!currentFPR.menuItemId &&
    currentTiers.some((t) => t.hasMenuItem && t.menuItemId);

  function handlePanelExit() {
    if (exitOfferAvailable) {
      setShowExitOffer(true);
      return;
    }
    router.push("/vendor");
  }

  if (loading) return <Spinner />;

  const menuOptions = menuItems.map((item) => (
    <option key={item.id} value={item.id}>
      {item.name}{etiquetaTamanoBase(item)} (${item.price.toFixed(2)})
    </option>
  ));

  return (
    <div className={inPanel ? "bg-[#faf9f5]" : "min-h-screen bg-[#faf9f5]"}>
      {/* Nav */}
      {inPanel ? null : (
      <div className="sticky top-0 z-10" style={{ background: CREAM }}>
        {isWizard ? (
          <WizardStepper current="rewards" doneKeys={stepperDone} onPanelClick={handlePanelExit} />
        ) : (
          <div className="px-5 py-3 sm:px-6" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <div className="mx-auto flex max-w-lg items-center">
              <Link href={backHref} className="flex h-9 items-center text-[13px] font-semibold hover:underline" style={{ color: LINK }}>
                Volver
              </Link>
            </div>
          </div>
        )}
      </div>
      )}

      {showExitOffer && (
        <ConfirmSheet
          title="Tus premios ya están listos"
          primaryLabel={saving ? "Guardando…" : "Guardarlos y salir"}
          onPrimary={() => handleSave("/vendor")}
          secondaryLabel="Salir sin premios"
          onSecondary={() => router.push("/vendor")}
          busy={saving}
        >
          Los armamos con tu menú. Si sales sin guardarlos, tu programa de
          puntos queda apagado y tus clientes no ganan nada todavía.
        </ConfirmSheet>
      )}

      {offAsk && (
        <ConfirmSheet
          title={offAsk.kind === "welcome" ? "¿Apagar la bienvenida?" : "¿Apagar tu último premio?"}
          primaryLabel={offAsk.kind === "welcome" ? "Mejor la dejo" : "Mejor lo dejo"}
          onPrimary={() => setOffAsk(null)}
          secondaryLabel="Apagar de todos modos"
          onSecondary={confirmOff}
        >
          {offAsk.kind === "welcome"
            ? "Se regala en la segunda visita, nunca en la misma. Sin regalo, tu cliente escanea una vez y no vuelve."
            : "Sin ningún premio, los puntos que juntan tus clientes no valen nada. Y el premio es la razón por la que te dan su número en la caja."}
          {(offAsk.kind === "welcome" ? welcomeOffWouldBlock : tiersOffWouldBlock) && (
            <> Y mientras siga así, tu local no sale en la app y el escáner queda en pausa. Tu Caja, tu menú y tu QR siguen igual.</>
          )}
        </ConfirmSheet>
      )}

      {/* En el panel (escritorio) la columna angosta se veía apretada en medio
          (Ricardo, 24-sep): ahí va alineada a la izquierda y más ancha, y los
          premios en dos columnas. En el wizard sigue la columna centrada. */}
      <main className={inPanel ? "max-w-3xl space-y-7 px-5 pb-24 pt-5 md:px-8 md:pt-7" : "mx-auto max-w-lg space-y-7 px-5 pb-24 pt-5 sm:px-6 md:pt-7"}>
        {/* Título de pantalla (Lora 22) + caption + cómo se ganan los puntos */}
        <div>
          <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Recompensas</h1>
          <p className="mt-0.5 text-[13px] leading-4" style={{ color: INK_SOFT }}>Lo que tus clientes ganan por regresar</p>
          <p className="mt-3 text-[13px] leading-[18px] tabular-nums" style={{ color: INK_SOFT }}>
            Tus clientes ganan 1 punto por visita más 1 punto por cada ${spendStepAmount} que gastan.
            Así que ${(spendStepAmount * 10).toLocaleString("es-MX")} gastados ≈ 10 puntos.
          </p>
        </div>

        {error && (
          <p className="text-[14px] font-semibold leading-5" style={{ color: DANGER }} role="alert">{error}</p>
        )}

        {/* ── Te sugerimos tus premios ──
            UN trono por estado (regla del festejo, 1-sep): con el formulario
            VACÍO el rey es "Armarlos por mí" y Guardar se apaga; con contenido,
            Guardar es el rey y la propuesta queda de escudera ("Pedir otra"). */}
        <section>
          {/* A 390px el título y "Pedir otra propuesta" no caben en una fila:
              el botón baja a la siguiente línea en vez de aplastar el título. */}
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
            <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
              {aiApplied ? "Te sugerimos estos premios" : "Te sugerimos tus premios"}
            </h2>
            {aiStep === "idle" && formHasContent && (
              <button type="button" onClick={handleGenerateDraft} className={BTN_SECONDARY}>
                Pedir otra propuesta
              </button>
            )}
          </div>
          <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
            {aiApplied
              ? "Comeleal los propuso con tu menú. Revísalos y ajústalos si quieres antes de guardar."
              : "Comeleal te propone premios con lo que hay en tu menú. Tú solo los apruebas."}
          </p>

          {aiStep === "idle" && !formHasContent && (
            <button type="button" onClick={handleGenerateDraft} className={`${BTN_SECONDARY_STRONG} mt-3`}>
              Armarlos por mí
            </button>
          )}

          {aiStep === "generating" && (
            <div className="mt-3 flex items-center gap-2.5 text-[14px]" style={{ color: INK_MUTED }}>
              <Spin />
              <span>Leyendo tu menú…</span>
            </div>
          )}

          {aiError && (
            <p className="mt-3 text-[14px] font-semibold leading-5" style={{ color: DANGER }} role="alert">{aiError}</p>
          )}

          {aiReasoning && (
            <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: TILE }}>
              <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>Por qué estos</p>
              <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>{aiReasoning}</p>
            </div>
          )}
        </section>

        {/* ── Editor ── */}
        <div className="space-y-7">
          {/* Lo apagado dice lo que significa — antes la página se quedaba muda. */}
          {(!currentFPR.enabled || !anyTierOn) && (
            <div className="space-y-1 rounded-xl px-4 py-3 text-[14px] leading-5" style={{ background: WARN_SURFACE, color: WARN }}>
              {!currentFPR.enabled && (
                <p>Bienvenida apagada: tus clientes nuevos no tienen un regalo que los haga volver.</p>
              )}
              {!anyTierOn && (
                <p>Sin premios por puntos: lo que juntan tus clientes hoy no vale nada.</p>
              )}
              {rewardsOffBlocksNow && (
                <p className="font-semibold">Así, tu local no sale en la app y el escáner queda en pausa. Tu Caja, tu menú y tu QR siguen igual.</p>
              )}
            </div>
          )}

          {/* Bienvenida */}
          <section>
            <SwitchHeader
              on={currentFPR.enabled}
              onToggle={requestWelcomeToggle}
              title="Bienvenida"
              caption="Se desbloquea en la 1ª visita y se regala en la 2ª. Así se hace el hábito de regresar."
            />
            {currentFPR.enabled && (
              <div className="mt-2 space-y-3 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
                <SelectField
                  ariaLabel="Platillo de bienvenida"
                  value={currentFPR.menuItemId || ""}
                  onChange={(selectedId) => {
                    const item = menuItems.find((m) => m.id === selectedId);
                    if (item) {
                      setCurrentFPR((f) => ({
                        ...f,
                        menuItemId: item.id,
                        menuItemName: item.name,
                        menuItemDescription: item.description ?? "",
                        menuItemImageUrl: item.imageUrl ?? "",
                      }));
                    } else {
                      setCurrentFPR((f) => ({
                        ...f,
                        menuItemId: "",
                        menuItemName: "",
                        menuItemDescription: "",
                        menuItemImageUrl: "",
                      }));
                    }
                  }}
                >
                  <option value="">Elige un platillo del menú</option>
                  {menuOptions}
                </SelectField>
                {currentFPR.menuItemId && (
                  <input
                    type="text"
                    placeholder="Texto que ve tu cliente (opcional)"
                    value={currentFPR.menuItemDescription ?? ""}
                    onChange={(e) => setCurrentFPR((f) => ({ ...f, menuItemDescription: e.target.value }))}
                    className={INPUT_CLS}
                  />
                )}
                {currentFPR.menuItemId && (
                  <ClientPreview
                    // La foto sale del MENÚ vivo: los premios aplicados por
                    // la propuesta se guardan con imageUrl null aunque el
                    // platillo sí tenga foto (cazado por Ricardo, 1-sep).
                    foto={currentFPR.menuItemImageUrl || menuItems.find((m) => m.id === currentFPR.menuItemId)?.imageUrl}
                    name={currentFPR.menuItemName}
                    pill="GRATIS en su 2ª visita"
                  />
                )}
              </div>
            )}
          </section>

          {/* Premios por puntos */}
          <div className={inPanel ? "grid grid-cols-1 gap-7 md:grid-cols-2" : "space-y-7"}>
          {currentTiers.map((tier, i) => (
            <section key={i}>
              <SwitchHeader
                on={tier.hasMenuItem}
                onToggle={() => requestTierToggle(i)}
                title={`Premio ${i + 1}`}
              />
              <div className="mt-2 space-y-3 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
                <div>
                  <label htmlFor={`tier-points-${i}`} className="mb-1.5 block text-[13px] leading-4" style={{ color: INK_MUTED }}>
                    Puntos para ganarlo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id={`tier-points-${i}`}
                      type="number"
                      min={0}
                      step={1}
                      value={tier.pointsRequired}
                      onChange={(e) => {
                        const updated = [...currentTiers];
                        updated[i] = { ...tier, pointsRequired: parseInt(e.target.value) || 0 };
                        setCurrentTiers(updated);
                      }}
                      className={`${INPUT_CLS} w-28 font-bold tabular-nums`}
                    />
                    {tier.pointsRequired > 0 && (
                      <span className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
                        ≈ ${(tier.pointsRequired * spendStepAmount).toLocaleString("es-MX")} gastados
                      </span>
                    )}
                  </div>
                </div>
                {tier.hasMenuItem && (
                  <>
                    <SelectField
                      ariaLabel={`Platillo del premio ${i + 1}`}
                      value={tier.menuItemId || ""}
                      onChange={(selectedId) => {
                        const item = menuItems.find((m) => m.id === selectedId);
                        const updated = [...currentTiers];
                        if (item) {
                          updated[i] = {
                            ...tier,
                            menuItemId: item.id,
                            menuItemName: item.name,
                            menuItemDescription: item.description ?? "",
                            menuItemImageUrl: item.imageUrl ?? "",
                          };
                        } else {
                          updated[i] = {
                            ...tier,
                            menuItemId: "",
                            menuItemName: "",
                            menuItemDescription: "",
                            menuItemImageUrl: "",
                          };
                        }
                        setCurrentTiers(updated);
                      }}
                    >
                      <option value="">Elige un platillo del menú</option>
                      {menuOptions}
                    </SelectField>
                    {tier.menuItemId && (
                      <input
                        type="text"
                        placeholder="Texto que ve tu cliente (opcional)"
                        value={tier.menuItemDescription ?? ""}
                        onChange={(e) => {
                          const updated = [...currentTiers];
                          updated[i] = { ...tier, menuItemDescription: e.target.value };
                          setCurrentTiers(updated);
                        }}
                        className={INPUT_CLS}
                      />
                    )}
                    {tier.menuItemId && tier.pointsRequired > 0 && (
                      <ClientPreview
                        foto={tier.menuItemImageUrl || menuItems.find((m) => m.id === tier.menuItemId)?.imageUrl}
                        name={tier.menuItemName}
                        description={tier.menuItemDescription}
                        pill={`${tier.pointsRequired} pts`}
                      />
                    )}
                    {(() => {
                      const validation = getTierValidation(tier);
                      if (!validation) return null;
                      if (validation.type === "ok") {
                        return (
                          <p className="text-[14px] leading-5" style={{ color: SUCCESS }}>{validation.message}</p>
                        );
                      }
                      // Error (regala de más), caro y "tarda mucho": los tres
                      // son avisos ámbar; el de error además detiene Guardar.
                      const showFix = "fixPoints" in validation && validation.fixPoints !== tier.pointsRequired;
                      return (
                        <div className="rounded-xl px-4 py-3" style={{ background: WARN_SURFACE }}>
                          <p className="text-[14px] leading-5" style={{ color: validation.type === "error" ? DANGER : WARN }}>{validation.message}</p>
                          {showFix && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...currentTiers];
                                updated[i] = { ...tier, pointsRequired: validation.fixPoints };
                                setCurrentTiers(updated);
                              }}
                              className={`${BTN_SECONDARY} mt-2`}
                            >
                              Ponerlo en {validation.fixPoints} puntos
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </section>
          ))}
          </div>
        </div>

        {/* Botón principal: uno por pantalla */}
        <div>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || saved || (!formHasContent && !formIsDeliberatelyOff)}
            className={BTN_PRIMARY}
            style={saved ? { background: "#ffffff", color: SUCCESS, border: `1px solid ${BORDER}` } : { background: BRAND, color: INK }}
          >
            {saved ? "Guardado" : saving ? <><Spin />Guardando…</> : formIsDeliberatelyOff ? "Guardar así, sin premios" : "Guardar mis premios"}
          </button>

          {aiApplied && (
            <div className="mt-2 flex justify-center">
              <button type="button" onClick={handleDismissDraft} className={BTN_TERTIARY}>
                Descartar sugerencia
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RecompensasSetupPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RecompensasSetupPageInner />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <svg className="h-6 w-6 animate-spin" style={{ color: BRAND }} fill="none" viewBox="0 0 24 24">
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
