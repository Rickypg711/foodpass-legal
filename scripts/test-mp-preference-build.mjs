/**
 * Unit-style check for Mercado Pago preference helpers (no API, no TS import).
 */

function shouldIncludeAutoReturn(successUrl) {
  try {
    return new URL(successUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function buildMercadoPagoPreferenceBody(input) {
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

  const body = {
    items: mpItems,
    external_reference: input.orderId,
    metadata: {
      order_id: input.orderId,
      restaurant_id: input.restaurantId,
    },
    back_urls: {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.pendingUrl,
    },
  };
  if (shouldIncludeAutoReturn(input.successUrl)) {
    body.auto_return = "approved";
  }
  return body;
}

function pickCheckoutRedirectUrl(preferenceResponse, sandboxMode) {
  const sandbox = preferenceResponse.sandbox_init_point;
  const prod = preferenceResponse.init_point;
  if (sandboxMode && typeof sandbox === "string" && sandbox.length > 0) {
    return sandbox;
  }
  return prod ?? sandbox ?? null;
}

const body = buildMercadoPagoPreferenceBody({
  orderId: "order-abc",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [{ title: "Taco", quantity: 2, unit_price: 50 }],
  total: 100,
  successUrl: "http://localhost/success",
  failureUrl: "http://localhost/failure",
  pendingUrl: "http://localhost/pending",
});

if ("auto_return" in body) {
  console.error("auto_return must be omitted for http localhost back_urls");
  process.exit(1);
}

const httpsBody = buildMercadoPagoPreferenceBody({
  orderId: "order-abc",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [],
  total: 10,
  successUrl: "https://www.comeleal.com/menu/success",
  failureUrl: "https://www.comeleal.com/menu/failure",
  pendingUrl: "https://www.comeleal.com/menu/pending",
});
if (httpsBody.auto_return !== "approved") {
  console.error("auto_return expected for https success URL");
  process.exit(1);
}

const tunnelHost = "abc123.trycloudflare.com";
const tunnelBody = buildMercadoPagoPreferenceBody({
  orderId: "order-tunnel",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [{ title: "Taco", quantity: 1, unit_price: 25 }],
  total: 25,
  successUrl: `https://${tunnelHost}/menu/tZYtg0Jt7vAyTLrxyljv/order/order-tunnel?payment=success`,
  failureUrl: `https://${tunnelHost}/menu/tZYtg0Jt7vAyTLrxyljv/order/order-tunnel?payment=failure`,
  pendingUrl: `https://${tunnelHost}/menu/tZYtg0Jt7vAyTLrxyljv/order/order-tunnel?payment=pending`,
});
if (tunnelBody.auto_return !== "approved") {
  console.error("auto_return expected for tunnel https back_urls");
  process.exit(1);
}
if (!tunnelBody.back_urls.success.startsWith("https://")) {
  console.error("tunnel back_urls must be https");
  process.exit(1);
}

if (body.external_reference !== "order-abc") {
  console.error("external_reference mismatch");
  process.exit(1);
}
if (body.metadata.restaurant_id !== "tZYtg0Jt7vAyTLrxyljv") {
  console.error("metadata.restaurant_id missing");
  process.exit(1);
}

const url = pickCheckoutRedirectUrl(
  {
    init_point: "https://www.mercadopago.com/prod",
    sandbox_init_point: "https://sandbox.mercadopago.com/test",
  },
  true,
);
if (!url || !url.includes("sandbox")) {
  console.error("expected sandbox redirect");
  process.exit(1);
}

console.log("OK: mercado pago preference builder");
