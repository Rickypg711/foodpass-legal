# Web Mercado Pago sandbox checkout (Comeleal web)

Customer web ordering at `/menu/[restaurantId]` can pay online via **Checkout Pro Marketplace** using the restaurant’s **OAuth seller token** stored in Firestore (server-side only), plus optional **`marketplace_fee`** on the preference.

## Checkout Pro Marketplace model

| Piece | Source |
|--------|--------|
| `Authorization` | `restaurants/{id}.mercadoPagoAccessToken` (seller OAuth) — **not** platform `MERCADO_PAGO_ACCESS_TOKEN` |
| `marketplace_fee` | Fixed MXN amount when `MERCADO_PAGO_MARKETPLACE_FEE_RATE` > 0 (target **`0.03` = 3%**; production verification used **`0`**) |
| `collector_id` / `sponsor_id` | **Not** sent (seller token defines collector; preference id prefix = seller user id) |

## Payment flow

1. Checkout: user selects **Pagar en línea con Mercado Pago** (only if `mercadoPagoConnected` and restaurant is `active` + `isSetupComplete`).
2. Client creates order: `paymentMethod: mercado_pago`, `status: payment_pending`.
3. `POST /api/mercado-pago/create-preference` (Admin SDK reads `mercadoPagoAccessToken`; adds `marketplace_fee` when rate > 0).
4. Browser redirects to `sandbox_init_point` when `MERCADO_PAGO_SANDBOX=true`.
5. Return URLs: `/menu/{id}/order/{orderId}?payment=success|failure|pending`.
6. Order status page shows banner + live `paymentStatus` from Firestore — **does not** mark paid client-side.

## Webhook (FOODPASS Cloud Functions)

Payment confirmation is **not** implemented in foodpass-legal. Configure:

`MERCADO_PAGO_WEBHOOK_URL=https://us-central1-foodpass-18b33.cloudfunctions.net/mercadopagoWebhook`

The existing `mercadopagoWebhook` handler in `FOODPASS/functions` updates `paymentStatus` and promotes `payment_pending` → `pending` when MP reports approved.

## Marketplace fee (production vs target)

Verified production payment tests (Comeleal web, May 2026) used **`MERCADO_PAGO_MARKETPLACE_FEE_RATE=0`** on Vercel Production (`marketplace_fee: 0` on preferences). When enabling commission later, use **`0.03`** for **3%** (`marketplace_fee = order total × 0.03`). Do **not** use **`0.017`** unless intentionally reverting to 1.7%.

## Environment

**Recommended for MP sandbox E2E:** [Vercel Preview testing](./WEB_MP_VERCEL_PREVIEW_TESTING.md) (HTTPS `back_urls` + `auto_return`, Firebase Admin via `FIREBASE_SERVICE_ACCOUNT_JSON`).

**Local dev** (API works; MP return after pay may be flaky on localhost):

Optional legacy tunnel: [HTTPS local tunnel](./WEB_MP_HTTPS_LOCAL_TESTING.md) — not required if using Preview.

```bash
NEXT_PUBLIC_ORDERING_ENABLED=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MERCADO_PAGO_SANDBOX=true
MERCADO_PAGO_MARKETPLACE_FEE_RATE=0.03
MERCADO_PAGO_WEBHOOK_URL=https://us-central1-foodpass-18b33.cloudfunctions.net/mercadopagoWebhook
GOOGLE_APPLICATION_CREDENTIALS=/path/to/foodpass-18b33-service-account.json
```

**Not required in foodpass-legal:** `MERCADO_PAGO_ACCESS_TOKEN`, `PUBLIC_KEY`, `CLIENT_ID`, `CLIENT_SECRET` — OAuth connect and Pruebas app token live in FOODPASS; web reads the seller token from Firestore.

Set `MERCADO_PAGO_MARKETPLACE_FEE_RATE=0` or omit to create preferences **without** `marketplace_fee` (non-split Checkout Pro).

With `MP_WEB_DEBUG=true`, sandbox + `http://localhost` site URL logs **`mp_sandbox_localhost_site_url`** (WARN) — app is not blocked.

## Test restaurant

- **Use:** `tZYtg0Jt7vAyTLrxyljv` (canonical, MP connected)
- **Never:** `694xqeERzye5QZeHpl93` (blocked in API)

## Buyer test URL

http://localhost:3000/menu/tZYtg0Jt7vAyTLrxyljv

## Pay at pickup

Unchanged: `paymentMethod: pay_at_pickup`, `status: pending`.

## Sandbox redirect loop (`ERR_TOO_MANY_REDIRECTS`)

If the API returns **200** with `sandboxMode: true` and logs show `redirectSource: sandbox_init_point`, but the browser fails on `sandbox.mercadopago.com.mx` with **ERR_TOO_MANY_REDIRECTS**, the preference and redirect URL are usually correct — the failure is almost always an **MP session / buyer–seller mix-up**, not foodpass-legal code.

**Check server logs** (`[mp-create-preference] success`):

- `redirectUrlHost` should be `sandbox.mercadopago.com.mx` (host only — never log full URL with `pref_id` in shared logs).
- `redirectSource` should be `sandbox_init_point` when `MERCADO_PAGO_SANDBOX=true`.

**Buyer rules (required for sandbox Checkout Pro):**

1. Use a **different Mercado Pago test user** than the restaurant seller (`mercadoPagoEmail` on the canonical restaurant — e.g. `*@testuser.com` seller account).
2. Pay in **incognito** or a separate browser profile, or **clear Mercado Pago cookies** before checkout.
3. Do **not** stay logged into the seller’s MP account in the same browser session used to pay.
4. Use MP **Pruebas** test buyer credentials from the developer dashboard (not the vendor OAuth email).

**Noise on the MP page:** CSP inline-script warnings and `favicon.ico` 404 on `sandbox.mercadopago.com.mx` come from Mercado Pago’s hosted checkout, not this app.

**Local `back_urls`:** `http://localhost:3000/menu/.../order/...?payment=...` is valid; `auto_return` is **omitted** for HTTP localhost (MP rejects it). After payment, return via MP’s back link or manual navigation to the order page.
