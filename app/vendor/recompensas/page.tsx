"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

interface RewardTier {
  pointsRequired: number;
  menuItemName: string;
  menuItemDescription?: string;
  hasMenuItem?: boolean;
}

interface FirstPurchaseReward {
  enabled: boolean;
  menuItemName: string;
  menuItemDescription?: string;
  pointsAwarded: number;
}

/** Forma cruda de un nivel en Firestore / en el borrador (campos viejos y nuevos). */
interface RawTier {
  pointsRequired?: number;
  visitsRequired?: number;
  menuItemName?: string;
  menuItemDescription?: string;
  hasMenuItem?: boolean;
  menuItemId?: string;
}

interface RewardsData {
  rewardTiers: RewardTier[];
  firstPurchaseReward: FirstPurchaseReward | null;
}

// Borrador de la IA esperando a que el dueño le diga que sí. Esta página era
// el destino del consejo del panel (check_ai_draft) y NO sabía leerlo — el
// dueño llegaba a "Sin recompensas todavía" con su propuesta invisible
// (hallazgo del barrido del 1-sep, muro #1 del embudo).
interface PendingDraft {
  id: string;
  fprName: string | null;
  tierNames: Array<{ points: number; name: string }>;
}

// Opción A (23-sep-2026, lienzo "Sistema Comeleal"): mismos tokens que el
// Panel, Pedidos, Caja y Clientes. Sin emojis, sin sombras, sin eyebrows.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const TILE = "#F0EBE1";
const WARN = "#B45309";
const WARN_SURFACE = "#FFFBEB";
const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconGift({ small = false }: { small?: boolean }) {
  const s = small ? 18 : 22;
  return (
    <svg {...ICON} width={s} height={s} stroke={small ? INK : INK_SOFT} aria-hidden="true">
      <path d="M3.5 11h17v9.5h-17zM3 7.5h18V11H3zM12 7.5v13M12 7.5c-1.5-2.5-3.5-4-5-3s-.5 3 .5 3zM12 7.5c1.5-2.5 3.5-4 5-3s.5 3-.5 3z" />
    </svg>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>{children}</h2>
      {right ? <span className="shrink-0 text-[13px] leading-4" style={{ color: INK_SOFT }}>{right}</span> : null}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[24px] shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold" style={{ background: TILE, color: INK_MUTED }}>
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function RecompensasPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar?modo=entrar"); return; }
      setRestaurantId(rid);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const d = restSnap.data() ?? {};

      const rawTiers = ((d.rewardTiers as RawTier[] | undefined) ?? []).map((t) => ({
        pointsRequired: t.pointsRequired ?? t.visitsRequired ?? 0,
        menuItemName: t.menuItemName ?? "",
        menuItemDescription: t.menuItemDescription ?? "",
        hasMenuItem: t.hasMenuItem ?? !!t.menuItemId,
      }));
      const rawFpr = d.firstPurchaseReward as FirstPurchaseReward | undefined | null;

      setData({
        rewardTiers: rawTiers,
        firstPurchaseReward: rawFpr ?? null,
      });

      // ¿Hay una propuesta de la IA esperando? (misma consulta que el wizard)
      try {
        const draftsSnap = await getDocs(
          query(
            collection(db, "restaurants", rid, "rewardRecommendationDrafts"),
            orderBy("createdAt", "desc"),
            limit(1),
          ),
        );
        if (!draftsSnap.empty) {
          const dd = draftsSnap.docs[0];
          const draft = dd.data();
          if (draft.status === "draft" || draft.status === "ready") {
            const fpr = draft.proposedFirstPurchaseReward || draft.firstPurchaseReward;
            const tiers = (draft.proposedRewardTiers || draft.rewardTiers || []) as RawTier[];
            setPendingDraft({
              id: dd.id,
              fprName: fpr?.enabled && fpr?.menuItemName ? fpr.menuItemName : null,
              tierNames: tiers
                .filter((t) => t?.menuItemName)
                .map((t) => ({
                  points: t.visitsRequired ?? t.pointsRequired ?? 0,
                  name: t.menuItemName as string,
                })),
            });
          }
        }
      } catch {
        // Sin permiso o sin subcolección: la página sigue sirviendo igual.
      }

      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);


  const hasFpr = data?.firstPurchaseReward?.enabled && data.firstPurchaseReward.menuItemName;
  const hasTiers = (data?.rewardTiers ?? []).length > 0;
  const hasAnyReward = hasFpr || hasTiers;
  const tierCount = data?.rewardTiers.length ?? 0;
  const rewardCount = tierCount + (hasFpr ? 1 : 0);

  // Aviso del borrador (Opción A). Con premios ya publicados es una fila
  // ámbar con link de texto: el botón principal de la pantalla es el de
  // "Editar mis premios" abajo. Sin premios, la propuesta ES la heroína:
  // tarjeta blanca con borde y el único botón principal (48, naranja, tinta).
  const draftLines = pendingDraft
    ? [
        ...(pendingDraft.fprName ? [{ key: "fpr", left: "Bienvenida", name: pendingDraft.fprName }] : []),
        ...pendingDraft.tierNames.slice(0, 3).map((t) => ({ key: `${t.points}-${t.name}`, left: `${t.points} pts`, name: t.name })),
      ]
    : [];
  const draftTitle = hasAnyReward ? "Hay una propuesta nueva de premios" : "Tus premios ya están armados";

  const draftBanner = pendingDraft && (
    hasAnyReward ? (
      <div className="rounded-xl px-4 py-3" style={{ background: WARN_SURFACE }}>
        <p className="text-[14px] font-semibold leading-5" style={{ color: WARN }}>{draftTitle}</p>
        {draftLines.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {draftLines.map((l) => (
              <li key={l.key} className="text-[13px] leading-5" style={{ color: WARN }}>
                {l.left}: <span className="font-semibold">{l.name}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/vendor/recompensas/editar"
          className="mt-1 inline-flex h-11 items-center text-[14px] font-semibold hover:underline"
          style={{ color: LINK }}>
          Verlos y activarlos
        </Link>
      </div>
    ) : (
      <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>{draftTitle}</h2>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Te sugerimos estos premios con lo que hay en tu menú.
        </p>
        {draftLines.length > 0 && (
          <ul className="mt-3">
            {draftLines.map((l, i) => (
              <li key={l.key} className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i === 0 ? undefined : `1px solid ${HAIRLINE}` }}>
                <span className="w-[72px] shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: INK_SOFT }}>{l.left}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium" style={{ color: INK }}>{l.name}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/vendor/recompensas/editar"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-[#1C2526] transition-transform active:scale-[0.98]"
          style={{ background: BRAND }}>
          Verlos y activarlos
        </Link>
        <p className="mt-2 text-center text-[13px] leading-4" style={{ color: INK_SOFT }}>
          Los revisas antes de que se publiquen. Los puedes cambiar cuando quieras.
        </p>
      </div>
    )
  );

  const formatPoints = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);

  return (
    <>
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">

        {/* Título de pantalla (Lora) + caption; a la derecha, "Editar" solo con
            premios publicados y sin borrador. */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Recompensas</h1>
            <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
              {loading
                ? "Lo que tus clientes ganan por regresar"
                : hasAnyReward
                  ? `${rewardCount} ${rewardCount === 1 ? "premio" : "premios"} por regresar`
                  : "Lo que tus clientes ganan por regresar"}
            </p>
          </div>
          {/* Una sola puerta mientras hay borrador (Ricardo, 9-sep): con la
              propuesta esperando, la tarjeta ES la puerta; "Editar"
              solo aparece cuando ya hay premios publicados. */}
          {!loading && restaurantId && hasAnyReward && !pendingDraft && (
            <Link
              href="/vendor/recompensas/editar"
              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-white px-4 text-[14px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}>
              Editar
            </Link>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : !hasAnyReward ? (
          /* Estado vacío — con propuesta esperando, ELLA es la heroína */
          pendingDraft ? (
            <div className="mx-auto max-w-md pt-2">{draftBanner}</div>
          ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}><IconGift /></div>
            <p className="mt-4 text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
              Sin recompensas todavía
            </p>
            <p className="mt-2 max-w-xs text-[14px] leading-5" style={{ color: INK_MUTED }}>
              Elige qué se llevan tus clientes por regresar. Lo verán cuando junten puntos.
            </p>
            <Link
              href="/vendor/recompensas/editar"
              className="mt-5 flex h-12 items-center rounded-xl px-6 text-[15px] font-semibold text-[#1C2526] transition-transform active:scale-[0.98]"
              style={{ background: BRAND }}>
              Configurar recompensas
            </Link>
          </div>
          )
        ) : (
          <div className="space-y-7">
            {draftBanner}

            {/* Tus premios: lista de niveles (puntos → premio). La bienvenida
                va primero, con su pastilla, porque no cuesta puntos. */}
            <section>
              <SectionTitle right={tierCount > 0 ? `${tierCount} ${tierCount === 1 ? "nivel" : "niveles"}` : undefined}>Tus premios</SectionTitle>
              <div className="rounded-xl bg-white px-4 py-1" style={{ border: `1px solid ${BORDER}` }}>
                {hasFpr && data?.firstPurchaseReward && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: TILE, color: INK }}>
                      <IconGift small />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-medium" style={{ color: INK }}>
                          {data.firstPurchaseReward.menuItemName}
                        </p>
                        <Pill>Al dar su número</Pill>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-4" style={{ color: INK_SOFT }}>
                        Bienvenida · se desbloquea en la 1ª visita y se regala en la 2ª
                      </p>
                      {data.firstPurchaseReward.menuItemDescription && (
                        <p className="mt-0.5 text-[13px] leading-4 line-clamp-2" style={{ color: INK_SOFT }}>
                          {data.firstPurchaseReward.menuItemDescription}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {data!.rewardTiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-3 py-3"
                    style={{ borderTop: hasFpr || i > 0 ? `1px solid ${HAIRLINE}` : undefined }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums"
                      style={{ background: TILE, color: INK }}
                      title={`${tier.pointsRequired} puntos`}>
                      {formatPoints(tier.pointsRequired)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium" style={{ color: INK }}>
                        {tier.menuItemName || <span style={{ color: INK_SOFT }}>Sin nombre</span>}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
                        {tier.pointsRequired} puntos
                        {tier.menuItemDescription ? ` · ${tier.menuItemDescription}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Cómo funciona */}
            <section>
              <SectionTitle>Cómo funciona</SectionTitle>
              <ol className="space-y-2.5">
                {[
                  "Le pides su número al cobrar (o escanea su app).",
                  "Junta puntos con cada compra.",
                  "Canjea su premio cuando llega a los puntos.",
                ].map((text, i) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums"
                      style={{ background: TILE, color: INK }}>{i + 1}</span>
                    <p className="text-[14px] leading-6" style={{ color: INK_MUTED }}>{text}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Botón principal: uno por pantalla */}
            <Link
              href="/vendor/recompensas/editar"
              className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-[#1C2526] transition-transform active:scale-[0.98]"
              style={{ background: BRAND }}>
              Editar mis premios
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
