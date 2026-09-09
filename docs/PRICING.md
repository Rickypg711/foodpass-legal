# Comeleal — Pricing canónico (v2.1, 9 sep 2026)

**Esta es la ley de qué es gratis y qué se cobra.** Cualquier feature nuevo se clasifica con esta regla ANTES de construirse. Si un cambio contradice este doc, se discute aquí primero.

> **Qué cambió en v2.0 (decisión de Ricardo, 7-sep-2026 noche, construida el 8-sep).**
> "La lealtad sola no es negocio." La reja de Pro se muda de los puntos a la Caja:
> el tope de **50 visitas de lealtad al mes MURIÓ** (free no tiene tope de nada),
> Pro pasa a **$499 MXN/mes para nuevos** y se vende por lo que la Caja
> recuerda y por las manos que la usan: **historial de más de 30 días, segundo
> cajero con PIN y cuentas por mesa** (más reportes de más de 30 días,
> inventario y turnos). El plan completo con el mapa de archivos vive en
> `FOODPASS/docs/PLAN_REJA_CAJA_8_SEP.md`; el benchmark en
> `FOODPASS/docs/PRECIOS_BENCHMARK_GLOBAL.md`. Todo lo de v1.3 que decía lo
> contrario (PIN gratis, tope de 50, Pro $299, "nunca se cobra reportes") queda
> derogado por este doc.

## La regla (test de Hormozi, con la corrección de escala)

> "If it scales, it's free. If it doesn't scale, you have a price tag."

- **Escala y sirve para arrancar el día 1 → GRATIS.** Menú, QR, pedidos, puntos, clientes, mensajes manuales, export. Un restaurante más cuesta centavos de Firebase y cada uno alimenta el funnel.
- **Lo que la Caja recuerda y las manos que la usan → PRO.** Es lo que cobran Loyverse, Square, Toast y Slack: el historial largo, el segundo usuario, la mesa. No se necesita para la primera venta; se necesita cuando el negocio ya opera en serio. Ahí está el dinero (corte 5-sep: Pecado Escondido = 87% del ingreso, 163 ventas/mes en la Caja, 2 escaneos).
- **La tarjeta de puntos que los demás cobran (Woncards $399–749, Loyalzoo $77–167 USD) aquí se REGALA.** Es el gancho, no el producto.

## Free — "Opera gratis, sin tope"

Todo lo que necesita un restaurante para OPERAR, sin límite de tiempo, sin tarjeta y **sin tope**:

- Menú digital QR + página pública del menú (SEO incluido — "te pongo en Google gratis")
- Caja / POS: cobro inmediato, propinas, recibo por WhatsApp — **ventas sin tope**
- Pedidos en línea y pedidos por WhatsApp; pedidos de mesa QR que llegan del comensal
- **Puntos para los clientes sin tope de visitas** (con app o con número) — nunca se pausan
- Lista de clientes: ver clientes, visitas, gasto, quién dejó de venir
- Mensajes de win-back: Comeleal dice quién y arma el texto; **el dueño lo manda desde su WhatsApp por `wa.me`, a mano** — nunca decir "automático"
- Export de clientes
- Reportes de hoy, de la semana y **de los últimos 30 días**
- Historial de ventas de **los últimos 30 días**
- **Un PIN de la caja** (el dueño)
- El AI acotado que corre solo (brain diario, siguiente movimiento, borradores de premios, importador de menú)

**Por qué free es así de generoso:** es el funnel. El pitch en persona y en la web es "te dejamos funcionando hoy, gratis". La retención del vendor se gana con uso, no con candados — y el candado que había (50 visitas) nadie lo cruzó jamás.

## Pro — $499 MXN/mes: "Para cuando tu Caja crece"

Se vende con UNA frase (nivel secundaria, sin anglicismos, siempre "menú"):

> **Esto es Pro. Tu Caja sigue gratis. Por $499 al mes ves todo tu historial, tu equipo cobra con su PIN y llevas mesas. Pruébalo 14 días, sin tarjeta.** Y tienes mi WhatsApp directo.

Las tres paredes (las mismas en app y web, con candados espejo):

| # | Pared | Dónde salta | Qué sigue gratis |
|---|---|---|---|
| 1 | **Historial >30 días** | Reportes → Historial de ventas → "90 días" / "Todo" (web); OrderHistoryScreen custom/all (app) | Los últimos 30 días, siempre |
| 2 | **Segundo cajero (PIN)** | Configuración → Equipo → "+ Agregar persona" con 1 PIN ya en el roster (web); Equipo hub (app) | El primer PIN. Un roster que ya tenía más gente antes del 8-sep sigue cobrando igual — la pared solo detiene ALTAS |
| 3 | **Cuentas por mesa** | Caja → "Cuenta abierta" o "Actualizar cuenta" (agregar rondas) | Cobrar ahora sin tope. **Cerrar/cobrar una cuenta que ya existe NUNCA se bloquea**; el pedido de mesa del comensal tampoco (él no tiene la culpa) |

También Pro: reportes de más de 30 días (misma pared 1), inventario y turnos (app), cuentas con login propio para el equipo, descuentos especiales (staff y familia), Comeleal AI sin límite, soporte directo.

**La cosa humana de Pro:** el WhatsApp directo de Ricardo + hasta 15 min/mes de números (tope; copy nada más).

### Precio y grandfathering

- **$499 MXN/mes para todo suscriptor NUEVO** desde el 8-sep-2026. Un solo constante: `lib/subscription/pricing.ts` (`PRO_AMOUNT_MXN`), que importan la ruta de cobro (`app/api/mercado-pago/subscribe/route.ts`) y todas las páginas que enseñan el precio (`PRO_PRICE_LABEL`). Nadie escribe "$499" a mano — el candado lo revisa.
- **Quien ya paga se queda en su precio.** Pecado Escondido paga $299: su preapproval de Mercado Pago conserva el monto solo; no hay campo que tocar. En tiendas (Play / App Store) el producto nuevo a $499 es OTRO `productId`; el viejo `pro_monthly` sigue vivo para quien ya lo tiene (eso lo crea Ricardo en las consolas).
- Growth ($249) murió: nunca fue visible y ya no existe en el enum de la app.
- **Sin cambio:** 3% solo en pagos digitales en línea (Mercado Pago); efectivo y terminal propia 0%.
- **Setup $1,500 "te lo dejo hoy": sigue BLOQUEADO** hasta que la página del local deje de ser genérica (`docs/SETUP_DE_PAGA_NO_GENERICO.md`).

## La prueba de Pro — 14 días, sin tarjeta, una por restaurante, **con un toque en la pared**

**Qué cambió en v2.0:** ya no hay que ir a `/vendor/plan` a pedirla. La primera vez que un dueño toca una pared (pide 90 días, agrega el segundo PIN, abre una mesa), **la pared le ofrece la prueba ahí mismo** y abre la puerta (reverse trial). Si el restaurante ya usó su prueba, la pared enseña el precio y la liga a `/vendor/plan`. El botón de `/vendor/plan` sigue existiendo para quien llegue por ahí.

### v2.1 (9-sep-2026): un toque, un reloj, un aviso a 3 días

Lo que Verna / Poyar / Hormozi piden de un reverse trial, de punta a punta, espejo en la app:

1. **La prueba necesita UN toque.** La pared (`ProWall`) ya **no** la arranca sola: enseña el copy canónico y el botón **"Empezar mis 14 días gratis"** (y "Ahora no"). Al tocarlo se pide al servidor (`startProTrial`, `source: "web"`); al recibir el sí, la pared confirma **"Listo. Tienes Pro hasta el martes 23 de septiembre. Sin tarjeta, sin cobros."** y un solo botón **"Seguir"** repite la acción que detuvo. Si falla: reintento en palabras llanas. Si ya usó su prueba: precio (`PRO_PRICE_LABEL`) y "Ver planes". Sin efectos al montar — nada se dispara solo.
2. **El reloj en el panel** (`components/vendor/TrialClock.tsx`, matemática en `lib/subscription/trialClock.ts`, `trialClockState`): una franja bajo el header de `/vendor`, nunca modal, leyendo `private/billing` vía `fetchWithBilling`. Tres estados, los mismos nombres en la app (`trial_clock.dart`):
   - `counting` (días 14→4): "Pro de prueba · te quedan N días" → `/vendor/plan`.
   - `endingSoon` (≤3 días): "Tu prueba termina el {día}. Sigue con Pro por $499 al mes." + **"Seguir con Pro"**.
   - `ended` (7 días después de vencer, si cayó a gratis): "Tu prueba terminó. Sigues gratis: cobras igual, sin mesas ni segundo PIN." + **"Volver a Pro"**. Luego `hidden`.
   Nunca para quien paga Pro ni para el bypass de fundador. Se puede cerrar por estado (localStorage por restaurante + estado).
3. **Candado:** `scripts/validate-trial-clock.mjs` (en `npm test`) — tabla de verdad (3 días exactos, último día, vencida + 7 d + 1 min, paga Pro, fundador), la pared sin `useEffect` y con el botón de consentimiento, el reloj en el panel leyendo `fetchWithBilling`, y los tres copys tal cual.

**Términos.** 14 días · Pro completo · sin tarjeta ni datos de pago · **una sola vez por restaurante, para siempre** · al terminar cae solo al plan gratis con menú, Caja, clientes, puntos e historial de 30 días intactos. No hay cobro sorpresa porque nunca hubo tarjeta.

**Diferencia contra el trial de un POS típico:** cuando a ellos se les vence, el negocio se queda sin sistema. Cuando a nosotros se nos vence, el negocio sigue operando gratis y sus clientes siguen juntando puntos. Eso se comunica siempre.

### Cómo está construido (la ley técnica)

- **Se otorga SÓLO desde el servidor:** callable `startProTrial` (FOODPASS/functions/subscription_trial.js). El reloj es del servidor; jamás se acepta una fecha del cliente. En la web lo llama `lib/subscription/useProTrial.ts` con `source: "web"` — desde `/vendor/plan` y desde `components/vendor/ProWall.tsx` (la pared), siempre tras un toque del dueño.
- **El candado anti-repetición es `restaurants/{rid}/private/trial`**, un doc que las reglas niegan a todo cliente (`allow write: if false`).
- **Anti doble dip:** al otorgar se escribe `subscriptionTrialEndsAt`, que es justo lo que `entitlementOf().canStartTrial` y la app consultan para dejar de ofrecer la prueba. Nadie junta 14 días nuestros + 14 de Google/Apple.
- **Vence sola.** Todos los gates comparan contra `subscriptionAccessExpiresAt` **en cada lectura**. El barrido diario es higiene, no el candado.

### La regla única de "¿tiene Pro?" (auditoría 6 ago 2026, sigue vigente)

**Una sola regla, replicada en los tres runtimes y con tests espejo:**

| Runtime | Archivo | Test |
|---|---|---|
| Servidor | `FOODPASS/functions/subscription_entitlement.js` | `subscription_entitlement.test.js` |
| Web | `foodpass-legal/lib/subscription/entitlement.ts` | `scripts/validate-subscription-entitlement.mjs` |
| App | `lib/loyalty/discount_profiles.dart`, `lib/subscription/services/subscription_tier_service.dart` | `test/loyalty/discount_profiles_test.dart` |

**Semántica (fail-closed):** `subscriptionPlan == "pro"` **Y** status ∈ {active, trialing} **Y** `subscriptionAccessExpiresAt > ahora`. Sin fecha → NO es Pro. La verdad vive en `restaurants/{rid}/private/billing` (migración 24-ago): **todo lector web pasa por `fetchWithBilling`** — el candado lista los lectores y cada superficie nueva con reja se agrega ahí.

**Única excepción:** doc legado con el viejo `plan: "pro"` y CERO campos canónicos → se le respeta el acceso.

### La tabla de entitlements (v2.0)

Encima de la regla única hay UNA tabla, con los **mismos cuatro nombres** en web (`lib/subscription/entitlement.ts`, `entitlementsOf`) y app (`EffectiveEntitlements`, `subscription_tier_service.dart`); `scripts/validate-caja-pro-gate.mjs` lee el Dart y lo afirma:

| Campo | Free | Pro |
|---|---|---|
| `historyDays` | `30` (`HISTORY_DAYS_FREE`) | `null` = sin límite |
| `posStaffAccess` | `false` — gratis 1 PIN (`POS_STAFF_FREE_LIMIT = 1`) | `true` |
| `tableTabsAccess` | `false` | `true` |
| `reportsAccess` (más allá de `historyDays`) | `false` | `true` |

**No existe ningún campo de tope de escaneos en la tabla.** Free no conoce el número 50.

**Bypass de fundador:** Luzz Pizza (`lib/subscription/founderBypass.ts`) recibe la tabla Pro completa sin plan — jamás ve una pared en plena operación. Se comparte con descuentos. TODO: quitar antes de vender.

**Don't:** escribir un check de Pro nuevo. Se importa `entitlementsOf` (paredes) o `isProActive` (booleano legado). Si un gate necesita algo distinto, se discute aquí antes.

## Comisión 3% — se queda como está

3% solo en pagos digitales en línea (Mercado Pago). Escala con las ventas DEL restaurante, no con nuestro costo. Efectivo y terminal propia: 0%. (El copy público "sin comisiones" se refiere a pedidos por WhatsApp / vs. apps de delivery que cobran ~30% — nunca prometer 0% en pagos en línea MP.)

## Puntos sin tope — cómo funciona (v2.0)

El tope de 50 se fue. Reglas que quedan:

1. **El cliente SIEMPRE se guarda** — número, visita, gasto. Y **siempre suma sus puntos**: `lib/loyalty/phonePoints.ts` jamás regresa `points = 0` por un conteo. El contador `private/usage.scanCount` sigue existiendo como ESTADÍSTICA ("visitas con puntos" del panel), nunca como límite.
2. **Canjear nunca se bloquea** — un premio ya prometido al cliente se cumple siempre (never-lie).
3. **Sin premios no se prometen puntos** (`restaurantPromisesPoints`, 5-sep) — eso no es un tope, es honestidad.
4. Ninguna superficie dice "50 visitas", "lealtad ilimitada" ni "se llenó". El candado lo revisa en `app/`, `lib/` y `components/`.

## Dónde se comunica (mismo mensaje en todas)

1. **La pared** (`ProWall`) en Reportes, Configuración → Equipo y la Caja — el copy canónico de arriba.
2. Configuración → Plan — tabla Free vs Pro y botón de pago (MP web).
3. `/vendor/plan` — la página de venta (prueba o pago).
4. Público `/precios`, home, `/software-para-restaurantes` y las landings verticales — "Opera gratis. Paga solo cuando tu Caja crece."

## Los 4 canales de mensajes — cuál cuesta y cuál se cobra

La regla operativa: **si sale del teléfono del dueño, es gratis y es manual. Si lo mandara la máquina por la API de Meta, costaría — y hoy esa API no existe en Comeleal.**

| # | Canal | Cómo funciona | ¿Nos cuesta? | Free / Pro |
|---|-------|--------------|--------------|------------|
| 1 | **Botón de Clientes (manual + AI copiloto)** | En `/vendor/clientes` el AI redacta; "Abrir WhatsApp" abre `wa.me` y el DUEÑO lo manda desde SU WhatsApp | **$0** | **Gratis siempre, sin tope** — y jamás se llama "automático" |
| 2 | Win-back por API de Meta | NO EXISTE (sin token, sin API configurada) | — | No se vende. Se decide el día que exista |
| 3 | **Push notifications** (FCM) | Automáticas a clientes con app | ~$0 | **Gratis siempre** |
| 4 | Campañas masivas | Dormido | — | Producto aparte, por créditos, after-10-vendors |

Comeleal AI (chat del panel): free = 20 preguntas/mes, Pro = ilimitado (`brain_query_ai.js`).

## Menú completo de monetización (roadmap)

1. **Vivo hoy:** 3% comisión pagos digitales MP · Pro $499/mes (tres paredes de la Caja) · prueba de 14 días con un toque en la pared + reloj en el panel.
2. **Después de la reja (must-do de Ricardo, 7-sep):** el teléfono lo pone el comensal, no el cajero — camino C (reclamar la venta con el QR del mostrador, callable en servidor) y camino B (pantalla volteada). **Gratis siempre** (escalan). Medir la captura de Pecado en septiembre (~1-oct) antes de construir.
3. **Setup $1,500 "te lo dejo hoy":** BLOQUEADO hasta página no-genérica.
4. **After-10-vendors:** campañas de WhatsApp por créditos.
5. **Cuando haya datos de Search Console:** "Tu página en Google" premium.
6. **Nunca se cobra:** menú QR, Caja (cobrar), pedidos, puntos, lista de clientes, mensajes manuales, export, Wallet passes, push.

## Estado de los candados

- [x] **Free sin tope** — `phonePoints.ts` sin `capReached`; `validate-caja-pro-gate.mjs` §7–8 (8-sep).
- [x] **Las tres paredes** — web viva en código (8-sep): reportes (`historyAllowed`), configuración (`canAddPosStaff`), caja (`tableTabsAccess`); todas leen `fetchWithBilling` y pintan `ProWall`. Paridad app en el +53 (mismo día, agente paralelo).
- [x] **Precio 499** — `PRO_AMOUNT_MXN` + barrido "sin precio a mano" en `validate-caja-pro-gate.mjs` §9.
- [x] **Paridad de nombres con la app** — §10 del mismo candado lee el Dart.
- [x] **Consentimiento + reloj de la prueba (v2.1)** — `validate-trial-clock.mjs`; paridad de estados con `trial_clock.dart` cuando exista.
- [x] **Descuentos especiales Pro-gated** — `discountsEnabled()`; bypass Luzz compartido.
- [x] **Comeleal AI chat: free 20 preguntas/mes, Pro ilimitado** — `brain_query_ai.js`.
- [ ] **Reja del lado servidor** — hoy las tres paredes son de cliente (como todo lo demás). Las rules mínimas para `posStaff` (2° miembro exige plan pro/trialing en `private/billing`) viven en el repo de la app; mesas solo cliente por ahora.
- [ ] **Tiendas:** producto nuevo a $499 en Play y App Store (solo Ricardo). El constante web y el `productId` nuevo de la app son lo único en código.

## Don'ts

- No inventar tope a lo que escala: puntos, ventas, escaneos, menú, pedidos, clientes. **El 50 no vuelve.**
- No gate-ear el cobro. Cobrar ahora y cerrar una cuenta que ya existe son gratis SIEMPRE — la pared detiene el "llevar mesas", no el dinero.
- No mandar a `/vendor/plan` desde una pared si el restaurante todavía puede probar: la pared ofrece la prueba ahí mismo — y **jamás la arranca sin el toque del dueño**.
- No escribir "$499" ni "$299" a mano en una página — se importa `PRO_PRICE_LABEL`.
- No subirle el precio a quien ya paga. Pecado se queda en $299.
- No prometer "todo gratis para siempre" en copy nuevo — free = operar sin tope; Pro = la Caja que recuerda y tiene manos.
- No decir "automático" de ningún mensaje de WhatsApp — el dueño lo manda a mano.
- Brand: nunca "fideliza clientes" / "programa de recompensas" / anglicismos de venta. Es "la máquina de que regresen", "tu menú", "tu Caja".
