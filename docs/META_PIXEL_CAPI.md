# Meta Pixel + Conversions API — qué se manda y qué NO

Pixel/dataset `1774133503558467` (Comeleal Pixel). Cuenta de anuncios COMELEALADS.
Código: `lib/meta/*`, `app/api/meta/events/route.ts`, `components/analytics/MetaPixelProvider.tsx`.
Candado: `npm run test:meta-signal` (dentro de `npm test`).

## Eventos (uno por acción, mismo `event_id` en pixel y servidor → Meta deduplica)

| Evento | Dónde se dispara | Qué significa | Identidad |
|---|---|---|---|
| PageView | toda ruta salvo `/vendor/*` (excepto `/vendor/setup/*`) | visita | cookies |
| ViewContent | `/para-restaurantes` | vio la página de venta | cookies |
| SubmitApplication | `/demo` al subir la foto del menú | **el paso con volumen** antes del alta | teléfono si lo dio |
| Contact | formulario de `/para-restaurantes` | pidió que le escribamos por WhatsApp | cookies |
| Lead | `ActivarModal` al crear el restaurante | **se dio de alta** (una sola definición) | correo, teléfono, uid |
| CompleteRegistration | `/vendor/setup/done` | terminó el wizard | correo, teléfono, uid |

La identidad viaja CRUDA solo del navegador a `/api/meta/events` (misma origin) y el
servidor la hashea SHA-256 (`em`, `ph`, `external_id`) antes de hablar con Meta.
Un teléfono de 10 dígitos sin país conocido NO se manda (regla: jamás coser 52).

## Click id (fbc)

El pixel guarda el `fbclid` del anuncio en la cookie `_fbc`. Si la cookie no está
(navegador dentro de Facebook, bloqueada, o el pixel cargó tarde), el servidor
arma `fbc = fb.1.<ms>.<fbclid>` con el fbclid que `AttributionCapture` guardó en
`localStorage` (30 días, `lib/vendorLead/utmStore.ts`). Diagnóstico de Meta del
17-sep: "low coverage of fbc through Conversions API".

## Lo que NO cuenta (17-sep-2026)

- **Cuentas internas:** `comeleal+…@gmail.com`, `comeleal@gmail.com`, `paredesricardog@gmail.com`
  (y `NEXT_PUBLIC_META_INTERNAL_EMAILS` para sumar sin código). Ni pixel ni CAPI.
  El servidor responde `{ ok: true, skipped: "internal" }` y lo deja en el log.
- **Navegador interno:** en cuanto un correo interno entra en un navegador, queda
  marcado (`localStorage.cml_meta_internal`) y ese navegador se calla para siempre,
  incluso en `/demo`, que es anónimo. Así los montajes de Ricardo no enseñan a Meta
  a buscar a Ricardo.
- **El panel del dueño** (`/vendor/caja`, pedidos, reportes…): el pixel no carga.
  Un dueño usando la Caja 200 veces no es un prospecto.

## Por qué

Events Manager el 17-sep-2026: 91 Leads en 28 días contra 46 restaurantes creados
(la mayoría montajes nuestros), calidad de coincidencia 4.4/10. Dos causas: el
formulario de contacto también disparaba Lead, y cada montaje de Ricardo era un Lead.
Con esa señal, optimizar MENU_B por Lead habría hecho que Meta buscara gente
parecida a Ricardo.

## Events Manager (hecho 17-sep-2026)

- "Coincidencias avanzadas automáticas": ON (correo, teléfono, id externo…).
- "Automatic events": OFF. Meta había creado solo un `InitiateCheckout` con el
  botón "Comenzar" de una página del panel; se borró.
- Allow list de dominios: `comeleal.com` y subdominios. Antes localhost mandaba
  eventos al pixel real (426 en un día de QA).

## Cómo usarlo en la pauta

- MENU_B (web): optimizar por **SubmitApplication** mientras Lead sea escaso
  (Meta necesita ~50 conversiones/semana por conjunto para salir de aprendizaje).
  Leer Lead como la métrica real, no como el objetivo de optimización.
- Con tope: $100/día × 7 días. Si no hay 3 altas de extraños, se apaga.
- Audiencias nuevas posibles: subió menú y no se dio de alta; se dio de alta y no
  terminó el wizard.

## Qué esperar en Events Manager

Los Leads BAJAN. No es que la pauta empeoró: es que dejó de contar el formulario
de contacto y los montajes internos. El histórico de "costo por Lead" anterior al
17-sep no es comparable.
