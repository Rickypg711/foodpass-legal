# Mercado Pago web Checkout Pro audit (foodpass-legal vs FOODPASS)

**Date:** 2026-05-20  
**Scope:** Read-only comparison + MCP/docs alignment. No deploy, no Firestore changes.

---

## 1. Environment variables

| Variable | FOODPASS (Flutter + Functions) | foodpass-legal | Required for web Checkout Pro? |
|----------|----------------------------------|----------------|------------------------------|
| `MERCADO_PAGO_SANDBOX` | App `.env` | `.env.local` / `.env.example` | **Yes** — pick `sandbox_init_point` |
| `MERCADO_PAGO_WEBHOOK_URL` | App `.env` + preference `notification_url` | `.env.local` (often set); **commented in `.env.example`** | **Yes** — IPN on preference |
| `GOOGLE_APPLICATION_CREDENTIALS` | N/A (Admin scripts) | `.env.local` | **Yes** — read `mercadoPagoAccessToken` from Firestore |
| `NEXT_PUBLIC_SITE_URL` | N/A | `.env.local` | **Yes** — `back_urls` base |
| `NEXT_PUBLIC_ORDERING_ENABLED` | N/A | `.env.local` | **Yes** — feature gate |
| `MERCADO_PAGO_ACCESS_TOKEN` | App + Functions secret (Pruebas) | **Not used** | **No** — web uses **per-restaurant OAuth token** |
| `MERCADO_PAGO_PUBLIC_KEY` | App `.env` (unused in Dart) | **Not used** | **No** — Checkout Pro redirect, not Bricks |
| `MERCADO_PAGO_CLIENT_ID` / `CLIENT_SECRET` | OAuth connect (Flutter) | **Not used** | **No** — connect flow is in FOODPASS app only |
| `MERCADO_PAGO_REDIRECT_URI` | OAuth callback | **Not used** | **No** |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Functions secret only | **Not used** | **No** in legal repo — configured on deployed `mercadopagoWebhook` |

### Missing / wrong in foodpass-legal

| Issue | Severity | Notes |
|-------|----------|--------|
| `MERCADO_PAGO_WEBHOOK_URL` commented in `.env.example` | Medium | Local prefs without `notification_url` → no IPN; order stays `payment_pending` |
| No `MERCADO_PAGO_*` payment credentials in legal | **OK** | By design: seller token on `restaurants/{id}` |

### Intentional difference from Flutter sandbox

- **Flutter (sandbox):** `MercadoPagoService` uses **`MERCADO_PAGO_ACCESS_TOKEN`** from app `.env` (Pruebas integrator token).
- **Web:** `POST /api/mercado-pago/create-preference` uses **`restaurants.mercadoPagoAccessToken`** (OAuth seller token).

Both are valid for Checkout Pro; web matches **connected seller** production model. Seller must be a **Pruebas test user** (`@testuser.com` etc.) for sandbox checkout.

---

## 2. Preference body vs MP docs / Flutter

| Field | MP / quality expectation | Flutter `createPreference` | foodpass-legal | Match? |
|-------|--------------------------|----------------------------|----------------|--------|
| `items[]` | title, quantity, unit_price, currency_id | Yes (MXN) | Yes (MXN) | Yes |
| `external_reference` | Order id | `orderId` | `orderId` | Yes |
| `notification_url` | HTTPS webhook | `_getWebhookUrl()` | `MERCADO_PAGO_WEBHOOK_URL` | Yes if env set |
| `back_urls` | success / failure / pending | Deep links or custom | `NEXT_PUBLIC_SITE_URL` + order path | Yes (HTTP localhost in dev) |
| `auto_return` | `approved` when HTTPS back_urls | Always sent | **Omitted for `http://` localhost** | Correct for API; MP doc discourages localhost |
| `metadata.order_id` | Reconciliation | Yes | Yes | Yes |
| `metadata.restaurant_id` | Webhook validation | Yes (sandbox metadata) | Yes | Yes |
| `metadata.customer_id` | Optional | Yes | Yes | Yes |
| `payer.email` | Improves approval | From Firestore user / Auth | **Not sent** (web guest, no email on order) | Optional gap |
| `payer.first_name` | Optional | Yes | Only if `order.customerName` | Partial |
| `statement_descriptor` | Max 22 chars | `COMELEAL` | Restaurant name or `COMELEAL` | Yes |
| `marketplace_fee` / `collector_id` | Production marketplace | Prod only in Flutter | **Not implemented** | OK for sandbox; **prod gap** later |
| Redirect | Sandbox buyer URL | `sandboxInitPoint` when sandbox | `pickCheckoutRedirectUrl(..., true)` → `sandbox_init_point` | Yes |

### MP documentation notes (MCP)

- **`auto_return`:** Automatic redirect when payment approved; requires valid **`back_urls`** (HTTPS in production).
- **`back_urls`:** MP docs recommend **not using `localhost`** — may show “Something went wrong” after pay; use named host or tunnel for smoother return. Separate from **`ERR_TOO_MANY_REDIRECTS`** on `sandbox.mercadopago.com.mx` (buyer/seller session).
- **`sandbox_init_point`:** Use for test payments; **`init_point`** is production checkout (wrong account if used in sandbox).

---

## 3. Redirect loop causes (not app bugs)

| Cause | Applies to web? | Mitigation |
|-------|-----------------|------------|
| Seller pays own preference | Yes | Pay with **different** MP test buyer |
| Same browser session as seller OAuth | Yes | Incognito / clear MP cookies |
| Sandbox vs production cookie mix | Yes | Clear cookies; use sandbox URL only |
| `init_point` instead of `sandbox_init_point` | Unlikely if `MERCADO_PAGO_SANDBOX=true` | Confirm log `redirectSource: sandbox_init_point` |
| `localhost` `back_urls` | Dev only | No `auto_return`; manual return OK; use ngrok/comeleal.com for auto-return |

---

## 4. Webhook

| Check | Status |
|-------|--------|
| URL reachable publicly | `https://us-central1-foodpass-18b33.cloudfunctions.net/mercadopagoWebhook` (deployed FOODPASS function) |
| Registered in MP app | **Manual** — must match `MERCADO_PAGO_WEBHOOK_URL` on preference |
| Event shape | `type: payment`, `data.id` → Functions `GET /v1/payments/{id}` |
| Order id recovery | `metadata.order_id` or `external_reference` (`extractOrderIdFromPayment`) |
| Restaurant id validation | `metadata.restaurant_id` must match order’s restaurant (`validatePaymentAgainstOrder`) |
| Web metadata | foodpass-legal sends `order_id` + `restaurant_id` — **compatible** with `mercadopago_webhook_logic.js` tests |
| Payment fetch token | Functions uses **`MERCADO_PAGO_ACCESS_TOKEN` secret** (integrator), not seller token — verify E2E that GET payment works for OAuth-created payments |

### Webhook mismatches

| Issue | Severity |
|-------|----------|
| Preference without `notification_url` when env unset | High for payment confirmation |
| Webhook secret only on Functions | Expected — not missing in legal |
| Order lookup scans all restaurants | OK for low volume; same as existing backend |

---

## 5. Sandbox account requirements

| Requirement | Canonical `tZYtg0Jt7vAyTLrxyljv` |
|-------------|-------------------------------------|
| Seller connected via OAuth | `mercadoPagoConnected: true` |
| Seller test identity | `mercadoPagoEmail` domain `@testuser.com` (typical MP test seller) |
| Buyer | **Separate** MP test user — not seller email |
| OAuth connect | Done in **FOODPASS app** (needs `CLIENT_ID` / `SECRET` / `REDIRECT_URI` there, not in legal) |

---

## 6. Safe patches recommended

| # | Patch | Repo |
|---|--------|------|
| 1 | Mark `MERCADO_PAGO_WEBHOOK_URL` required in `.env.example` | foodpass-legal |
| 2 | Warn in API logs when `notification_url` omitted | foodpass-legal |
| 3 | Env matrix + Flutter diff in this doc | foodpass-legal |
| 4 | Sandbox buyer checklist (incognito, cookies) | `WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md` (done) |
| 5 | Production: marketplace preference (`collector_id`, `marketplace_fee`) | Future FOODPASS/ legal — align with Flutter prod path |
| 6 | Optional: `payer.email` when web collects email | Future |
| 7 | Dev: ngrok / `https://www.comeleal.com` `NEXT_PUBLIC_SITE_URL` for `auto_return` + MP-compliant back_urls | Ops |

---

## 7. Verdict

**foodpass-legal is not missing required Checkout Pro env vars** for the current design (seller token from Firestore + sandbox flag + site URL + Admin credentials + webhook URL).

**Gaps:** uncomment/document `MERCADO_PAGO_WEBHOOK_URL`; optional payer email; production marketplace fields; MP localhost back_url limitation vs Flutter deep links.

**ERR_TOO_MANY_REDIRECTS:** preference/redirect implementation is aligned with MP; treat as **sandbox buyer/seller session** until proven otherwise.
