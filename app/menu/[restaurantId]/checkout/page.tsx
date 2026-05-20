"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart/CartProvider";
import { trackCheckoutStarted, trackOrderPlaced } from "@/lib/analytics/orderEvents";
import { ensureAnonymousUser } from "@/lib/auth";
import { requestMercadoPagoPreference } from "@/lib/mercadoPago/createPreferenceClient";
import { isMpWebDebugClient, mpWebDebugClient, urlHostOnly } from "@/lib/mercadoPago/mpWebDebug";
import { createCustomerWebOrder } from "@/lib/order/createCustomerOrder";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  PAYMENT_METHOD_MERCADO_PAGO,
  PAYMENT_METHOD_PAY_AT_PICKUP,
} from "@/lib/types/order";
import { formatPrice } from "@/lib/priceFormat";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";

type PaymentChoice = typeof PAYMENT_METHOD_PAY_AT_PICKUP | typeof PAYMENT_METHOD_MERCADO_PAGO;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const { lines, itemCount, subtotal, clear, cartReady } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(null);
  const [mercadoPagoAvailable, setMercadoPagoAvailable] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>(
    PAYMENT_METHOD_PAY_AT_PICKUP,
  );
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
          const mpOn =
            data.mercadoPagoConnected === true &&
            data.status === "active" &&
            data.isSetupComplete === true;
          setMercadoPagoAvailable(mpOn);
          if (!mpOn && paymentChoice === PAYMENT_METHOD_MERCADO_PAGO) {
            setPaymentChoice(PAYMENT_METHOD_PAY_AT_PICKUP);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [orderingEnabled, restaurantId, paymentChoice]);

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

    const mpDebugMode =
      isMpWebDebugClient() && paymentChoice === PAYMENT_METHOD_MERCADO_PAGO;
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
      paymentMethod: paymentChoice,
      mercadoPagoAvailable,
    });

    try {
      const user = await ensureAnonymousUser();

      mpWebDebugClient("order_create_start", {
        restaurantId,
        paymentMethod: paymentChoice,
      });

      const result = await createCustomerWebOrder({
        restaurantId,
        customerName: name,
        cartLines: lines,
        restaurantName,
        restaurantImageUrl,
        paymentMethod: paymentChoice,
      });

      mpWebDebugClient("order_create_success", {
        restaurantId,
        orderId: result.orderId,
        paymentMethod: paymentChoice,
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

      if (paymentChoice === PAYMENT_METHOD_MERCADO_PAGO) {
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

      clear();
      router.push(
        `/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(result.orderId)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No pudimos crear tu pedido.";
      mpWebDebugClient("order_create_error", {
        restaurantId,
        paymentMethod: paymentChoice,
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
        <ul className="mb-6 flex flex-col gap-2 rounded-xl bg-white p-4">
          {lines.map((l) => (
            <li key={l.menuItemId} className="flex justify-between text-sm">
              <span>
                {l.quantity}x {l.name}
              </span>
              <span className="font-semibold">{formatPrice(l.subtotal)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t pt-2 font-bold">
            <span>Total</span>
            <span style={{ color: "#F28C38" }}>{formatPrice(subtotal)}</span>
          </li>
        </ul>

        <fieldset className="mb-4 rounded-xl bg-white p-4">
          <legend className="mb-3 text-sm font-semibold">Forma de pago</legend>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 p-3">
              <input
                type="radio"
                name="payment"
                checked={paymentChoice === PAYMENT_METHOD_PAY_AT_PICKUP}
                onChange={() => setPaymentChoice(PAYMENT_METHOD_PAY_AT_PICKUP)}
                disabled={submitting}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">Pagar al recoger</span>
                <span className="block text-xs text-[#1C2526]/70">
                  Efectivo o terminal en el local
                </span>
              </span>
            </label>
            {mercadoPagoAvailable ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#009EE3]/30 p-3">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentChoice === PAYMENT_METHOD_MERCADO_PAGO}
                  onChange={() => setPaymentChoice(PAYMENT_METHOD_MERCADO_PAGO)}
                  disabled={submitting}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Pagar en línea con Mercado Pago
                  </span>
                  <span className="block text-xs text-[#1C2526]/70">
                    Sandbox — tarjeta de prueba en Mercado Pago
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-[#1C2526]/60">
                Pago en línea no disponible en este restaurante.
              </p>
            )}
          </div>
        </fieldset>

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
            disabled={submitting}
            className="rounded-xl py-3 font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#F28C38" }}
          >
            {submitting
              ? paymentChoice === PAYMENT_METHOD_MERCADO_PAGO
                ? "Redirigiendo a Mercado Pago…"
                : "Enviando…"
              : paymentChoice === PAYMENT_METHOD_MERCADO_PAGO
                ? "Pagar con Mercado Pago"
                : "Confirmar pedido"}
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
