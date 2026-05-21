/**
 * Unit-style check for Mercado Pago preference helpers (no API, no TS import).
 * Keep marketplace fee helpers aligned with lib/mercadoPago/marketplaceFee.ts
 */

function parseMarketplaceFeeRate(raw) {
  if (raw == null || String(raw).trim() === "") {
    return 0;
  }
  const n = Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return n;
}

function calculateMarketplaceFeeAmount(total, rate) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  if (safeTotal === 0 || safeRate === 0) {
    return 0;
  }
  return Math.round(safeTotal * safeRate * 100) / 100;
}

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

  const marketplaceFeeAmount = calculateMarketplaceFeeAmount(
    input.total,
    input.marketplaceFeeRate ?? 0,
  );
  if (marketplaceFeeAmount > 0) {
    body.marketplace_fee = marketplaceFeeAmount;
  }

  return body;
}

function isForceInitPointMode() {
  return process.env.MERCADO_PAGO_FORCE_INIT_POINT === "true";
}

function pickCheckoutRedirectUrl(preferenceResponse, sandboxMode) {
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

function assertNoFee(label, body) {
  if ("marketplace_fee" in body) {
    console.error(`${label}: marketplace_fee must be omitted when rate is 0`);
    process.exit(1);
  }
}

function assertFee(label, body, expected) {
  if (body.marketplace_fee !== expected) {
    console.error(
      `${label}: expected marketplace_fee ${expected}, got ${body.marketplace_fee}`,
    );
    process.exit(1);
  }
}

// --- marketplace fee rate parsing ---
if (parseMarketplaceFeeRate(undefined) !== 0) {
  console.error("parseMarketplaceFeeRate(undefined) should be 0");
  process.exit(1);
}
if (parseMarketplaceFeeRate("") !== 0) {
  console.error("parseMarketplaceFeeRate('') should be 0");
  process.exit(1);
}
if (parseMarketplaceFeeRate("0") !== 0) {
  console.error("parseMarketplaceFeeRate('0') should be 0");
  process.exit(1);
}
if (parseMarketplaceFeeRate("0.017") !== 0.017) {
  console.error("parseMarketplaceFeeRate('0.017') should be 0.017");
  process.exit(1);
}

// --- fee amount rounding ---
if (calculateMarketplaceFeeAmount(20, 0.017) !== 0.34) {
  console.error("20 * 0.017 should round to 0.34 MXN");
  process.exit(1);
}
if (calculateMarketplaceFeeAmount(100, 0.017) !== 1.7) {
  console.error("100 * 0.017 should be 1.7 MXN");
  process.exit(1);
}
if (calculateMarketplaceFeeAmount(10.005, 0.017) !== 0.17) {
  console.error("10.005 * 0.017 should round to 0.17 MXN");
  process.exit(1);
}
if (calculateMarketplaceFeeAmount(20, 0) !== 0) {
  console.error("rate 0 should yield fee 0");
  process.exit(1);
}

const body = buildMercadoPagoPreferenceBody({
  orderId: "order-abc",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [{ title: "Taco", quantity: 2, unit_price: 50 }],
  total: 100,
  marketplaceFeeRate: 0,
  successUrl: "http://localhost/success",
  failureUrl: "http://localhost/failure",
  pendingUrl: "http://localhost/pending",
});
assertNoFee("rate 0 on body", body);

if ("auto_return" in body) {
  console.error("auto_return must be omitted for http localhost back_urls");
  process.exit(1);
}

const feeBody = buildMercadoPagoPreferenceBody({
  orderId: "order-fee",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [{ title: "Item", quantity: 1, unit_price: 20 }],
  total: 20,
  marketplaceFeeRate: 0.017,
  successUrl: "https://www.comeleal.com/menu/success",
  failureUrl: "https://www.comeleal.com/menu/failure",
  pendingUrl: "https://www.comeleal.com/menu/pending",
});
assertFee("rate 0.017 on total 20", feeBody, 0.34);

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
assertNoFee("omitted rate on https body", httpsBody);

const tunnelHost = "abc123.trycloudflare.com";
const tunnelBody = buildMercadoPagoPreferenceBody({
  orderId: "order-tunnel",
  restaurantId: "tZYtg0Jt7vAyTLrxyljv",
  items: [{ title: "Taco", quantity: 1, unit_price: 25 }],
  total: 25,
  marketplaceFeeRate: 0.017,
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
assertFee("tunnel with rate", tunnelBody, 0.43);

if (body.external_reference !== "order-abc") {
  console.error("external_reference mismatch");
  process.exit(1);
}
if (body.metadata.restaurant_id !== "tZYtg0Jt7vAyTLrxyljv") {
  console.error("metadata.restaurant_id missing");
  process.exit(1);
}

const prefRedirect = {
  init_point: "https://www.mercadopago.com/prod",
  sandbox_init_point: "https://sandbox.mercadopago.com/test",
};

delete process.env.MERCADO_PAGO_FORCE_INIT_POINT;
const sandboxUrl = pickCheckoutRedirectUrl(prefRedirect, true);
if (!sandboxUrl || !sandboxUrl.includes("sandbox")) {
  console.error("expected sandbox redirect when FORCE_INIT_POINT unset");
  process.exit(1);
}

process.env.MERCADO_PAGO_FORCE_INIT_POINT = "true";
const prodUrl = pickCheckoutRedirectUrl(prefRedirect, true);
delete process.env.MERCADO_PAGO_FORCE_INIT_POINT;
if (!prodUrl || !prodUrl.includes("prod") || prodUrl.includes("sandbox")) {
  console.error("expected init_point redirect when FORCE_INIT_POINT=true");
  process.exit(1);
}

console.log("OK: mercado pago preference builder");
