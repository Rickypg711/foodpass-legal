# Landing pages por restaurante — /r/{id} (v1 + batch Metro/Owner, 5 ago 2026)

**Qué es:** el mini-sitio público auto-generado de cada restaurante. CERO UI de
edición — todo sale de datos que el dueño ya alimenta (Configuración + menú).
Es el link para la bio de Instagram y el "sitio web" del perfil de Google Maps.
**El QR de mesa sigue apuntando directo a /menu/{id}** (en mesa nadie quiere
una landing antes del menú) — decisión deliberada, no cambiar sin discutirlo.

**Clasificación de pricing (docs/PRICING.md):** GRATIS para siempre — es
software que escala con costo marginal cero (test de Hormozi) y es el hook de
venta + el loop viral (footer "Página creada con Comeleal"). La
personalización (colores, hero custom, dominio propio) es valor de tiers de
paga FUTUROS; la página base nunca se paywallea.

## Arquitectura

- `app/r/[restaurantId]/page.tsx` — **server component**: doc + menú vía
  Firestore REST (`lib/server/restaurantLanding.ts`, decoder completo de
  mapValue/arrayValue). El HTML inicial trae TODO el contenido → los crawlers
  de IA (GPTBot, PerplexityBot — no ejecutan JS) leen nombre, menú, precios y
  horario. Redirect server-side para ids en minúsculas (FB/IG). Si el fetch
  server falla → `initial=null` → LandingView hace fetch client de respaldo.
- `app/r/[restaurantId]/LandingView.tsx` — client view. **El chip
  abierto/cerrado y el resaltado "hoy" se calculan SOLO después de montar**:
  dependen de la hora LOCAL del visitante y el server corre en UTC (evaluarlo
  ahí mentiría ~6 h/día y daría hydration mismatch). Hero = banner ?? mejor
  foto del menú ?? glow naranja de marca.
- `app/r/[restaurantId]/layout.tsx` — metadata + JSON-LD **Restaurant**
  (openingHoursSpecification vía `weeklyHoursRaw()`, Menu completo con
  MenuSection/MenuItem/Offer en MXN, priceRange, telephone, images) +
  **FAQPage** con las mismas respuestas que pinta la página (schema y página
  nunca se contradicen). Mismo fetch que page.tsx (Next dedupe por URL).
- `lib/landingContent.ts` — contenido auto-generado compartido server/cliente:
  `buildLandingTitle` (patrón Owner: "{Nombre} | {Categoría} en {Ciudad} —
  menú, pedidos y horario"; `cityFromAddress` es heurística CONSERVADORA — sin
  confianza devuelve null, mejor sin ciudad que ciudad equivocada),
  `buildSeoParagraph`, `buildFaq` (solo preguntas cuyos datos EXISTEN).
- `lib/schedule.ts` — `weeklySchedule()` (filas UI) y `weeklyHoursRaw()`
  (24 h para schema). Regla de oro intacta: sin businessHours no se muestra ni
  se bloquea nada.
- Configuración → card **"Tu página en internet"** (`PublicLinksCard`): links
  /r/ y /menu/ con Ver/Copiar + tip de bio de Instagram y Google Maps. La
  activación del loop: sin esto nadie sabe que su página existe.
- Analytics: `web_landing_view` → `web_landing_menu_click` /
  `web_landing_whatsapp_click` (funnel medible). Sitemap incluye /r/ de
  restaurantes activos.
- "Los más pedidos 🔥": el carrusel lee el campo opcional `orderCount` de los
  menu items y ordena por ventas cuando existe; sin datos cae a orden por
  nombre con título "Del menú". **El contador (CF sobre orders) NO está
  construido** — es follow-up.

## De dónde salió el diseño (teardown Owner.com, 5 ago)

Sitios estudiados en vivo: metropizza.com, talkintacos.net, doodahdiner.com +
owner.com (pricing/how-it-works). Su template: header sticky con Order online
siempre visible → hero → featured con quick-add → bloques variables → texto
SEO → reseñas → rewards → FAQ+schema → location cards → app. Su pricing: $249
USD/mes + 5%/orden o $499 flat, y el COMENSAL paga 5% extra. Su belief #1
("performance beats endless customization") valida el cero-page-builder.
Detalle completo en la memoria del proyecto (metro-pizza-owner-teardown).

## Pendientes (steal shelf, en orden)

1. **Muro de reseñas** — bloqueado por el funnel de Google reviews (necesita
   el link de reseñas del GBP de cada restaurante; Ricardo crea el de Luzz).
   Compliance: CERO review-gating.
2. **Contador `orderCount`** (Cloud Function sobre orders) → activa "Los más
   pedidos" real.
3. **Campo promo/anuncio en el hero** (patrón Talkin Tacos: cupón en el hero;
   conectable a discount profiles).
4. **Quick-add al carrito desde la landing** (patrón Metro).
5. **Páginas por colonia/landmark** — solo a escala 10+ vendors.
6. A discutir (cambia ops del vendor): **pre-order con negocio cerrado**
   ("abre en 40 min — deja tu pedido") en vez del candado duro.

## Verificación (cómo se probó)

tsc + eslint + npm test en cada ronda; en prod: fetch del HTML crudo SIN JS
debe contener nombre + platillos + openingHoursSpecification, y el JSON-LD
debe parsear con Restaurant + FAQPage. Verificado en Luzz
(`kdjJsNwriU4AL4528a4d`) y Pecado (`d3v9krkR2YY90lrZGkjt`).
