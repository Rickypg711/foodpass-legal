# Comeleal web (`comeleal-web`)

Public site for [Comeleal](https://www.comeleal.com): legal pages, app download, public restaurant menus, and web ordering with Mercado Pago Checkout Pro (sandbox).

## Stack

- Next.js 16 (App Router)
- Deployed on Vercel → **www.comeleal.com**

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test:order-payload` | Order payload validation |
| `npm run test:mp-preference` | Mercado Pago preference builder checks |

## Docs

- [Web Mercado Pago sandbox checkout](./docs/WEB_MERCADO_PAGO_SANDBOX_CHECKOUT.md)
- [Vercel Preview testing](./docs/WEB_MP_VERCEL_PREVIEW_TESTING.md)
- [MP web debugging](./docs/WEB_MP_DEBUGGING.md)

## Infrastructure (unchanged)

- Firebase project: `foodpass-18b33`
- Webhook: FOODPASS Cloud Function `mercadopagoWebhook`

Repo folder name may still be `foodpass-legal` locally; npm package name is `comeleal-web`.
