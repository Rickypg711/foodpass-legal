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
import { resolveTableFromLocation } from "@/lib/order/tableSession";
import { loadDinerIdentity } from "@/lib/order/dinerIdentity";
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
import { getRestaurantSnapOnce } from "@/lib/restaurantDocCache";
import { isPositivelyClosedNow, scheduleStatus } from "@/lib/schedule";
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
  /** Mesa del QR (?mesa=). Vacío = pedido para recoger, como siempre. */
  const [tableNumber, setTableNumber] = useState("");
  const [diners, setDiners] = useState("");
  const [redemption, setRedemption] = useState<OrderRedemptionRequest | null>(null);
  const [earnPolicy, setEarnPolicy] = useState<{ base: number; step: number }>({ base: 1, step: 30 });
  const [loyalty, setLoyalty] = useState<{ points: number; tiers: { id: string; name: string; points: number }[] } | null>(null);
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [restaurantImageUrl, setRestaurantImageUrl] = useState<string | null>(null);
  const [mercadoPagoAvailable, setMercadoPagoAvailable] = useState(false);
  /** Vendor opt-in: "Pagar al recoger" (payAtPickupEnabled on the restaurant doc). */
  const [payAtPickupAvailable, setPayAtPickupAvailable] = useState(false);
  /**
   * Está SENTADO, no viene por su comida. Cambia tres cosas: no elige forma de
   * pago, el botón manda a cocina en vez de cobrar, y la letra chica dice que
   * paga al final con el mesero.
   */
  const enMesa = Boolean(tableNumber) && payAtPickupAvailable;
  /** Cerrado según horario configurado (lib/schedule) — bloquea el envío. */
  const [closedNow, setClosedNow] = useState(false);
  const [closedLabel, setClosedLabel] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<OrderPaymentMethod | null>(null);
  /** True once the restaurant MP check resolved — prevents the "MP no disponible"
   * warning from flashing while the check is still in flight. */
  const [mpChecked, setMpChecked] = useState(false);
  const mpSandboxUi =
    isMpWebDebugClient() || process.env.NEXT_PUBLIC_MERCADO_PAGO_SANDBOX === "true";
  const [submitting, setSubmitting] = useState(false);

  // La mesa viaja en sessionStorage desde que abrió el QR (?mesa=5).
  useEffect(() => {
    if (!restaurantId) return;
    setTableNumber(resolveTableFromLocation(restaurantId));
  }, [restaurantId]);

  // RONDA 2+ (25-ago, v2): nombre y teléfono se PREFILLEAN de lo que este
  // navegador ya tecleó antes (localStorage — la v1 usaba el snapshot de
  // sessionStorage, que vive POR PESTAÑA, y por eso desde otra pestaña volvía
  // a preguntar). Hacerle repetir a la misma persona lo que ya dijo hace una
  // ronda es la fricción exacta que mata el "pedir más".
  useEffect(() => {
    const prev = loadDinerIdentity();
    if (!prev) return;
    if (prev.name) setCustomerName((current) => current || prev.name);
    if (prev.phone) setCustomerPhone((current) => current || prev.phone);
  }, []);
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
        const snap = await getRestaurantSnapOnce(restaurantId);
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const name =
            typeof data.name === "string" && data.name.trim() ? data.name : "Restaurante";
          setRestaurantName(name);
          setRestaurantImageUrl(getRestaurantImageUrl(data));
          setEarnPolicy(earnPolicyFromRestaurant(data));
          setClosedNow(isPositivelyClosedNow(data));
          setClosedLabel(scheduleStatus(data)?.label ?? null);
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
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F28C38] px-8 py-3 text-sm font-semibold text-[#1C2526] shadow-md transition-colors hover:bg-[#d67428]"
          >
            Ver el menú
          </Link>
        </main>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (closedNow) {
      setError(
        closedLabel
          ? `El restaurante está cerrado — ${closedLabel.toLowerCase()}.`
          : "El restaurante está cerrado por ahora.",
      );
      return;
    }
    const name = customerName.trim();
    // En la mesa el nombre es opcional (espejo de `pickup_info_dialog` en la
    // app): nadie va a recoger nada, la comida va hacia él. Si lo dejó vacío
    // se manda vacío y `buildOrderPayload` no escribe un customerName: "" que
    // ensucie el CRM.
    if (!enMesa && name.length < 2) {
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

    // Sentado en la mesa 5 no hay decisión de pago que tomar: comes primero y
    // pagas al final, con el mesero. Solo se respeta si el dueño prendió
    // "Pagar al recoger" — si nunca lo prendió, no le vamos a inventar pedidos
    // sin cobrar; ese restaurante sigue cobrando en línea.
    const enMesaSePagaAlFinal = Boolean(tableNumber) && payAtPickupAvailable;

    const chosenMethod = enMesaSePagaAlFinal
      ? PAYMENT_METHOD_PAY_AT_PICKUP
      : payMethod ??
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
          tableNumber,
          diners: diners ? Number.parseInt(diners, 10) : null,
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
        tableNumber,
        diners: diners ? Number.parseInt(diners, 10) : null,
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
          {/* ── Comiendo aquí: llegó por el QR de su mesa ── */}
          {tableNumber ? (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(242,140,56,0.08)",
                border: "1px solid rgba(242,140,56,0.35)",
              }}
            >
              <p className="text-[15px] font-bold text-[#1C2526]">
                🍽️ Estás ordenando para la mesa{" "}
                <span className="text-[#F28C38]">{tableNumber}</span>
              </p>
              <p className="mt-1 text-xs text-[#1C2526]/60">
                Tu pedido llega directo a la cocina y te lo llevamos a tu mesa.
                No tienes que formarte.
              </p>
              <label className="mt-3 block">
                <span className="text-sm font-semibold">
                  ¿Cuántas personas son?{" "}
                  <span className="font-normal text-[#1C2526]/45">(opcional)</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={diners}
                  onChange={(e) => setDiners(e.target.value)}
                  placeholder="Ej. 4"
                  className="mt-1.5 w-28 rounded-xl border border-[#1C2526]/15 bg-white px-3 py-2 text-[15px] outline-none focus:border-[#F28C38]"
                />
              </label>
            </div>
          ) : null}

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
                Tu nombre{" "}
                {enMesa ? (
                  <span className="font-normal text-[#1C2526]/45">(opcional)</span>
                ) : (
                  <span className="text-[#F28C38]">*</span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-[#1C2526]/55">
                {/* En la mesa nadie recoge nada: la comida va hacia él. El
                    nombre sirve para que el mesero sepa de quién es cada plato
                    cuando la mesa pidió varias cosas, no para gritarlo. */}
                {enMesa
                  ? "Para que el mesero sepa cuál platillo es tuyo."
                  : "Para avisarte cuando tu pedido esté listo."}
              </span>
              <input
                type="text"
                required={!enMesa}
                minLength={enMesa ? 0 : 2}
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

          {/* Forma de pago — last decision before the CTA it controls.
              En una mesa no se muestra: ver `enMesaSePagaAlFinal`. */}
          {enMesa ? null : mpChecked && mercadoPagoAvailable && payAtPickupAvailable ? (
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
          {closedNow ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm text-red-800">
                😴 El restaurante está cerrado por ahora
                {closedLabel ? ` — ${closedLabel.toLowerCase()}` : ""}. Tu carrito se
                queda guardado para cuando abra.
              </p>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={submitting || closedNow || (!mercadoPagoAvailable && !payAtPickupAvailable)}
            className="min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-base font-bold text-[#1C2526] shadow-md transition-colors hover:bg-[#d67428] disabled:opacity-60"
          >
            {submitting
              ? enMesa
                ? "Mandando a la cocina…"
                : payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
                  ? "Enviando tu pedido…"
                  : "Redirigiendo a Mercado Pago…"
              : enMesa
                ? `Mandar a la cocina · ${formatPrice(subtotal)}`
                : payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
                  ? `Ordenar ${formatPrice(subtotal)} · Pagas al recoger`
                  : `Pagar ${formatPrice(subtotal)} · Mercado Pago`}
          </button>
          <p className="-mt-1 text-center text-xs text-[#1C2526]/50">
            {enMesa
              ? "🍽️ Se agrega a la cuenta de tu mesa. Pagas al final."
              : payMethod === PAYMENT_METHOD_PAY_AT_PICKUP
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
