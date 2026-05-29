# Comeleal — Vendor Funnel Phase 2 Deployment Checklist

**Status:** Production readiness verification (May 2026)  
**Repo:** `foodpass-legal` only (`www.comeleal.com`)  
**Related:** [FOODPASS vendor funnel plan](/Users/ricardoparedes/projects/FOODPASS/docs/COMELEAL_VENDOR_ACQUISITION_FUNNEL_PLAN.md), [marketing readiness audit](/Users/ricardoparedes/projects/FOODPASS/docs/COMELEAL_MARKETING_AUTOMATION_READINESS_AUDIT.md)

**Verification date:** Code and build verified locally. **Deploy and Vercel env were not changed** during this audit.

---

## What changed in Phase 2

| Area | Deliverable |
|------|-------------|
| **Landing** | `/para-restaurantes` — WhatsApp-first hero + lead form in `#contacto`; form saves lead then opens WhatsApp with prefilled business info |
| **API** | `POST /api/vendor-leads` → Firestore collection `vendorLeads` |
| **Analytics** | `vendor_landing_view`, `vendor_cta_click`, `vendor_lead_started`, `vendor_lead_submitted` (no PII in GA4 params) |
| **UTM** | Read from URL on `/para-restaurantes`; stored on lead doc + safe analytics params |
| **Email** | Public contact: `comeleal@gmail.com` (`lib/contactEmail.ts`) |
| **Support** | `support.html` — email only; no WhatsApp placeholder |

**Phase 2 does not include:** Meta/Google pixels, site-wide UTM persistence, Firestore client rules for `vendorLeads`, paid ads.

---

## Firebase Admin configuration (verified in code)

**Source:** `lib/firebaseAdmin.ts`

| Env var | Supported | Vercel production |
|---------|-----------|-------------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes — full service account JSON string | **Recommended** (Sensitive) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes — path to JSON file on disk | **Not suitable** on Vercel serverless |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes — same as path alias | **Not suitable** on Vercel (local dev only) |

**Project ID (hardcoded):** `foodpass-18b33`

**Credential check:** `hasFirebaseAdminCredentials()` — returns false if none of the above resolve.

**`app/api/vendor-leads/route.ts` pattern (matches MP checkout):**

1. Call `hasFirebaseAdminCredentials()` **before** parsing body.
2. If missing → **503** with user-safe Spanish message + `comeleal@gmail.com` (no secret leakage).
3. Validate input → **400** on failure.
4. `getFirebaseAdminDb().collection("vendorLeads").add({...})` via Admin SDK only.
5. Catch `firebase_admin_credentials_missing` → **500/503** with generic message (no stack traces in JSON).

**Mercado Pago route comparison:** `app/api/mercado-pago/create-preference/route.ts` uses the same `hasFirebaseAdminCredentials()` / `getFirebaseAdminDb()` pattern; vendor-leads returns friendlier `message` fields for form UX.

**Secrets:** API responses never include service account JSON, file paths, or internal error objects.

---

## Required Vercel environment variables

### Required for vendor lead persistence (production)

| Variable | Required | Notes |
|----------|----------|--------|
| **`FIREBASE_SERVICE_ACCOUNT_JSON`** | **Yes** (if leads should save) | Same credential used for web Mercado Pago checkout. Paste full JSON from Firebase Console → Project settings → Service accounts → Generate new private key. Mark **Sensitive** in Vercel. |

### Strongly recommended (already used by site)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://www.comeleal.com` — MP redirects; good practice for production |

### Not required for vendor leads

| Variable | Notes |
|----------|--------|
| `MERCADO_PAGO_*` | Unrelated to vendor funnel |
| `NEXT_PUBLIC_ORDERING_ENABLED` | Unrelated |

### Safest Vercel setup

1. Use **`FIREBASE_SERVICE_ACCOUNT_JSON`** only (not file paths).
2. Scope: **Production** (and Preview only if you want leads from preview URLs — optional).
3. Use the **same** service account already trusted for `create-preference` if checkout works in production.
4. Service account needs **Firestore write** access (default Admin SDK role is sufficient).

**If `FIREBASE_SERVICE_ACCOUNT_JSON` is missing in Production:** form shows error after submit; API returns **503**; users can still email `comeleal@gmail.com`.

---

## Firestore write shape (verified in code)

**Collection:** `vendorLeads`  
**Route:** `app/api/vendor-leads/route.ts`

| Field | Type | Notes |
|-------|------|--------|
| `createdAt` | `serverTimestamp()` | Set on write |
| `name` | string | PII — Firestore only |
| `businessName` | string | PII |
| `city` | string | PII |
| `whatsapp` | string | PII (digits normalized server-side) |
| `businessType` | string | `restaurante` \| `cafe` \| `food_truck` \| `dark_kitchen` \| `otro` |
| `optionalMessage` | string \| null | Max 500 chars |
| `source` | string | Always `para_restaurantes` |
| `utmSource` | string \| null | |
| `utmMedium` | string \| null | |
| `utmCampaign` | string \| null | |
| `utmContent` | string \| null | |
| `utmTerm` | string \| null | |
| `status` | string | Initial value `new` |

**Client Firestore rules:** No `vendorLeads` rules found in FOODPASS `firestore.rules` — writes are **Admin SDK only** (correct). Confirm in Firebase Console that client SDK cannot read/write this collection (default deny is OK).

---

## GA4 / Firebase Analytics — no PII (verified)

**Module:** `lib/analytics/vendorAcquisition.ts`  
**Submit call:** `components/vendor/VendorLeadForm.tsx` → `trackVendorLeadSubmitted`

| Event | Params sent | PII excluded |
|-------|-------------|----------------|
| `vendor_landing_view` | `source`, `utm_*` | ✓ |
| `vendor_cta_click` | `source`, `cta`, `section`, `utm_*` | ✓ |
| `vendor_lead_started` | `source`, `business_type`, `utm_source`, `utm_campaign` | ✓ |
| `vendor_lead_submitted` | `source`, `city`, `business_type`, `utm_*` | ✓ No name, WhatsApp, business name, message |

---

## Email and WhatsApp checks (verified)

| Check | Result |
|-------|--------|
| `support@comeleal.com` in user-facing files | **Not found** in foodpass-legal |
| `comeleal@gmail.com` on `/para-restaurantes` | Via `PUBLIC_CONTACT_EMAIL` + form fallback |
| `comeleal@gmail.com` on `support.html` | mailto links |
| Fake WhatsApp on vendor/support pages | **None** (`[ADD WHATSAPP NUMBER]` removed) |
| `wa.me` in repo | Only `lib/order/formatWhatsappMessage.ts` (post-order flow, not vendor LP) |

---

## Local validation (May 2026 run)

```bash
cd foodpass-legal
npm run lint && npm run build
```

| Step | Result |
|------|--------|
| `npm run lint` | **Pass** (0 errors; 2 pre-existing warnings in unrelated files) |
| `npm run build` | **Pass** — includes `ƒ /api/vendor-leads`, `○ /para-restaurantes` |

**API smoke tests (no successful lead write):**

| Request | Expected | Observed (local `next start` :3099) |
|---------|----------|-------------------------------------|
| `POST {}` | 400 validation | 400 — "Completa los campos obligatorios." |
| Honeypot `website` filled | 400 | 400 — "No se pudo enviar el formulario." |
| Invalid JSON body | 400 | 400 — "Datos inválidos." |

**Not run:** Valid `POST` that persists to Firestore (would write to whichever project the local service account targets — avoided intentionally).

**`.env.local`:** Present on dev machine; build loads it. Do not commit this file.

---

## How to test after deployment

### 1. Deploy foodpass-legal to Vercel Production

Deploy only after `FIREBASE_SERVICE_ACCOUNT_JSON` is set in Production (or accept 503 until set).

### 2. Page smoke test

1. Open `https://www.comeleal.com/para-restaurantes`
2. Confirm form renders (not "formulario en camino" placeholder).
3. Homepage `#restaurantes` CTA → `/para-restaurantes`.

### 3. API test (one real or test lead)

**Option A — Browser:** Submit form with test data; expect success banner.

**Option B — curl (replace with your values):**

```bash
curl -s -X POST "https://www.comeleal.com/api/vendor-leads" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "businessName": "Test Cafe",
    "city": "Chihuahua",
    "whatsapp": "6140000000",
    "businessType": "cafe",
    "optionalMessage": null,
    "consent": true,
    "utmSource": "manual",
    "utmCampaign": "deploy_check"
  }'
```

Expect: `{"ok":true}` and HTTP **200**. If **503**, fix Vercel credentials.

### 4. Firestore console

1. Firebase project **`foodpass-18b33`**
2. Collection **`vendorLeads`**
3. New doc with `status: "new"`, `source: "para_restaurantes"`, timestamps populated

### 5. Firebase Analytics DebugView

1. Open `/para-restaurantes?utm_source=test&utm_campaign=deploy_check` on a device with debug mode (or GA4 DebugView for web).
2. Confirm events: `vendor_landing_view` → interact → `vendor_lead_started` → submit → `vendor_lead_submitted`.
3. Confirm event params **do not** include name or WhatsApp.

### 6. Error path

Temporarily rename env var in Preview only (not recommended for prod) or use invalid body — confirm user sees Spanish error + `comeleal@gmail.com` fallback.

---

## Rollback plan

| Scenario | Action |
|----------|--------|
| **Bad deploy / broken page** | Vercel → Deployments → Promote previous deployment |
| **Form saves bad data** | Stop ads; filter/delete test docs in `vendorLeads`; fix validation in code |
| **API abuse / spam** | Disable route via revert; add rate limiting in Phase 3; use honeypot (already present) |
| **Credentials leaked** | Rotate service account key in Firebase; update `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel; revoke old key |
| **Revert to Phase 1** | Redeploy commit before Phase 2; homepage CTA can point to `support.html` again (not recommended) |

---

## Go / no-go before paid vendor ads

| # | Check | Pass? |
|---|--------|-------|
| 1 | `FIREBASE_SERVICE_ACCOUNT_JSON` set in **Vercel Production** | ☐ |
| 2 | Production deploy includes `/para-restaurantes` + `/api/vendor-leads` | ☐ |
| 3 | One real test lead appears in `vendorLeads` | ☐ |
| 4 | `vendor_lead_submitted` in GA4 (no PII in params) | ☐ |
| 5 | Homepage vendor CTA → `/para-restaurantes` | ☐ |
| 6 | `comeleal@gmail.com` on form error/success paths | ☐ |
| 7 | No WhatsApp placeholder on support | ☐ |
| 8 | Manual follow-up process for new leads (24h SLA) | ☐ |
| 9 | No Meta/Google pixels required yet — **optional** for Phase 4 | ☐ |
| 10 | Paid budget still manual / small test only | ☐ |

**Production readiness verdict (code):** **Ready to deploy** once Vercel has the same Firebase Admin credential as working web checkout.

**Production readiness verdict (live):** **Not verified live** until post-deploy steps above pass. Do not run paid ads until rows 1–3 and 8 are checked.

---

## Files reference (Phase 2)

| Path | Role |
|------|------|
| `app/para-restaurantes/page.tsx` | Landing |
| `components/vendor/VendorLeadForm.tsx` | Form + analytics submit |
| `components/vendor/VendorPageAnalytics.tsx` | Landing view event |
| `app/api/vendor-leads/route.ts` | API |
| `lib/firebaseAdmin.ts` | Admin SDK |
| `lib/vendorLead/validate.ts` | Validation |
| `lib/analytics/vendorAcquisition.ts` | Events |
| `lib/contactEmail.ts` | `comeleal@gmail.com` |

---

*No deploy, Vercel changes, Firebase console changes, or secrets were printed in this audit.*
