"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { persistReadiness, wizardDoneKeys } from "@/lib/vendorReadiness";

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

// ─── Page ─────────────────────────────────────────────────────────────────────

function RecompensasSetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWizard = searchParams.get("wizard") === "1";

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [stepperDone, setStepperDone] = useState<Array<"horario" | "menu" | "rewards"> | undefined>(undefined);
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

  // El error de guardado se limpia en cuanto el usuario edita algo.
  // Antes se quedaba pegado hasta el siguiente guardado exitoso y
  // hacia ver como si ajustar los puntos no sirviera de nada.
  useEffect(() => { setError(null); }, [currentTiers, currentFPR]);

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
      const items = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
      setMenuItems(items);

      const rSnap = await getDoc(doc(db, "restaurants", rid));
      const data = rSnap.data();
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
      setAiError("La IA no respondió a tiempo. Reintenta o edita manualmente.");
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

        // CF writes status as 'draft' or 'failed', keys are prefixed with 'proposed'
        const isSuccess = data.status === "draft" || data.status === "ready" || data.firstPurchaseReward || data.proposedFirstPurchaseReward;
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
          setAiError("La IA no pudo generar sugerencias ahora. Edita manualmente.");
          setAiStep("idle");
        }
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setAiError("Se perdió la conexión con la IA. Reintenta o edita manualmente.");
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
      const functions = getFunctions(getFirebaseApp(), "us-central1");
      const generateRewardDraft = httpsCallable(functions, "generateRewardDraft");
      const res = await generateRewardDraft({ restaurantId });
      const resultData = res.data as { status: string; reason?: string };
      if (resultData?.status === "skipped") {
        if (resultData.reason === "insufficient_menu_items") {
          setAiError("Necesitas agregar al menos 2 platillos en tu menú para usar la IA.");
        } else if (resultData.reason === "rate_limited") {
          setAiError("Has excedido el límite de intentos de la IA. Por favor intenta más tarde.");
        } else {
          setAiError("La IA no pudo generar sugerencias ahora. Edita manualmente.");
        }
        setAiStep("idle");
      }
    } catch (e) {
      console.error(e);
      setAiError("No se pudo conectar con la IA. Edita manualmente.");
      setAiStep("idle");
    }
  }

  async function handleDismissDraft() {
    if (!restaurantId || !activeDraftId) return;
    try {
      const db = getFirebaseDb();
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "restaurants", restaurantId, "rewardRecommendationDrafts", activeDraftId), {
        status: "dismissed",
        // El "no me latió" también se mide (loop cerrado): con applied vs
        // dismissed sale la tasa de aceptación de la IA de premios.
        dismissedAt: (await import("firebase/firestore")).serverTimestamp(),
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
    const muchosPuntos = Math.ceil(item.price / (HEALTHY_MIN_RATIO * spendStepAmount));
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
          `⚠️ Un poco caro: a ${tier.pointsRequired} puntos regalas el ${pct}% ` +
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
      message: `✓ Bien puesto: regalas el ${pct}% de lo que gasta tu cliente — dentro de lo sano (${minPct}%–${maxPct}%).`,
    };
  };

  async function handleSave(exitTo?: string) {
    if (!restaurantId) return;

    // Validate first purchase reward
    if (currentFPR.enabled && !currentFPR.menuItemId) {
      setError("Selecciona un platillo del menú para la recompensa de bienvenida.");
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

      if (activeDraftId) {
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

      await persistReadiness(restaurantId);
      setSaved(true);
      setTimeout(() => router.push(exitTo ?? (isWizard ? "/vendor/setup/done" : "/vendor/setup")), 800);
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar. Intenta de nuevo.");
      setShowExitOffer(false);
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        {isWizard ? (
          <WizardStepper current="rewards" doneKeys={stepperDone} onPanelClick={handlePanelExit} />
        ) : (
          <div className="border-b border-[#141413]/8 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <Link href="/vendor/setup" className="text-sm text-[#141413]/45 hover:text-[#141413] transition-colors">← Volver</Link>
              <span className="text-[#141413]/20">/</span>
              <h1 className="text-sm font-semibold text-[#141413]">Recompensas</h1>
            </div>
          </div>
        )}
      </div>

      {showExitOffer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-2xl">🎁</p>
            <h3 className="mt-2 text-lg font-bold text-[#141413]">Tus premios ya están listos</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#141413]/60">
              La IA los armó con tu menú. Si sales sin guardarlos, tu programa de
              puntos queda apagado y tus clientes no ganan nada todavía.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave("/vendor")}
              className="mt-5 w-full rounded-xl bg-[#F28C38] py-3 text-sm font-bold text-[#1C2526] transition-opacity disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardarlos y salir"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/vendor")}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-[#141413]/45 transition-colors hover:text-[#141413]"
            >
              Salir sin premios
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#141413]">Programa de lealtad</h2>
          <p className="mt-1 text-sm text-[#141413]/50">
            La IA diseña premios a la medida de tu menú y tu tipo de comida.
          </p>
          <p className="mt-2 rounded-xl bg-[#F28C38]/8 px-3 py-2 text-xs text-[#141413]/70">
            💡 Tus clientes ganan <strong>1 punto por visita</strong> más{" "}
            <strong>1 punto por cada ${spendStepAmount}</strong> que gastan. Así que{" "}
            <strong>${spendStepAmount * 10} gastados ≈ 10 puntos</strong>.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── AI Recommendation Assistant ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F28C38]/10 text-lg">🤖</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#141413]">
                {aiApplied ? "✨ Sugerencia cargada por Comeleal" : "Sugerencia de la IA"}
              </p>
              <p className="text-xs text-[#141413]/50">
                {aiApplied ? "Revísala y ajústala si quieres antes de guardar." : "Autocompleta tu programa basado en tu menú"}
              </p>
            </div>
            {aiStep === "idle" && (
              <button
                type="button"
                onClick={handleGenerateDraft}
                className="shrink-0 rounded-xl bg-[#F28C38] hover:opacity-90 px-4 py-2.5 text-[13px] font-bold text-[#1C2526] shadow-sm transition-all"
              >
                {aiApplied ? "✨ Regenerar" : "✨ Armarlos por mí"}
              </button>
            )}
            {aiStep === "generating" && (
              <div className="flex items-center gap-2.5 py-1 text-xs text-[#141413]/50">
                <svg className="h-4 w-4 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
                </svg>
                <span>Analizando menú...</span>
              </div>
            )}
          </div>

          {aiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{aiError}</div>
          )}

          {aiReasoning && (
            <div className="rounded-xl bg-[#F28C38]/5 border border-[#F28C38]/15 p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-[#F28C38] uppercase tracking-wider">🤖 Análisis de la IA</p>
              <p className="text-xs text-[#141413]/70 leading-relaxed font-medium">{aiReasoning}</p>
            </div>
          )}
        </div>

        {/* ── Manual Editor ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#141413]/45">Tus premios</p>

          {/* First Purchase Reward */}
          <div className="rounded-2xl border border-[#141413]/8 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#141413]">Recompensa de bienvenida</p>
              <button
                type="button"
                onClick={() => setCurrentFPR((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  currentFPR.enabled ? "bg-[#F28C38]" : "bg-[#141413]/20"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  currentFPR.enabled ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>
            <p className="text-xs text-[#141413]/45">Se desbloquea en la 1ra visita y se regala en la 2da. ¡Ideal para crear el hábito de regresar!</p>
            {currentFPR.enabled && (
              <>
                <select
                  value={currentFPR.menuItemId || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
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
                  className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] focus:border-[#F28C38] focus:outline-none"
                >
                  <option value="">-- Selecciona un platillo del menú --</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{etiquetaTamanoBase(item)} (${item.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                {currentFPR.menuItemId && (
                  <input
                    type="text"
                    placeholder="Texto que ve tu cliente (opcional)"
                    value={currentFPR.menuItemDescription ?? ""}
                    onChange={(e) => setCurrentFPR((f) => ({ ...f, menuItemDescription: e.target.value }))}
                    className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
                  />
                )}
                {currentFPR.menuItemId && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#141413]/35">
                      👀 Así lo ve tu cliente
                    </p>
                    <div className="flex items-center gap-3 rounded-xl border border-[#F28C38]/20 bg-[#F28C38]/5 p-3">
                      {currentFPR.menuItemImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentFPR.menuItemImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F28C38]/15 text-lg">⭐</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#141413]">{currentFPR.menuItemName}</p>
                        <p className="text-[11px] font-bold text-[#F28C38]">GRATIS en su 2ª visita</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reward Tiers */}
          {currentTiers.map((tier, i) => (
            <div key={i} className="rounded-2xl border border-[#141413]/8 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#141413]">Premio {i + 1}</p>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...currentTiers];
                    updated[i] = { ...tier, hasMenuItem: !tier.hasMenuItem };
                    setCurrentTiers(updated);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    tier.hasMenuItem ? "bg-[#F28C38]" : "bg-[#141413]/20"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    tier.hasMenuItem ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#141413]/50 shrink-0">Puntos para ganarlo:</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tier.pointsRequired}
                  onChange={(e) => {
                    const updated = [...currentTiers];
                    updated[i] = { ...tier, pointsRequired: parseInt(e.target.value) || 0 };
                    setCurrentTiers(updated);
                  }}
                  className="w-24 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] focus:border-[#F28C38] focus:outline-none"
                />
                {tier.pointsRequired > 0 && (
                  <span className="text-[11px] text-[#141413]/40">
                    ≈ ${(tier.pointsRequired * spendStepAmount).toLocaleString("es-MX")} gastados
                  </span>
                )}
              </div>
              {tier.hasMenuItem && (
                <>
                  <select
                    value={tier.menuItemId || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
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
                    className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] focus:border-[#F28C38] focus:outline-none"
                  >
                    <option value="">-- Selecciona un platillo del menú --</option>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}{etiquetaTamanoBase(item)} (${item.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
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
                      className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
                    />
                  )}
                  {tier.menuItemId && tier.pointsRequired > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#141413]/35">
                        👀 Así lo ve tu cliente
                      </p>
                      <div className="flex items-center gap-3 rounded-xl border border-[#141413]/8 bg-[#F5F3EF] p-3">
                        <div className="flex min-w-[52px] shrink-0 flex-col items-center justify-center rounded-lg bg-[#1C2526] px-2.5 py-2">
                          <p className="font-mono text-[15px] font-bold leading-none text-white">{tier.pointsRequired}</p>
                          <p className="mt-0.5 text-[8px] font-semibold uppercase leading-none text-white/55">pts</p>
                        </div>
                        {tier.menuItemImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tier.menuItemImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#141413]">{tier.menuItemName}</p>
                          {tier.menuItemDescription && (
                            <p className="line-clamp-1 text-[11px] text-[#141413]/45">{tier.menuItemDescription}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const validation = getTierValidation(tier);
                    if (!validation) return null;
                    const tone =
                      validation.type === "error"
                        ? { text: "text-red-600", bg: "bg-red-50 border-red-200" }
                        : validation.type === "warning"
                        ? { text: "text-amber-700", bg: "bg-amber-50 border-amber-200" }
                        : validation.type === "ok"
                        ? { text: "text-emerald-600", bg: "" }
                        : { text: "text-[#141413]/60", bg: "bg-[#F28C38]/5 border-[#F28C38]/15" };
                    if (validation.type === "ok") {
                      return (
                        <p className={`text-xs mt-1.5 font-medium ${tone.text}`}>{validation.message}</p>
                      );
                    }
                    return (
                      <div className={`mt-1.5 rounded-xl border px-3 py-2.5 ${tone.bg}`}>
                        <p className={`text-xs font-medium ${tone.text}`}>{validation.message}</p>
                        {"fixPoints" in validation && validation.fixPoints !== tier.pointsRequired && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...currentTiers];
                              updated[i] = { ...tier, pointsRequired: validation.fixPoints };
                              setCurrentTiers(updated);
                            }}
                            className="mt-2 rounded-lg bg-[#1C2526] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-85"
                          >
                            Ponerlo en {validation.fixPoints} puntos ✓
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => handleSave()}
          disabled={saving || saved}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-4 text-sm font-semibold text-[#1C2526] shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-60"
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : "Guardar mis premios →"}
        </button>

        {aiApplied && (
          <div className="flex justify-center mt-2">
            <button
              type="button"
              onClick={handleDismissDraft}
              className="text-xs text-[#141413]/40 hover:text-red-500 transition-colors font-medium"
            >
              Descartar sugerencia
            </button>
          </div>
        )}
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
