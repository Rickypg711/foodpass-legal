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
import { persistReadiness } from "@/lib/vendorReadiness";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
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
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

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
    { pointsRequired: 500, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
    { pointsRequired: 1000, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
    { pointsRequired: 2000, menuItemId: "", menuItemName: "", menuItemImageUrl: "", menuItemDescription: "", hasMenuItem: false },
  ]);

  // AI draft
  const [aiStep, setAiStep] = useState<AiStep>("idle");
  const [draft, setDraft] = useState<RewardDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (data?.firstPurchaseReward) {
        const fpr = data.firstPurchaseReward as any;
        setCurrentFPR({
          enabled: fpr.enabled ?? true,
          menuItemId: fpr.menuItemId ?? "",
          menuItemName: fpr.menuItemName ?? "",
          menuItemImageUrl: fpr.menuItemImageUrl ?? "",
          menuItemDescription: fpr.menuItemDescription ?? "",
          pointsAwarded: fpr.pointsAwarded ?? 100,
        });
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

          setDraft({
            id: d.id,
            firstPurchaseReward: {
              enabled: fpr.enabled ?? true,
              menuItemId: fpr.menuItemId ?? "",
              menuItemName: fpr.menuItemName ?? "",
              menuItemImageUrl: fpr.menuItemImageUrl ?? "",
              menuItemDescription: fpr.menuItemDescription ?? "",
              pointsAwarded: fpr.pointsAwarded ?? 100,
            },
            rewardTiers: (tiers as any[]).map((t, idx) => ({
              id: t.id ?? `tier_${idx + 1}`,
              pointsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
              visitsRequired: t.visitsRequired ?? t.pointsRequired ?? 0,
              menuItemId: t.menuItemId ?? "",
              menuItemName: t.menuItemName ?? "",
              menuItemDescription: t.menuItemDescription ?? "",
              menuItemImageUrl: t.menuItemImageUrl ?? "",
              hasMenuItem: !!t.menuItemId,
            })),
            reasoning: notes,
          });
          setAiStep("review");
        } else if (isFailed) {
          setAiError("La IA no pudo generar sugerencias ahora. Edita manualmente.");
          setAiStep("idle");
        }
      }
    );
    return () => unsub();
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

  function applyDraftToForm() {
    if (!draft) return;
    setCurrentFPR(draft.firstPurchaseReward);
    setCurrentTiers(draft.rewardTiers);
    setAiStep("idle");
    setDraft(null);
  }

  async function handleSave() {
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

      if (draft) {
        const applyRewardDraft = httpsCallable(functions, "applyRewardDraft");
        await applyRewardDraft({
          restaurantId,
          draftId: draft.id,
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
      setTimeout(() => router.push(isWizard ? "/vendor/setup/done" : "/vendor/setup"), 800);
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
          <WizardStepper current="rewards" />
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

      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#141413]">Programa de lealtad</h2>
          <p className="mt-1 text-sm text-[#141413]/50">
            La IA diseña recompensas personalizadas según tu menú y tipo de restaurante.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* ── AI Draft Section ── */}
        <div className="rounded-2xl border border-[#141413]/8 bg-white p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d97757]/10 text-lg">🤖</div>
            <div>
              <p className="text-sm font-semibold text-[#141413]">Sugerencia de la IA</p>
              <p className="mt-0.5 text-xs text-[#141413]/50">Analizamos tu menú y diseñamos recompensas que funcionan</p>
            </div>
          </div>

          {aiError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{aiError}</div>
          )}

          {aiStep === "idle" && (
            <button
              onClick={handleGenerateDraft}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3 text-sm font-semibold text-white hover:bg-[#c46644] transition-colors"
            >
              ✨ Generar recompensas con IA
            </button>
          )}

          {aiStep === "generating" && (
            <div className="flex flex-col items-center gap-3 py-5">
              <svg className="h-7 w-7 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
              </svg>
              <p className="text-sm text-[#141413]/60">Analizando tu menú…</p>
              <p className="text-xs text-[#141413]/35">Esto toma unos segundos</p>
            </div>
          )}

          {aiStep === "review" && draft && (
            <div className="space-y-3">
              {draft.reasoning && (
                <div className="rounded-xl bg-[#d97757]/5 border border-[#d97757]/15 px-3 py-2.5">
                  <p className="text-xs text-[#d97757]/80 leading-relaxed">{draft.reasoning}</p>
                </div>
              )}

              {/* Draft FPR preview */}
              <div className="rounded-xl border border-[#141413]/8 px-3 py-3">
                <p className="text-xs font-semibold text-[#141413]/50 mb-2">Bienvenida</p>
                <p className="text-sm font-medium text-[#141413]">{draft.firstPurchaseReward.menuItemName || "—"}</p>
                {draft.firstPurchaseReward.menuItemDescription && (
                  <p className="text-xs text-[#141413]/45 mt-0.5">{draft.firstPurchaseReward.menuItemDescription}</p>
                )}
                <p className="text-xs text-[#d97757] mt-1">+{draft.firstPurchaseReward.pointsAwarded} pts al registrarse</p>
              </div>

              {/* Draft tiers preview */}
              {draft.rewardTiers.map((t, i) => (
                <div key={i} className="rounded-xl border border-[#141413]/8 px-3 py-3">
                  <p className="text-xs font-semibold text-[#141413]/50 mb-1">{t.pointsRequired} puntos</p>
                  <p className="text-sm font-medium text-[#141413]">{t.menuItemName || "—"}</p>
                  {t.menuItemDescription && <p className="text-xs text-[#141413]/45 mt-0.5">{t.menuItemDescription}</p>}
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={applyDraftToForm}
                  className="flex-1 rounded-xl bg-[#d97757] py-2.5 text-sm font-semibold text-white hover:bg-[#c46644] transition-colors"
                >
                  Usar esta sugerencia →
                </button>
                <button
                  onClick={() => { setAiStep("idle"); setDraft(null); }}
                  className="rounded-xl border border-[#141413]/12 px-4 py-2.5 text-sm text-[#141413]/50 hover:text-[#141413] transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Manual Editor ── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#141413]/45">Editar recompensas</p>

          {/* First Purchase Reward */}
          <div className="rounded-2xl border border-[#141413]/8 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#141413]">Recompensa de bienvenida</p>
              <button
                type="button"
                onClick={() => setCurrentFPR((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  currentFPR.enabled ? "bg-[#d97757]" : "bg-[#141413]/20"
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  currentFPR.enabled ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>
            <p className="text-xs text-[#141413]/45">Primer escaneo = regalo. Crea el primer hábito de visita.</p>
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
                  className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] focus:border-[#d97757] focus:outline-none"
                >
                  <option value="">-- Selecciona un platillo del menú --</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (${item.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                {currentFPR.menuItemId && (
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={currentFPR.menuItemDescription ?? ""}
                    onChange={(e) => setCurrentFPR((f) => ({ ...f, menuItemDescription: e.target.value }))}
                    className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
                  />
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#141413]/50 shrink-0">Puntos al registrarse:</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={currentFPR.pointsAwarded}
                    onChange={(e) => setCurrentFPR((f) => ({ ...f, pointsAwarded: parseInt(e.target.value) || 0 }))}
                    className="w-24 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] focus:border-[#d97757] focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Reward Tiers */}
          {currentTiers.map((tier, i) => (
            <div key={i} className="rounded-2xl border border-[#141413]/8 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#141413]">Nivel {i + 1}</p>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...currentTiers];
                    updated[i] = { ...tier, hasMenuItem: !tier.hasMenuItem };
                    setCurrentTiers(updated);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    tier.hasMenuItem ? "bg-[#d97757]" : "bg-[#141413]/20"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    tier.hasMenuItem ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#141413]/50 shrink-0">Puntos requeridos:</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={tier.pointsRequired}
                  onChange={(e) => {
                    const updated = [...currentTiers];
                    updated[i] = { ...tier, pointsRequired: parseInt(e.target.value) || 0 };
                    setCurrentTiers(updated);
                  }}
                  className="w-24 rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] focus:border-[#d97757] focus:outline-none"
                />
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
                    className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] focus:border-[#d97757] focus:outline-none"
                  >
                    <option value="">-- Selecciona un platillo del menú --</option>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (${item.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {tier.menuItemId && (
                    <input
                      type="text"
                      placeholder="Descripción (opcional)"
                      value={tier.menuItemDescription ?? ""}
                      onChange={(e) => {
                        const updated = [...currentTiers];
                        updated[i] = { ...tier, menuItemDescription: e.target.value };
                        setCurrentTiers(updated);
                      }}
                      className="w-full rounded-xl border border-[#141413]/12 bg-[#faf9f5] px-3 py-2.5 text-sm text-[#141413] placeholder-[#141413]/30 focus:border-[#d97757] focus:outline-none"
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-60"
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : "Guardar recompensas →"}
        </button>
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
