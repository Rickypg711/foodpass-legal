"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  PAYMENT_METHOD_MERCADO_PAGO,
  PAYMENT_METHOD_PAY_AT_PICKUP,
  type OrderPaymentMethod,
  type OrderRedemptionRequest,
} from "@/lib/types/order";
import { CheckoutRedemption } from "@/components/loyalty/CheckoutRedemption";
import { earnPolicyFromRestaurant } from "@/lib/loyalty/phonePoints";
import type { UpsellGoalContext } from "@/components/cart/UpsellCard";
import {
  CUSTOMER_WEB_PAYMENT_METHOD,
  ORDERING_UNAVAILABLE_MESSAGE,
  mercadoPagoCheckoutTitle,
  restaurantAllowsPayAtPickup,
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
  const router = useRouter();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const { lines, itemCount, subtotal, clear, cartReady } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [redemption, setRedemption] = useState<OrderRedemptionRequest | null>(null);
  const [earnPolicy, setEarnPolicy] = useState<{ base: number; step: number }>({ base: 1, step: 30 });
  const [loyalty, setLoyalty] = useState<{ points: number; tiers: { id: string; name: string; points: number }[] } | null>(null);
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(null);
  const [mercadoPagoAvailable, setMercadoPagoAvailable] = useState(false);
  /** Vendor opt-in: "Pagar al recoger" (payAtPickupEnabled on the restaurant doc). */
  const [payAtPickupAvailable, setPayAtPickupAvailable] = useState(false);
  const [payMethod, setPayMethod] = useState<OrderPaymentMethod | null>(null);
  /** True once the restaurant MP check resolved — prevents the "MP no disponible"
   * warning from flashing while the check is still in flight. */
  const [mpChecked, setMpChecked] = useState(false);
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
          setEarnPolicy(earnPolicyFromRestaurant(data));
          const mpOk = restaurantSupportsWebCheckout(restaurantId, data);
          const papOk = restaurantAllowsPayAtPickup(data);
          setMercadoPagoAvailable(mpOk);
          setPayAtPickupAvailable(papOk);
          // Default selection: MP when available (pay-before-prepare stays the
          // preferred path); otherwise pay-at-pickup if the vendor allows it.
          setPayMethod(
            mpOk
              ? PAYMENT_METHOD_MERCADO_PAGO
              : papOk
                ? PAYMENT_METHOD_PAY_AT_PICKUP
                : null,
          );
        }
      } catch {
        /* ignore */
      } finally {
        setMpChecked(true);
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
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Ingresa tu WhatsApp (10 dígitos) para avisarte de tu pedido.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const chosenMethod =
      payMethod ??
      (mercadoPagoAvailable
        ? PAYMENT_METHOD_MERCADO_PAGO
        : payAtPickupAvailable
          ? PAYMENT_METHOD_PAY_AT_PICKUP
          : null);

    if (chosenMethod === null) {
      setError(ORDERING_UNAVAILABLE_MESSAGE);
      setSubmitting(false);
      return;
    }

    // ── Pagar al recoger: create the order and go straight to the order page
    // (WhatsApp handoff lives there). No MP preference, no redirect. Loyalty
    // is NOT awarded here — points credit when the vendor marks it cobrada.
    if (chosenMethod === PAYMENT_METHOD_PAY_AT_PICKUP) {
      mpWebDebugClient("checkout_submit_start", {
        restaurantId,
        cartItemCount: itemCount,
        paymentMethod: PAYMENT_METHOD_PAY_AT_PICKUP,
        mercadoPagoAvailable,
      });
      try {
        const result = await createCustomerWebOrder({
          restaurantId,
          customerName: name,
          customerPhone: phoneDigits,
          cartLines: lines,
          restaurantName,
          restaurantImageUrl,
          paymentMethod: PAYMENT_METHOD_PAY_AT_PICKUP,
          redemptionRequest: redemption,
        });
        mpWebDebugClient("order_create_success", {
          restaurantId,
          orderId: result.orderId,
          paymentMethod: PAYMENT_METHOD_PAY_AT_PICKUP,
        });
        setCheckoutOrder({ orderId: result.orderId });
        trackOrderPlaced({
          restaurantId,
          orderId: result.orderId,
          orderSource: ORDER_SOURCE_CUSTOMER_WEB,
          total: result.total,
        });
        clear();
        router.push(
          `/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(result.orderId)}`,
        );
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "No pudimos crear tu pedido.";
        mpWebDebugClient("order_create_error", {
          restaurantId,
          paymentMethod: PAYMENT_METHOD_PAY_AT_PICKUP,
          message,
        });
        setError(message);
        setSubmitting(false);
        return;
      }
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
        customerPhone: phoneDigits,
        cartLines: lines,
        restaurantName,
        restaurantImageUrl,
        paymentMethod: CUSTOMER_WEB_PAYMENT_METHOD,
        redemptionRequest: redemption,
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

        {/* Identity-first checkout: the PHONE is the key — it activates the
            redemption block and personalizes the upsell (goal-gradient).
            Screen order: identity → tus premios → upsell → forma de pago → CTA. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="block">
              <span className="text-sm font-semibold">
                Tu WhatsApp <span className="text-[#F28C38]">*</span>
              </span>
              <span className="mt-0.5 block text-xs text-[#1C2526]/55">
                Aquí viven tus puntos y tus premios ⭐ — y te avisamos de tu
                pedido. Solo números, 10 dígitos.
              </span>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-2.5 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-[#1C2526]/35 focus:border-[#F28C38] focus:bg-white focus:ring-2 focus:ring-[#F28C38]/25"
                placeholder="Ej. 614 123 4567"
                autoComplete="tel"
                maxLength={16}
                disabled={submitting}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-semibold">
                Tu nombre <span className="text-[#F28C38]">*</span>
              </span>
              <span className="mt-0.5 block text-xs text-[#1C2526]/55">
                Para avisarte cuando tu pedido esté listo.
              </span>
              <input
                type="text"
                required
                minLength={2}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2.5 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-[#1C2526]/35 focus:border-[#F28C38] focus:bg-white focus:ring-2 focus:ring-[#F28C38]/25"
                placeholder="Ej. Juan Pérez"
                autoComplete="name"
                disabled={submitting}
              />
            </label>
          </div>

          {/* Redemption: use unlocked rewards on THIS order (phone-verified). */}
          <CheckoutRedemption
            restaurantId={restaurantId}
            phoneDigits={customerPhone}
            selected={redemption}
            onSelect={setRedemption}
            onLoyalty={(info) => {
              setLoyalty(info);
              // Returning customer: autofill the name we already know (only
              // reachable behind their verified number — no fishing).
              if (info.name) {
                setCustomerName((prev) => (prev.trim() ? prev : info.name!));
              }
            }}
          />
          {redemption ? (
            <p className="-mt-2 rounded-xl bg-[#F0FBF4] px-3.5 py-2.5 text-sm font-semibold text-[#16A34A]">
              🎁 En este pedido: {redemption.name} GRATIS (canje de {redemption.points} pts)
            </p>
          ) : null}

          {/* AI upsell — arrives AFTER identity, so the goal-gradient line
              ("te faltarían solo N pts para tu X GRATIS") is live when the
              customer reaches it. */}
          <UpsellCard
            restaurantId={restaurantId}
            goal={(() => {
              if (!loyalty || loyalty.tiers.length === 0) return null;
              // Gap math on the balance AFTER the canje they selected — if
              // they're spending 50 pts on this order, the countdown to the
              // NEXT reward is what's real again.
              const effective = loyalty.points - (redemption?.points ?? 0);
              const next = loyalty.tiers.find((t) => t.points > effective);
              if (!next) {
                // Everything unlocked (even after the canje): no gap exists —
                // celebrate + drive the redemption instead of going silent.
                const top = loyalty.tiers[loyalty.tiers.length - 1];
                return {
                  balance: effective,
                  nextTierName: "",
                  nextTierPoints: 0,
                  earnBase: earnPolicy.base,
                  earnStep: earnPolicy.step,
                  cartTotal: subtotal,
                  maxed: true,
                  topTierName: top?.name,
                } satisfies UpsellGoalContext;
              }
              return {
                balance: effective,
                nextTierName: next.name,
                nextTierPoints: next.points,
                earnBase: earnPolicy.base,
                earnStep: earnPolicy.step,
                cartTotal: subtotal,
              } satisfies UpsellGoalContext;
            })()}
          />

          {/* Forma de pago — last decision before the CTA it controls. */}
          {mpChecked && mercadoPagoAvailable && payAtPickupAvailable ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Forma de pago</p>
              <div className="mt-2.5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPayMethod(PAYMENT_METHOD_MERCADO_PAGO)}
                  aria-pressed={payMethod === PAYMENT_METHOD_MERCADO_PAGO}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    payMethod === PAYMENT_METHOD_MERCADO_PAGO
                      ? "border-[#F28C38] bg-[#FFF3E8] ring-2 ring-[#F28C38]/25"
                      : "border-[#1C2526]/12 bg-[#FAF7F2] hover:border-[#F28C38]/50"
                  }`}
                >
                  <span className="text-xl" aria-hidden>💳</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Pagar en línea</span>
                    <span className="block text-xs text-[#1C2526]/55">
                      Mercado Pago · tarjeta, OXXO y más
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPayMethod(PAYMENT_METHOD_PAY_AT_PICKUP)}
                  aria-pressed={payMethod === PAYMENT_METHOD_PAY_AT_PICKUP}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
                      ? "border-[#F28C38] bg-[#FFF3E8] ring-2 ring-[#F28C38]/25"
                      : "border-[#1C2526]/12 bg-[#FAF7F2] hover:border-[#F28C38]/50"
                  }`}
                >
                  <span className="text-xl" aria-hidden>💵</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Pagar al recoger</span>
                    <span className="block text-xs text-[#1C2526]/55">
                      Efectivo o tarjeta en el local
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : mpChecked && !mercadoPagoAvailable && !payAtPickupAvailable ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm text-red-800">{ORDERING_UNAVAILABLE_MESSAGE}</p>
            </div>
          ) : mpSandboxUi && payMethod !== PAYMENT_METHOD_PAY_AT_PICKUP ? (
            <p className="text-center text-xs text-[#1C2526]/45">
              {mercadoPagoCheckoutTitle(mpSandboxUi)} · modo prueba
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || (!mercadoPagoAvailable && !payAtPickupAvailable)}
            className="min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-base font-bold text-white shadow-md transition-colors hover:bg-[#d67428] disabled:opacity-60"
          >
            {submitting
              ? payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
                ? "Enviando tu pedido…"
                : "Redirigiendo a Mercado Pago…"
              : payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
                ? `Ordenar ${formatPrice(subtotal)} · Pagas al recoger`
                : `Pagar ${formatPrice(subtotal)} · Mercado Pago`}
          </button>
          <p className="-mt-1 text-center text-xs text-[#1C2526]/50">
            {payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
              ? "💵 Pagas en el local al recoger tu pedido"
              : "🔒 Pago procesado de forma segura por Mercado Pago"}
          </p>
          <p className="-mt-2 text-center text-[11px] text-[#1C2526]/40">
            Al ordenar aceptas nuestro{" "}
            <a
              href="/privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Aviso de Privacidad
            </a>
            . Usamos tu número para tu pedido, tus puntos y para que el
            restaurante te avise de premios o promociones — puedes pedir que
            dejen de escribirte cuando quieras.
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
