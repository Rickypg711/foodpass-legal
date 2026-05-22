import { calculateMarketplaceFeeAmount } from "@/lib/mercadoPago/marketplaceFee";

export type PreferenceCartItem = {
  title: string;
  quantity: number;
  unit_price: number;
};

export type BuildPreferenceBodyInput = {
  orderId: string;
  restaurantId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  items: PreferenceCartItem[];
  total: number;
  /** Commission rate 0–1 (e.g. 0.03 = 3%). Omitted or 0 → no marketplace_fee on preference. */
  marketplaceFeeRate?: number;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl?: string;
  statementDescriptor?: string;
};

/** Mercado Pago rejects auto_return when back_urls use non-HTTPS URLs (e.g. localhost). */
export function shouldIncludeAutoReturn(successUrl: string): boolean {
  try {
    return new URL(successUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildMercadoPagoPreferenceBody(
  input: BuildPreferenceBodyInput,
): Record<string, unknown> {
  const mpItems =
    input.items.length > 0
      ? input.items.map((item) => ({
          title: item.title.slice(0, 256),
          quantity: Math.max(1, Math.round(item.quantity)),
          unit_price: Number(item.unit_price),
          currency_id: "MXN",
        }))
      : [
          {
            title: `Pedido ${input.orderId}`,
            quantity: 1,
            unit_price: input.total,
            currency_id: "MXN",
          },
        ];

  const payer: Record<string, string> = {};
  if (input.customerEmail?.trim()) {
    payer.email = input.customerEmail.trim();
  }
  const firstName = input.customerName?.trim();
  if (firstName) {
    payer.first_name = firstName.slice(0, 100);
  }

  const body: Record<string, unknown> = {
    items: mpItems,
    external_reference: input.orderId,
    back_urls: {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.pendingUrl,
    },
    metadata: {
      order_id: input.orderId,
      restaurant_id: input.restaurantId,
      customer_id: input.customerId ?? null,
    },
  };

  if (shouldIncludeAutoReturn(input.successUrl)) {
    body.auto_return = "approved";
  }

  if (input.notificationUrl?.trim()) {
    body.notification_url = input.notificationUrl.trim();
  }
  if (Object.keys(payer).length > 0) {
    body.payer = payer;
  }

  const descriptor = (input.statementDescriptor ?? "COMELEAL").slice(0, 22);
  body.statement_descriptor = descriptor;

  const marketplaceFeeAmount = calculateMarketplaceFeeAmount(
    input.total,
    input.marketplaceFeeRate ?? 0,
  );
  if (marketplaceFeeAmount > 0) {
    body.marketplace_fee = marketplaceFeeAmount;
  }

  return body;
}

/** Experiment: use init_point redirect while MERCADO_PAGO_SANDBOX stays true. */
export function isForceInitPointMode(): boolean {
  return process.env.MERCADO_PAGO_FORCE_INIT_POINT === "true";
}

export function pickCheckoutRedirectUrl(
  preferenceResponse: Record<string, unknown>,
  sandboxMode: boolean,
): string | null {
  const sandbox = preferenceResponse.sandbox_init_point;
  const prod = preferenceResponse.init_point;
  const useSandboxRedirect = sandboxMode && !isForceInitPointMode();
  if (useSandboxRedirect && typeof sandbox === "string" && sandbox.length > 0) {
    return sandbox;
  }
  if (typeof prod === "string" && prod.length > 0) {
    return prod;
  }
  if (typeof sandbox === "string" && sandbox.length > 0) {
    return sandbox;
  }
  return null;
}
