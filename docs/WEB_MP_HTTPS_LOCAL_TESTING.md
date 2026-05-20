# Mercado Pago web checkout — HTTPS local testing (foodpass-legal) — optional

> **Preferred:** [Vercel Preview testing](./WEB_MP_VERCEL_PREVIEW_TESTING.md) instead of Cloudflare/ngrok tunnels.

Mercado Pago **accepts** preferences with `http://localhost` `back_urls`, but their docs warn that **returns after payment** often fail (“Something went wrong”). For local-only sandbox E2E without Vercel, use an **HTTPS tunnel** so `NEXT_PUBLIC_SITE_URL` is HTTPS and `auto_return` can be enabled.

No `MERCADO_PAGO_ACCESS_TOKEN` is required in foodpass-legal — preferences use the restaurant OAuth token from Firestore.

## Quick setup (cloudflared)

### 1. Start tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the HTTPS URL from the output (example shape: `https://something-random.trycloudflare.com`).

### Alternative (ngrok)

```bash
ngrok http 3000
```

Use the **https** forwarding URL (not `http://127.0.0.1:4040`).

### 2. Update `.env.local`

```bash
NEXT_PUBLIC_ORDERING_ENABLED=true
NEXT_PUBLIC_SITE_URL=https://YOUR-TUNNEL-HOST.trycloudflare.com
MERCADO_PAGO_SANDBOX=true
MERCADO_PAGO_WEBHOOK_URL=https://us-central1-foodpass-18b33.cloudfunctions.net/mercadopagoWebhook
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/foodpass-18b33-service-account.json

# Optional debug
NEXT_PUBLIC_MP_WEB_DEBUG=true
MP_WEB_DEBUG=true
```

Replace `YOUR-TUNNEL-HOST` with your actual tunnel hostname. **No trailing slash.**

### 3. Restart Next dev

```bash
cd ~/Desktop/foodpass-legal
npm run dev
```

Confirm startup shows `Environments: .env.local`.

### 4. Open menu via tunnel URL

Use the **HTTPS** base URL in the browser (not `http://localhost:3000`):

`https://YOUR-TUNNEL-HOST.trycloudflare.com/menu/tZYtg0Jt7vAyTLrxyljv`

So `back_urls` on the Mercado Pago preference match the URL MP will redirect to after payment.

## What changes in preferences

| `NEXT_PUBLIC_SITE_URL` | `back_urls` | `auto_return` |
|------------------------|-------------|---------------|
| `http://localhost:3000` | `http://localhost:3000/menu/.../order/...?payment=...` | **Omitted** |
| `https://<tunnel>/...` | `https://<tunnel>/menu/.../order/...?payment=...` | **`approved`** |

Code: `lib/mercadoPago/buildPreferenceRequest.ts` → `shouldIncludeAutoReturn()` only when success URL protocol is `https:`.

## Expected logs (`MP_WEB_DEBUG=true`)

**With localhost site URL (warning, not blocked):**

```
[mp-web-debug] { level: 'WARN', event: 'mp_sandbox_localhost_site_url', siteUrlHost: 'localhost:3000', ... }
[mp-web-debug] preference_body_summary { usesHttpLocalhostBackUrls: true, autoReturnPresent: false, ... }
```

**With HTTPS tunnel:**

```
[mp-web-debug] create_preference_request { nextPublicSiteUrlHost: 'YOUR-TUNNEL-HOST.trycloudflare.com', ... }
[mp-web-debug] preference_body_summary { usesHttpLocalhostBackUrls: false, autoReturnPresent: true, backUrlHosts: { success: 'YOUR-TUNNEL-HOST.trycloudflare.com', ... } }
[mp-web-debug] checkout_https_back_urls_ok { autoReturnPresent: true, ... }
[mp-web-debug] mercado_pago_api_success { redirectSource: 'sandbox_init_point', redirectUrlHost: 'sandbox.mercadopago.com.mx' }
```

## Buyer testing checklist

1. **Seller** already connected on canonical restaurant `tZYtg0Jt7vAyTLrxyljv` (FOODPASS app OAuth).
2. **Browse** menu using the **HTTPS tunnel** URL (not localhost).
3. Checkout → **Pagar en línea con Mercado Pago**.
4. **MP tab (incognito):** log in as **buyer** test user — not the seller.
5. Pay with **test card** (Visa `4009 1753 3280 6176`, CVV `123`) — not seller **account_money**.
6. After pay: land on `?payment=success` on your tunnel URL; order page shows banner.
7. Confirm Firestore / webhook: `paymentStatus: paid`, `status: pending`.

See also [WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md](./WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md) and [WEB_MP_DEBUGGING.md](./WEB_MP_DEBUGGING.md).
