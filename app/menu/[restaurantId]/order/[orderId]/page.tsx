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
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { trackWhatsappOrderMessageSent } from "@/lib/analytics/orderEvents";
import type { CartLine } from "@/lib/cart/types";
import type { StoredOrderSnapshot } from "@/lib/types/order";

type OrderDoc = {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  customerName?: string;
  pickupPin?: string;
  total?: number;
  items?: Array<{
    name?: string;
    quantity?: number;
    subtotal?: number;
  }>;
  restaurantName?: string;
};

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
      <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#d97757" }}>
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
              <p className="mt-1 text-xl font-bold" style={{ color: "#d97757" }}>
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
              <button
                type="button"
                onClick={handleWhatsappClick}
                className="w-full rounded-xl border border-[#25D366] bg-white py-3 text-sm font-semibold text-[#128C7E]"
              >
                Enviar resumen por WhatsApp
              </button>
            ) : (
              <p className="text-center text-xs text-[#1C2526]/60">
                El restaurante no tiene WhatsApp registrado.
              </p>
            )}

            <div className="rounded-xl border border-[#d97757]/30 bg-white/80 p-4 text-center">
              <p className="text-sm font-semibold">Crea tu cuenta para guardar tus puntos</p>
              <a
                href={downloadHref}
                className="mt-2 inline-block text-sm font-semibold text-[#d97757] underline"
              >
                Descargar Comeleal
              </a>
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
