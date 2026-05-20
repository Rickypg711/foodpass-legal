# Mercado Pago Checkout Pro — Vercel Preview testing

Use a **Vercel Preview** deployment for sandbox E2E instead of Cloudflare/ngrok local tunnels. Preview URLs are HTTPS, so MP `back_urls` work with `auto_return` and returns after payment are reliable.

**No deploy from this doc** — configure env vars in the Vercel dashboard, then deploy or push a branch when you are ready.

## Prerequisites

- Comeleal web (`comeleal-web`) project linked in Vercel (same repo as local).
- Canonical test restaurant `tZYtg0Jt7vAyTLrxyljv` has **Mercado Pago connected** (OAuth token in Firestore via FOODPASS app).
- FOODPASS Cloud Function `mercadopagoWebhook` already deployed (unchanged).
- Firebase service account JSON for project `foodpass-18b33` (Admin SDK read of `mercadoPagoAccessToken`).

## Exact Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. Use the **Preview** scope unless noted.

| Variable | Preview | Production | Value / notes |
|----------|---------|------------|---------------|
| `NEXT_PUBLIC_ORDERING_ENABLED` | ✅ | ✅ | `true` — enables web ordering UI |
| `MERCADO_PAGO_SANDBOX` | ✅ | ✅ (sandbox only) | `true` — use `sandbox_init_point` |
| `MERCADO_PAGO_WEBHOOK_URL` | ✅ | ✅ | `https://us-central1-foodpass-18b33.cloudfunctions.net/mercadopagoWebhook` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | ✅ | **Secret.** Full JSON of the service account (single line or pasted object). **Do not** use `GOOGLE_APPLICATION_CREDENTIALS` on Vercel. |
| `NEXT_PUBLIC_MP_WEB_DEBUG` | ✅ optional | ❌ off | `true` — browser `[mp-web-debug]` logs |
| `MP_WEB_DEBUG` | ✅ optional | ❌ off | `true` — server `[mp-web-debug]` logs |
| `NEXT_PUBLIC_SITE_URL` | ⚠️ see below | ✅ | Production: `https://www.comeleal.com` (no trailing slash) |

### `NEXT_PUBLIC_SITE_URL` on Preview

The create-preference API builds `back_urls` from `NEXT_PUBLIC_SITE_URL` when set; otherwise it uses the request’s `x-forwarded-host` (HTTPS on Vercel).

**Recommended for Preview:** leave `NEXT_PUBLIC_SITE_URL` **unset** in the Preview environment so each preview deployment (`https://<branch>-<team>.vercel.app`) gets correct `back_urls` automatically.

**Alternative:** if you use a **stable** preview alias, set:

`NEXT_PUBLIC_SITE_URL=https://your-stable-preview-host.vercel.app`

(no trailing slash)

### Variables you must NOT add on foodpass-legal

These belong in **FOODPASS** (Flutter / Functions), not the legal web app:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_PUBLIC_KEY` / `CLIENT_ID` / `CLIENT_SECRET` / `REDIRECT_URI`

Web checkout reads the **restaurant** OAuth token from Firestore via Admin SDK.

### Local vs Vercel credentials

| Environment | Firebase Admin |
|---------------|----------------|
| Local `.env.local` | `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_PATH` (file path OK) |
| Vercel Preview / Production | **`FIREBASE_SERVICE_ACCOUNT_JSON` only** (paste JSON in dashboard; mark Sensitive) |

`lib/firebaseAdmin.ts` loads JSON from `FIREBASE_SERVICE_ACCOUNT_JSON` first, then path env vars.

## Vercel dashboard checklist (no CLI deploy required)

1. Open the **Comeleal web** project in Vercel.
2. **Settings → Environment Variables** — add the table above for **Preview** (and Production when ready).
3. Paste service account into `FIREBASE_SERVICE_ACCOUNT_JSON` as **Sensitive**; never commit to git.
4. Confirm **Preview** does not set `GOOGLE_APPLICATION_CREDENTIALS`.
5. When approved: deploy via **Deployments** (push to a branch or “Redeploy” preview).

## Test flow (after preview is live)

1. Open menu on the **preview HTTPS URL** (not localhost):

   `https://<your-preview-host>/menu/tZYtg0Jt7vAyTLrxyljv`

2. Add items → checkout → **Pagar en línea con Mercado Pago**.
3. Server logs (if `MP_WEB_DEBUG=true`):

   - `create_preference_request` with `hasFirebaseServiceAccountJson: true`
   - `preference_body_summary` with `usesHttpLocalhostBackUrls: false`, `autoReturnPresent: true`
   - `checkout_https_back_urls_ok` or `mercado_pago_api_success` with `redirectSource: sandbox_init_point`

4. Pay in **incognito** with an MP **buyer** test user (not the restaurant seller email).
5. Test card (sandbox): Visa `4009 1753 3280 6176`, any future expiry, CVV `123`.
6. After payment: land on `?payment=success` on the **same preview host**; order page updates via Firestore / webhook.

## Webhook

`notification_url` on each preference points at FOODPASS `mercadopagoWebhook`. No change needed on Vercel for the function URL. Confirm payment promotion `payment_pending` → `pending` in Functions logs if the order stays unpaid after MP success.

## Roll back local tunnel testing

Local dev should use:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

See [WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md](./WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md). Tunnel setup is optional legacy: [WEB_MP_HTTPS_LOCAL_TESTING.md](./WEB_MP_HTTPS_LOCAL_TESTING.md).

## Related docs

- [WEB_MP_DEBUGGING.md](./WEB_MP_DEBUGGING.md) — debug flags and event names
- [WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md](./WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md) — flow and buyer/seller rules
