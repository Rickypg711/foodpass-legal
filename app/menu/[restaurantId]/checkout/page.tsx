"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckoutCartLines } from "@/components/cart/CheckoutCartLines";
import { UpsellCard } from "@/components/cart/UpsellCard";
import { useCart } from "@/lib/cart/CartProvider";
import { trackCheckoutStarted, trackOrderPlaced } from "@/lib/analytics/orderEvents";
import { ensureAnonymousUser } from "@/lib/auth";
import { requestMercadoPagoPreference } from "@/lib/mercadoPago/createPreferenceClient";
import { isMpWebDebugClient, mpWebDebugClient, urlHostOnly } from "@/lib/mercadoPago/mpWebDebug";
import { createCustomerWebOrder } from "@/lib/order/createCustomerOrder";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { ORDER_SOURCE_CUSTOMER_WEB } from "@/lib/types/order";
import {
  CUSTOMER_WEB_PAYMENT_METHOD,
  MP_UNAVAILABLE_MESSAGE,
  mercadoPagoCheckoutSubtitle,
  mercadoPagoCheckoutTitle,
  restaurantSupportsWebCheckout,
} from "@/lib/order/customerWebCheckoutPolicy";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";

export default function CheckoutPage() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const { lines, itemCount, subtotal, clear, cartReady } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(null);
  const [mercadoPagoAvailable, setMercadoPagoAvailable] = useState(false);
  const mpSandboxUi =
    isMpWebDebugClient() || process.env.NEXT_PUBLIC_MERCADO_PAGO_SANDBOX === "true";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLogged, setCheckoutLogged] = useState(false);
  /** Set as soon as order is created — keeps checkout UI when cart is cleared later. */
  const [checkoutOrder, setCheckoutOrder] = useState<{
    orderId: string;
    redirectUrlHost?: string | null;
    redirectSource?: string | null;
    mpNewTab?: boolean;
    mpPopupBlocked?: boolean;
    /** Client-only fallback link when popup was blocked (not logged). */
    mpRedirectUrl?: string;
  } | null>(null);

  const orderingEnabled = isWebOrderingEnabled();

  useEffect(() => {
    if (!orderingEnabled || !restaurantId) return;
    if (!checkoutLogged && itemCount > 0) {
      trackCheckoutStarted({
        restaurantId,
        cartItemCount: itemCount,
        cartTotal: subtotal,
      });
      setCheckoutLogged(true);
    }
  }, [orderingEnabled, restaurantId, itemCount, subtotal, checkoutLogged]);

  useEffect(() => {
    if (!orderingEnabled || !restaurantId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const name =
            typeof data.name === "string" && data.name.trim() ? data.name : "Restaurante";
          setRestaurantName(name);
          setRestaurantImageUrl(getRestaurantImageUrl(data));
          setMercadoPagoAvailable(
            restaurantSupportsWebCheckout(restaurantId, data),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [orderingEnabled, restaurantId]);

  useEffect(() => {
    if (!cartReady || itemCount > 0 || checkoutOrder) return;
    mpWebDebugClient("checkout_empty_cart_redirect", { restaurantId, cartReady });
  }, [cartReady, itemCount, checkoutOrder, restaurantId]);

  if (!orderingEnabled) {
    return (
      <div className="min-h-screen p-6 text-center" style={{ backgroundColor: "#F0E3D2" }}>
        <p className="text-sm">Pedidos en línea no disponibles.</p>
        <Link href={`/menu/${restaurantId}`} className="mt-4 inline-block text-[#F28C38] underline">
          Volver al menú
        </Link>
      </div>
    );
  }

  if (!restaurantId) {
    return <p className="p-6 text-center">Restaurante no válido</p>;
  }

  if (!cartReady) {
    return (
      <div className="min-h-screen text-[#1C2526]" style={{ backgroundColor: "#F0E3D2" }}>
        <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
          <h1 className="text-lg font-semibold text-white">Confirmar pedido</h1>
        </header>
        <main className="mx-auto max-w-md px-4 py-6">
          <p className="text-center text-sm text-[#1C2526]/80">Cargando carrito…</p>
        </main>
      </div>
    );
  }

  if (itemCount === 0 && !checkoutOrder) {
    return (
      <div className="min-h-screen p-6 text-center" style={{ backgroundColor: "#F0E3D2" }}>
        <p className="text-sm">Tu carrito está vacío.</p>
        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          className="mt-4 inline-block text-[#F28C38] font-semibold"
        >
          Volver al menú
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = customerName.trim();
    if (name.length < 2) {
      setError("Ingresa tu nombre (mínimo 2 caracteres).");
      return;
    }
    setError(null);
    setSubmitting(true);

    if (!mercadoPagoAvailable) {
      setError(MP_UNAVAILABLE_MESSAGE);
      return;
    }

    const mpDebugMode = isMpWebDebugClient();
    let mpDebugWindow: Window | null = null;
    if (mpDebugMode) {
      mpDebugWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
      mpWebDebugClient("checkout_debug_tab_preopened", {
        popupBlocked: mpDebugWindow == null,
      });
    }

    mpWebDebugClient("checkout_submit_start", {
      restaurantId,
      cartItemCount: itemCount,
      paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
      mercadoPagoAvailable,
    });

    try {
      const user = await ensureAnonymousUser();

      mpWebDebugClient("order_create_start", {
        restaurantId,
        paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
      });

      const result = await createCustomerWebOrder({
        restaurantId,
        customerName: name,
        cartLines: lines,
        restaurantName,
        restaurantImageUrl,
        paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
      });

      mpWebDebugClient("order_create_success", {
        restaurantId,
        orderId: result.orderId,
        paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
      });

      mpWebDebugClient("order_created_before_cart_clear", {
        restaurantId,
        orderId: result.orderId,
        cartItemCount: itemCount,
      });

      setCheckoutOrder({ orderId: result.orderId });

      trackOrderPlaced({
        restaurantId,
        orderId: result.orderId,
        orderSource: ORDER_SOURCE_CUSTOMER_WEB,
        total: result.total,
      });

      {
        mpWebDebugClient("create_preference_start", {
          restaurantId,
          orderId: result.orderId,
        });
        try {
          const pref = await requestMercadoPagoPreference({
            restaurantId,
            orderId: result.orderId,
            customerId: user.uid,
          });
          mpWebDebugClient("create_preference_success", {
            restaurantId,
            orderId: result.orderId,
            redirectUrlHost: urlHostOnly(pref.redirectUrl),
            redirectSource: pref.redirectSource ?? null,
            sandboxMode: pref.sandboxMode,
          });
          const redirectUrlHost = urlHostOnly(pref.redirectUrl);
          const redirectSource = pref.redirectSource ?? null;

          if (mpDebugMode) {
            if (mpDebugWindow) {
              mpDebugWindow.location.href = pref.redirectUrl;
              mpWebDebugClient("checkout_redirect_open_new_tab_success", {
                redirectUrlHost,
                redirectSource,
              });
              setCheckoutOrder({
                orderId: result.orderId,
                redirectUrlHost,
                redirectSource,
                mpNewTab: true,
              });
            } else {
              mpWebDebugClient("checkout_redirect_open_new_tab_blocked", {
                redirectUrlHost,
                redirectSource,
              });
              setCheckoutOrder({
                orderId: result.orderId,
                redirectUrlHost,
                redirectSource,
                mpPopupBlocked: true,
                mpRedirectUrl: pref.redirectUrl,
              });
            }
            clear();
            setSubmitting(false);
            return;
          }

          mpWebDebugClient("checkout_redirect", {
            redirectUrlHost,
            redirectSource,
          });
          clear();
          window.location.href = pref.redirectUrl;
          return;
        } catch (prefErr) {
          if (mpDebugWindow && !mpDebugWindow.closed) {
            mpDebugWindow.close();
          }
          const message = prefErr instanceof Error ? prefErr.message : "preference_error";
          mpWebDebugClient("create_preference_error", {
            restaurantId,
            orderId: result.orderId,
            message,
          });
          throw prefErr;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No pudimos crear tu pedido.";
      mpWebDebugClient("order_create_error", {
        restaurantId,
        paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
        message,
      });
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-[#1C2526]" style={{ backgroundColor: "#F0E3D2" }}>
      <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
        <h1 className="text-lg font-semibold text-white">Confirmar pedido</h1>
        <p className="text-xs text-white/90">{restaurantName} · Recoger en local</p>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {checkoutOrder?.mpPopupBlocked && checkoutOrder.mpRedirectUrl ? (
          <div
            className="mb-4 rounded-xl border border-amber-400/50 bg-white p-4 text-sm text-[#1C2526]"
            role="status"
          >
            <p className="font-medium">
              No se pudo abrir Mercado Pago automáticamente. Usa el botón para continuar el pago.
            </p>
            <p className="mt-2 text-xs text-[#1C2526]/70">
              Orden: <span className="font-mono">{checkoutOrder.orderId}</span>
              {checkoutOrder.redirectUrlHost ? (
                <>
                  {" "}
                  · MP: {checkoutOrder.redirectUrlHost}
                </>
              ) : null}
            </p>
            <a
              href={checkoutOrder.mpRedirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#009EE3" }}
            >
              Abrir Mercado Pago
            </a>
            <Link
              href={`/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(checkoutOrder.orderId)}`}
              className="mt-3 ml-3 inline-block text-sm font-semibold text-[#F28C38] underline"
            >
              Ver estado del pedido
            </Link>
          </div>
        ) : checkoutOrder?.mpNewTab ? (
          <div
            className="mb-4 rounded-xl border border-[#009EE3]/40 bg-white p-4 text-sm text-[#1C2526]"
            role="status"
          >
            <p className="font-medium">
              Mercado Pago se abrió en otra pestaña. Mantén esta página abierta para ver el
              estado.
            </p>
            <p className="mt-2 text-xs text-[#1C2526]/70">
              Orden: <span className="font-mono">{checkoutOrder.orderId}</span>
              {checkoutOrder.redirectUrlHost ? (
                <>
                  {" "}
                  · MP: {checkoutOrder.redirectUrlHost}
                </>
              ) : null}
            </p>
            <Link
              href={`/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(checkoutOrder.orderId)}`}
              className="mt-3 inline-block text-sm font-semibold text-[#F28C38] underline"
            >
              Ver estado del pedido
            </Link>
          </div>
        ) : checkoutOrder && itemCount === 0 ? (
          <div
            className="mb-4 rounded-xl border border-[#F28C38]/30 bg-white p-4 text-sm text-[#1C2526]"
            role="status"
          >
            <p className="font-medium">Pedido creado.</p>
            <p className="mt-2 text-xs text-[#1C2526]/70">
              Orden: <span className="font-mono">{checkoutOrder.orderId}</span>
            </p>
            <Link
              href={`/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(checkoutOrder.orderId)}`}
              className="mt-3 inline-block text-sm font-semibold text-[#F28C38] underline"
            >
              Ver estado del pedido
            </Link>
          </div>
        ) : null}
        <CheckoutCartLines />

        {/* AI upsell suggestion (renders nothing if there's no suggestion) */}
        <UpsellCard restaurantId={restaurantId} />

        <div className="mb-4 rounded-xl bg-white p-4">
          <p className="mb-2 text-sm font-semibold">Forma de pago</p>
          {mercadoPagoAvailable ? (
            <div className="rounded-lg border border-[#009EE3]/30 p-3">
              <p className="text-sm font-medium">
                {mercadoPagoCheckoutTitle(mpSandboxUi)}
              </p>
              <p className="mt-1 text-xs text-[#1C2526]/70">
                {mercadoPagoCheckoutSubtitle(mpSandboxUi)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-red-800">{MP_UNAVAILABLE_MESSAGE}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium">Tu nombre</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2"
              placeholder="Ej. Juan Pérez"
              autoComplete="name"
              disabled={submitting}
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || !mercadoPagoAvailable}
            className="rounded-xl py-3 font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#F28C38" }}
          >
            {submitting ? "Redirigiendo a Mercado Pago…" : "Pagar con Mercado Pago"}
          </button>
        </form>

        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          className="mt-4 block text-center text-sm text-[#1C2526]/70 underline"
        >
          Volver al menú
        </Link>
      </main>
    </div>
  );
}
