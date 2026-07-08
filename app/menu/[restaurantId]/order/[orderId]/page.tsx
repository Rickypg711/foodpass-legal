"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mpWebDebugClient } from "@/lib/mercadoPago/mpWebDebug";
import { ensureAnonymousUser } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { formatPrice } from "@/lib/priceFormat";
import {
  buildWhatsappUrl,
  formatWhatsappOrderMessage,
} from "@/lib/order/formatWhatsappMessage";
import { loadOrderSnapshot } from "@/lib/order/orderSessionStorage";
import {
  parsePaymentReturnParam,
  paymentReturnBannerMessage,
} from "@/lib/order/paymentReturnMessage";
import { customerOrderDisplay } from "@/lib/order/orderDisplayLabels";
import { PhonePointsCard } from "@/components/loyalty/PhonePointsCard";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { trackWhatsappOrderMessageSent } from "@/lib/analytics/orderEvents";
import type { CartLine } from "@/lib/cart/types";
import type { StoredOrderSnapshot } from "@/lib/types/order";

type OrderDoc = {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  loyaltyAwarded?: boolean;
  pickupPin?: string;
  total?: number;
  items?: Array<{
    name?: string;
    quantity?: number;
    subtotal?: number;
    isUpsell?: boolean;
    upsellBonusPoints?: number;
  }>;
  restaurantName?: string;
};

/**
 * Estimated loyalty points this order earns (mirrors the app's
 * LoyaltyPurchaseEarnPolicy: base + floor(total/step) + upsell bonuses).
 * Credited at pickup scan — the copy must say "al recoger", never "ya en tu cuenta".
 */
function estimateOrderPoints(
  total: number,
  items: OrderDoc["items"],
  earn: { base: number; step: number },
): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const base = earn.base + Math.floor(total / earn.step);
  const bonus = (items ?? []).reduce(
    (s, it) =>
      s +
      (it?.isUpsell === true && typeof it.upsellBonusPoints === "number" && it.upsellBonusPoints > 0
        ? Math.floor(it.upsellBonusPoints)
        : 0),
    0,
  );
  return base + bonus;
}

/** Same fallbacks as the app's LoyaltyEarnPolicyConfig. */
function earnPolicyFromRestaurant(d: Record<string, unknown>): { base: number; step: number } {
  const nested = d.loyaltyEarnPolicy;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    const base = Number(m.basePointsPerPurchase);
    const step = Number(m.spendStepAmount);
    if (Number.isFinite(base) && base >= 1 && Number.isFinite(step) && step >= 1) {
      return { base: Math.floor(base), step: Math.floor(step) };
    }
  }
  const cc = typeof d.currencyCode === "string" ? d.currencyCode.trim().toUpperCase() : "MXN";
  return { base: 1, step: cc === "USD" ? 2 : 30 };
}

function OrderStatusSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando pedido">
      <div className="rounded-xl bg-white p-4">
        <div className="mx-auto h-4 w-16 rounded bg-black/10" />
        <div className="mx-auto mt-2 h-8 w-32 rounded bg-black/10" />
      </div>
      <div className="rounded-xl bg-white p-4 space-y-3">
        <div className="h-3 w-28 rounded bg-black/10" />
        <div className="h-4 w-full rounded bg-black/10" />
        <div className="h-3 w-24 rounded bg-black/10" />
        <div className="h-10 w-20 rounded bg-black/10" />
        <div className="h-4 w-40 rounded bg-black/10" />
        <div className="h-4 w-24 rounded bg-black/10" />
      </div>
    </div>
  );
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function OrderStatusPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const paymentReturn = parsePaymentReturnParam(searchParams.get("payment"));
  const returnBanner = paymentReturnBannerMessage(paymentReturn);

  const [snapshot] = useState<StoredOrderSnapshot | null>(() =>
    typeof window !== "undefined" ? loadOrderSnapshot() : null,
  );
  const mounted = useIsClient();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [earnPolicy, setEarnPolicy] = useState<{ base: number; step: number }>({
    base: 1,
    step: 30,
  });
  const [firstVisitReward, setFirstVisitReward] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const prevStatusRef = useRef<{ status?: string; paymentStatus?: string }>({});

  const orderingEnabled = isWebOrderingEnabled();

  useEffect(() => {
    if (paymentReturn) {
      mpWebDebugClient("payment_return_param", {
        restaurantId,
        orderId,
        paymentReturn,
      });
    }
  }, [paymentReturn, restaurantId, orderId]);

  useEffect(() => {
    if (!mounted || !orderingEnabled || !restaurantId || !orderId) return;

    let unsub: (() => void) | undefined;

    mpWebDebugClient("order_listener_start", { restaurantId, orderId });

    (async () => {
      try {
        await ensureAnonymousUser();
        setAuthReady(true);
        const db = getFirebaseDb();
        const ref = doc(db, "restaurants", restaurantId, "orders", orderId);
        unsub = onSnapshot(
          ref,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as OrderDoc;
              setOrder(data);
              setLoadError(null);

              const prev = prevStatusRef.current;
              const nextStatus = data.status ?? null;
              const nextPaymentStatus = data.paymentStatus ?? null;
              if (
                prev.status !== nextStatus ||
                prev.paymentStatus !== nextPaymentStatus
              ) {
                mpWebDebugClient("order_status_transition", {
                  restaurantId,
                  orderId,
                  fromStatus: prev.status ?? null,
                  toStatus: nextStatus,
                  fromPaymentStatus: prev.paymentStatus ?? null,
                  toPaymentStatus: nextPaymentStatus,
                  paymentMethod: data.paymentMethod ?? null,
                });
                prevStatusRef.current = {
                  status: nextStatus ?? undefined,
                  paymentStatus: nextPaymentStatus ?? undefined,
                };
              }

              mpWebDebugClient("order_snapshot", {
                restaurantId,
                orderId,
                orderFound: true,
                status: nextStatus,
                paymentStatus: nextPaymentStatus,
                paymentMethod: data.paymentMethod ?? null,
              });
            } else {
              setOrder(null);
              setLoadError("No encontramos este pedido.");
              mpWebDebugClient("order_snapshot", {
                restaurantId,
                orderId,
                orderFound: false,
              });
            }
          },
          (err) => {
            setOrder(null);
            setLoadError("No pudimos cargar tu pedido. Guarda tu PIN y número de orden.");
            mpWebDebugClient("order_listener_error", {
              restaurantId,
              orderId,
              message: err instanceof Error ? err.message : "snapshot_error",
            });
          },
        );

        const rSnap = await getDoc(doc(db, "restaurants", restaurantId));
        if (rSnap.exists()) {
          const d = rSnap.data() as Record<string, unknown>;
          const wa = d.whatsapp;
          if (typeof wa === "string" && wa.trim()) {
            setWhatsapp(wa.trim());
          }
          setEarnPolicy(earnPolicyFromRestaurant(d));
          const fpr = d.firstPurchaseReward;
          if (fpr && typeof fpr === "object") {
            const m = fpr as Record<string, unknown>;
            if (m.enabled === true && typeof m.menuItemName === "string" && m.menuItemName.trim()) {
              setFirstVisitReward(m.menuItemName.trim());
            }
          }
        }
      } catch {
        setLoadError("No pudimos verificar tu sesión.");
      }
    })();

    return () => {
      unsub?.();
    };
  }, [mounted, orderingEnabled, restaurantId, orderId]);

  const dataReady = authReady && (order !== null || loadError !== null);
  const showLoading = !mounted || !dataReady;

  // Session snapshot + Firestore are client-only — never derive display text for SSR.
  const displayName = mounted
    ? (order?.customerName ?? snapshot?.customerName ?? "").trim()
    : "";
  const displayPin = mounted
    ? (order?.pickupPin ?? snapshot?.pickupPin ?? "").trim()
    : "";
  const displayTotal = mounted
    ? (order?.total ?? snapshot?.total ?? 0)
    : 0;
  const displayRestaurant =
    order?.restaurantName ?? snapshot?.restaurantName ?? "Restaurante";
  const status = mounted ? (order?.status ?? "pending") : "pending";
  const paymentStatus = mounted ? (order?.paymentStatus ?? "pending") : "pending";
  const orderDisplay = customerOrderDisplay(status, paymentStatus);

  useEffect(() => {
    if (!mounted) return;
    mpWebDebugClient("render_state", {
      restaurantId,
      orderId,
      mounted,
      hydrationSafe: true,
      showLoading,
      authReady,
      dataReady,
      hasLoadError: !!loadError,
      hasOrderDoc: order !== null,
      hasDisplayPin: !!displayPin,
      hasDisplayName: !!displayName,
      paymentReturn: paymentReturn ?? null,
    });
  }, [
    mounted,
    showLoading,
    authReady,
    dataReady,
    loadError,
    order,
    restaurantId,
    orderId,
    paymentReturn,
    displayPin,
    displayName,
  ]);

  const cartLinesForWa: CartLine[] = order?.items?.length
    ? order.items.map((it, i) => ({
        menuItemId: String(i),
        name: it.name ?? "—",
        price: 0,
        quantity: typeof it.quantity === "number" ? it.quantity : 1,
        subtotal: typeof it.subtotal === "number" ? it.subtotal : 0,
      }))
    : [];

  function handleWhatsappClick() {
    if (!whatsapp || !orderId || !displayPin || !displayName) return;
    const text = formatWhatsappOrderMessage({
      restaurantName: displayRestaurant,
      orderId,
      pickupPin: displayPin,
      customerName: displayName,
      paymentMethod: order?.paymentMethod ?? null,
      orderUrl:
        typeof window !== "undefined"
          ? `${window.location.origin}/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(orderId)}`
          : undefined,
      cartLines: cartLinesForWa,
      total: displayTotal,
    });
    trackWhatsappOrderMessageSent({ restaurantId, orderId });
    window.open(buildWhatsappUrl(whatsapp, text), "_blank", "noopener,noreferrer");
  }

  const downloadHref = `/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`;

  if (!orderingEnabled) {
    return (
      <div className="min-h-screen p-6 text-center" style={{ backgroundColor: "#F0E3D2" }}>
        <p className="text-sm">Pedidos en línea no disponibles.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#1C2526]" style={{ backgroundColor: "#F0E3D2" }}>
      <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
        <h1 className="text-lg font-semibold text-white">Pedido enviado</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {showLoading ? (
          <OrderStatusSkeleton />
        ) : loadError ? (
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="text-red-700">{loadError}</p>
            {mounted && snapshot?.orderId === orderId && snapshot.pickupPin ? (
              <div className="mt-4 space-y-2">
                <p>
                  <span className="font-medium">Orden:</span> {orderId}
                </p>
                <p suppressHydrationWarning>
                  <span className="font-medium">PIN:</span> {snapshot.pickupPin}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {returnBanner ? (
              <div
                className="rounded-xl border border-[#009EE3]/40 bg-white p-4 text-sm text-[#1C2526]"
                role="status"
              >
                {returnBanner}
              </div>
            ) : null}
            <div className="rounded-xl bg-white p-4 text-center">
              <p className="text-sm text-[#1C2526]/70">Estado del pedido</p>
              <p className="mt-1 text-xl font-bold" style={{ color: "#F28C38" }}>
                {orderDisplay.title}
              </p>
              {orderDisplay.subtitle ? (
                <p className="mt-2 text-sm text-[#1C2526]/80">{orderDisplay.subtitle}</p>
              ) : null}
            </div>

            <div className="rounded-xl bg-white p-4">
              <p className="text-xs text-[#1C2526]/60">Número de orden</p>
              <p className="break-all font-mono text-sm">{orderId}</p>
              <p className="mt-3 text-xs text-[#1C2526]/60">PIN de recogida</p>
              {displayPin ? (
                <p
                  className="text-3xl font-bold tracking-widest"
                  suppressHydrationWarning
                >
                  {displayPin}
                </p>
              ) : (
                <div
                  className="mt-1 h-9 w-28 animate-pulse rounded bg-black/10"
                  aria-label="Cargando PIN"
                />
              )}
              <p className="mt-3 text-sm">
                Nombre:{" "}
                {displayName ? (
                  <span className="font-semibold" suppressHydrationWarning>
                    {displayName}
                  </span>
                ) : (
                  <span
                    className="inline-block h-4 w-24 animate-pulse rounded bg-black/10 align-middle"
                    aria-hidden
                  />
                )}
              </p>
              <p className="mt-1 text-sm font-bold" suppressHydrationWarning>
                Total: {formatPrice(displayTotal)}
              </p>
              {order?.paymentMethod === "pay_at_pickup" && paymentStatus !== "paid" ? (
                <p className="mt-1 text-sm font-semibold text-[#1C2526]/75">
                  💵 Pagas al recoger en el local
                </p>
              ) : null}
            </div>

            {order?.items?.length ? (
              <ul className="rounded-xl bg-white p-4 text-sm">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between py-1">
                    <span>
                      {it.quantity}x {it.name}
                    </span>
                    <span>{formatPrice(it.subtotal ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {whatsapp ? (
              <div className="rounded-2xl border border-[#25D366]/40 bg-[#F0FBF4] p-4 text-center">
                <p className="text-sm font-bold text-[#1C2526]">
                  📲 Confírmalo por WhatsApp
                </p>
                <p className="mt-1 text-xs text-[#1C2526]/60">
                  El restaurante ya tiene tu pedido — con el WhatsApp seguro lo
                  ven al momento, y te queda tu recibo con PIN en el chat.
                </p>
                <button
                  type="button"
                  onClick={handleWhatsappClick}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1ebe5b]"
                >
                  Confirmar por WhatsApp
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-[#1C2526]/60">
                El restaurante no tiene WhatsApp registrado.
              </p>
            )}

            {/* Phone Points v1: real balance behind an SMS verification.
                Only rendered once points were actually credited — before
                that, the estimate banner below sets the expectation. */}
            {order?.customerPhone && order?.loyaltyAwarded === true ? (
              <PhonePointsCard
                restaurantId={restaurantId}
                restaurantName={displayRestaurant}
                phone={order.customerPhone}
              />
            ) : null}

            {/* Points banner — Phone Points v1 truth (§4): points credit to
                the customer's NUMBER on confirmed payment; no app required.
                Pre-payment: future tense promise. Post-credit: the app is
                pitched as the wallet (see + notifications), never the gate. */}
            <div className="rounded-2xl border border-[#F28C38]/35 bg-[#FFF3E8] p-4 text-center">
              {(() => {
                const pts = mounted
                  ? estimateOrderPoints(displayTotal, order?.items, earnPolicy)
                  : 0;
                const credited = order?.loyaltyAwarded === true;
                if (credited) {
                  return (
                    <>
                      <p className="text-base font-bold text-[#1C2526]">
                        ⭐ Tus puntos ya están guardados en tu número
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#1C2526]/65">
                        Llévalos contigo: con la app Comeleal entras con tu
                        número, ves tus puntos de todos tus lugares y te
                        avisamos cuando tengas premios. 🔔
                      </p>
                      <a
                        href={downloadHref}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d67428]"
                      >
                        Descargar Comeleal
                      </a>
                    </>
                  );
                }
                return (
                  <>
                    <p className="text-base font-bold text-[#1C2526]">
                      {pts > 0
                        ? `🎉 Esta orden te va a dar ${pts} puntos en ${displayRestaurant} ⭐`
                        : "Esta orden te da puntos en Comeleal"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#1C2526]/65">
                      Se guardan solitos en tu número cuando pagues — sin apps,
                      sin tarjetitas.
                      {firstVisitReward
                        ? ` Y desbloqueas: ${firstVisitReward} GRATIS en tu próxima visita 🎁`
                        : ""}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          className="mt-6 block text-center text-sm underline text-[#1C2526]/70"
        >
          Volver al menú
        </Link>
      </main>
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-6" style={{ backgroundColor: "#F0E3D2" }}>
          <OrderStatusSkeleton />
        </div>
      }
    >
      <OrderStatusPageContent />
    </Suspense>
  );
}
