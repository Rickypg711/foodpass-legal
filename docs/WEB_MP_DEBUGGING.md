# Mercado Pago web checkout — debug logging

Safe, gated logs for Comeleal web Checkout Pro. **Never** prints access tokens, refresh tokens, service account JSON, full `pref_id` URLs, or buyer PII.

## Enable

Add to `.env.local` (restart `npm run dev` after changes):

```bash
# Browser console (checkout + order status + preference client)
NEXT_PUBLIC_MP_WEB_DEBUG=true

# Terminal / server logs (create-preference API route)
MP_WEB_DEBUG=true
```

| Flag | Where it appears |
|------|------------------|
| `NEXT_PUBLIC_MP_WEB_DEBUG=true` | Browser DevTools → Console (`[mp-web-debug]`) |
| `MP_WEB_DEBUG=true` | Terminal running `next dev` / server logs |

Default: both off — no debug noise in production-like runs.

## Log prefix

All events use: `[mp-web-debug]` with an `event` name and a safe JSON payload.

## Happy-path sequence (Mercado Pago checkout)

1. **Checkout** `checkout_submit_start` — `restaurantId`, `cartItemCount`, `paymentMethod: mercado_pago`
2. **Checkout** `order_create_start`
3. **Checkout** `order_create_success` — `orderId`
4. **Client** `create_preference_request_start` — `hasRestaurantId`, `hasOrderId` (no customer id value)
5. **Server** `create_preference_request` — env presence booleans
6. **Server** `restaurant_loaded` — `restaurantDocFound`, `mercadoPagoConnected`, `hasAccessToken`
7. **Server** `order_loaded` — `paymentMethod`, `status`, `paymentStatus`
8. **Server** `preference_body_summary` — item count, total, `backUrlHosts`, `autoReturnPresent`, `hasNotificationUrl`
9. **Server** `mercado_pago_api_success` — `mpStatus: 201`, `redirectSource`, `redirectUrlHost`
10. **Client** `create_preference_response` — HTTP status, `redirectUrlHost`, `redirectSource` (from API body if present)
11. **Checkout** `create_preference_success` — `redirectUrlHost`, `redirectSource`, `sandboxMode`
12. **Checkout** `checkout_debug_tab_preopened` — blank tab opened **before** any `await` (avoids popup blocker)
13. **Checkout** `checkout_redirect_open_new_tab_success` — preopened tab navigated to MP (`redirectUrlHost` only in logs)
14. **Checkout** `checkout_redirect_open_new_tab_blocked` — popup blocked; use **Abrir Mercado Pago** fallback button
15. **Checkout** `checkout_redirect` — same-tab `window.location.href` (debug off / production)

After payment (return URL or Firestore webhook):

13. **Order status** `order_listener_start`
14. **Order status** `order_snapshot` — `orderFound`, `status`, `paymentStatus`
15. **Order status** `order_status_transition` — when `status` or `paymentStatus` changes
16. **Order status** `payment_return_param` — `success` | `pending` | `failure` from `?payment=`
17. **Order status** `render_state` — `mounted`, `hydrationSafe`, display fields present (booleans only)

## Failure examples

| Event | Meaning |
|-------|---------|
| `order_create_error` | Firestore / validation failed before MP |
| `create_preference_error` | API 4xx/5xx or network |
| `mercado_pago_api_error` | MP rejected preference (`mpMessage`, `mpError`) |
| `firebase_admin_credentials_missing` | Local: `GOOGLE_APPLICATION_CREDENTIALS` or path in `.env.local`. Vercel: `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `webhook_url_missing` | Set `MERCADO_PAGO_WEBHOOK_URL` (IPN still works from MP dashboard if configured globally) |
| `restaurant_ineligible` | MP not connected or restaurant blocked |
| `order_not_awaiting_payment` | Order not `payment_pending` |

## Redirect loop (sandbox)

If server shows `redirectSource: sandbox_init_point` and `redirectUrlHost: sandbox.mercadopago.com.mx` but the browser shows `ERR_TOO_MANY_REDIRECTS`, use a **different MP test buyer** than the seller (incognito). See [WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md](./WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md).

## Blind spots (not logged)

- Mercado Pago hosted checkout internals (CSP, favicon on `sandbox.mercadopago.com.mx`)
- Webhook processing (lives in FOODPASS `mercadopagoWebhook` — use Functions logs)
- Full preference id / payment id (only booleans and hosts)
