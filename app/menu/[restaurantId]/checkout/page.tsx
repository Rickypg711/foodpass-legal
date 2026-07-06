"use client";

import Image from "next/image";
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
import { formatPrice } from "@/lib/priceFormat";

/**
 * Same dark brand app bar as the menu (same container widths, same glow,
 * same divider), personalized with the restaurant's logo. One header
 * language across the whole ordering flow.
 */
function CheckoutHeader({
  restaurantId,
  restaurantName,
  logoUrl,
}: {
  restaurantId: string;
  restaurantName: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="relative overflow-hidden bg-[#141414] shadow-md">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(242,140,56,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-3xl items-center gap-3.5 px-4 py-4 sm:px-6 lg:max-w-4xl">
        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          aria-label="Volver al menú"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
        >
          ←
        </Link>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg ring-2 ring-white/15"
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F28C38]/15 text-xl ring-2 ring-white/10"
            aria-hidden
          >
            🍽
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-white">
            Confirmar pedido
          </h1>
          <p className="truncate text-xs text-white/55">
            {restaurantName} · Recoger en local
          </p>
        </div>
      </div>
      <div
        className="h-px bg-gradient-to-r from-transparent via-[#F28C38]/50 to-transparent"
        aria-hidden
      />
    </header>
  );
}

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
      <div className="min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F0E3D2] text-[#1C2526]">
        <CheckoutHeader
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          logoUrl={restaurantImageUrl}
        />
        <main className="mx-auto max-w-md px-4 py-10">
          <p className="text-center text-sm text-[#1C2526]/70">Cargando carrito…</p>
        </main>
      </div>
    );
  }

  if (itemCount === 0 && !checkoutOrder) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#FAF7F2] to-[#F0E3D2] text-[#1C2526]">
        <CheckoutHeader
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          logoUrl={restaurantImageUrl}
        />
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl shadow-sm"
            aria-hidden
          >
            🛒
          </div>
          <p className="mt-5 text-lg font-bold text-[#1C2526]">Tu carrito está vacío</p>
          <p className="mt-1 text-sm text-[#1C2526]/60">
            Agrega algo delicioso del menú para continuar.
          </p>
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}`}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F28C38] px-8 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#d67428]"
          >
            Ver el menú
          </Link>
        </main>
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
    <div className="min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F0E3D2] text-[#1C2526]">
      <CheckoutHeader
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          logoUrl={restaurantImageUrl}
        />

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
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="block">
              <span className="text-sm font-semibold">Tu nombre</span>
              <span className="mt-0.5 block text-xs text-[#1C2526]/55">
                Para avisarte cuando tu pedido esté listo.
              </span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2.5 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-[#1C2526]/35 focus:border-[#F28C38] focus:bg-white focus:ring-2 focus:ring-[#F28C38]/25"
                placeholder="Ej. Juan Pérez"
                autoComplete="name"
                disabled={submitting}
              />
            </label>
          </div>
          {error ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !mercadoPagoAvailable}
            className="min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-base font-bold text-white shadow-md transition-colors hover:bg-[#d67428] disabled:opacity-60"
          >
            {submitting ? "Redirigiendo a Mercado Pago…" : `Pagar ${formatPrice(subtotal)} · Mercado Pago`}
          </button>
          <p className="-mt-1 text-center text-xs text-[#1C2526]/50">
            🔒 Pago procesado de forma segura por Mercado Pago
          </p>
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
