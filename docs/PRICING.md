# Comeleal — Pricing canónico (v1.3, 6 ago 2026)

**Esta es la ley de qué es gratis y qué se cobra.** Cualquier feature nuevo se clasifica con esta regla ANTES de construirse. Si un cambio contradice este doc, se discute aquí primero.

## La regla (test de Hormozi)

> "If it scales, it's free. If it doesn't scale, you have a price tag."

- **Escala (costo marginal ~cero por vendor) → GRATIS.** Software puro: un restaurante más cuesta centavos de Firebase.
- **No escala (costo real por uso o tiempo humano) → SE COBRA.** Mensajes de WhatsApp (Meta cobra por conversación), tokens de AI (Gemini cobra por uso), y el tiempo de Ricardo (setup presencial, soporte directo).

### La excepción de operador (v1.2 — regla de valor)

Hormozi tiene una segunda regla que manda sobre la primera: **el precio va en lo más cercano al resultado.** Un feature que escala puede ser Pro si cumple LAS TRES:

1. **No se necesita para operar el día 1** (no toca activación: menú, caja, pedidos, CRM siguen intactos en free).
2. **Es política de dinero del negocio** (controla precios, descuentos, márgenes — cosas de dueño que opera en serio, no de puesto que empieza).
3. **Lo pidió un vendor real** (demanda comprobada, no imaginada).

Si falla cualquiera de las tres, aplica la regla base: escala → gratis. Esta excepción existe para que el candado de valor no se coma el funnel gratis.

**Casos clasificados con esta excepción:** Descuentos especiales (staff/familia) — lo pidió Pecado Escondido (vendor Pro en trial, 26 jul), es política de precios del dueño, y ningún restaurante lo necesita para arrancar. → **Pro.**

**Equipo / staff (clasificado 27 jul):** *trabajar la caja = gratis; saber qué hace tu equipo cuando no estás = Pro.*
- **GRATIS:** Equipo de la caja (roster de PINs, switcher "¿Quién cobra?", soldBy en órdenes, tabla básica "Ventas por empleado" en Reportes). Razón: un restaurante CON staff lo necesita para operar el día 1 (falla la condición 1 de la excepción), escala, y cada venta atribuida alimenta el moat de datos. Square también regala los passcodes básicos.
- **PRO:** (a) Cuentas de staff con login propio (invitar miembros) — ya Pro vía entitlement teamManagementAccess en la app; la web no necesita gate propio porque los members solo se crean por ese flujo. (b) La inteligencia por empleado (AI: anomalías de descuentos, ventas por turno, sugerencias de staffing) — es "la máquina", va con Comeleal AI.

## Free — "Opera gratis"

Todo lo que necesita un restaurante para OPERAR, sin límite de tiempo y sin tarjeta:

- Menú digital QR + página pública del menú (SEO incluido — "te pongo en Google gratis")
- Caja / POS: cobro inmediato, cuentas abiertas por mesa, recibo por WhatsApp
- Pedidos en línea y pedidos por WhatsApp
- CRM de clientes: ver clientes, visitas, gasto (los números capturados SIEMPRE se guardan — ver "cap honesto" abajo)
- Reportes básicos (hoy + semana + 30 días)
- Lealtad: hasta **50 visitas de lealtad al mes** (visitas con app o con número)
- Probadita de la máquina: winback automático limitado + Comeleal AI con uso ligero

**Por qué free es así de generoso:** es el funnel. El pitch de venta en persona y en la web es "te dejamos funcionando hoy, gratis". El software escala; regalarlo no nos cuesta. La retención del vendor se gana con uso, no con candados.

## Pro — $299 MXN/mes: "La máquina de que regresen"

Se vende como UNA cosa: *Comeleal te trae clientes de vuelta solito.* Compuesta por lo que NO escala:

- **Lealtad ilimitada** (se quita el tope de 50 visitas/mes)
- **Recuperación automática por WhatsApp ilimitada** (cada mensaje nos cuesta dinero real con Meta → es el ancla honesta del precio)
- **Comeleal AI sin límite** (análisis de clientes, ventas, tendencias — tokens cuestan)
- **Descuentos especiales (staff y familia)** — perfiles por porcentaje (por categoría o cuenta total) asignados por número; la caja los aplica sola al cobrar. Puntos SIEMPRE sobre lo pagado (anti-farming) y cada perfil elige si junta puntos (`earnsPoints`). *Escala, pero es Pro por la excepción de operador (arriba).*
- **Soporte directo** (una persona real — el tiempo de Ricardo no escala)

Cobro: IAP en app stores (ya vivo) + suscripción MP en web (`/api/mercado-pago/subscribe`, ya vivo). Campos canónicos en `restaurants/{id}`: `subscriptionPlan == "pro"` + `subscriptionAccessExpiresAt` (los escriben el webhook MP y el IAP).

## La prueba de Pro — 14 días, sin tarjeta, una por restaurante (v1.3, 6 ago 2026)

**Por qué existe.** El plan gratis es el gancho de entrada y no se toca. La prueba tiene otro trabajo: que el dueño **pruebe la máquina** (lealtad ilimitada, win-back, AI) y sienta el tope de 50 cuando se le acaba. Sin probarla, el tope es una abstracción; después de probarla, es una pérdida.

**Términos.** 14 días · Pro completo · sin tarjeta ni datos de pago · **una sola vez por restaurante, para siempre** · al terminar cae solo al plan gratis con menú, Caja, clientes e historial intactos. No hay cobro sorpresa porque nunca hubo tarjeta.

**Por qué "sin tarjeta" no es un detalle.** Es el estándar del mercado mexicano de POS (Maspedidos vende exactamente eso: 14 días, sin tarjeta, alta en 2 minutos). Pedir tarjeta para una prueba mata la conversión del restaurantero que apenas está viendo.

**Diferencia contra el trial de un POS típico:** cuando a ellos se les vence, el negocio se queda sin sistema. Cuando a nosotros se nos vence, el negocio sigue operando gratis. Eso se comunica siempre, es el argumento.

### Cómo está construido (la ley técnica)

- **Se otorga SÓLO desde el servidor:** callable `startProTrial` (FOODPASS/functions/subscription_trial.js). El reloj es del servidor; jamás se acepta una fecha del cliente.
- **El candado anti-repetición es `restaurants/{rid}/private/trial`**, un doc que las reglas niegan a todo cliente (`allow write: if false`). Tiene que ser así: los campos `subscription*` del doc del restaurante SÍ son client-writable, porque el flujo de compra IAP de la app los escribe. Sin el ledger, cualquiera se renovaría 14 días infinitas veces desde la consola del navegador.
- **Anti doble dip:** al otorgar se escribe `subscriptionTrialEndsAt`, que es justo el campo que la app consulta en `SubscriptionTiersPage.showIntroTrialProMarketing` para dejar de ofrecer la prueba de la tienda. Así nadie junta 14 días nuestros + 14 de Google/Apple.
- **Vence sola.** Todos los gates comparan contra `subscriptionAccessExpiresAt` **en cada lectura**, así que el acceso muere al segundo 14×24h aunque nada corra. El barrido diario (`subscription_access_sweeper`) sólo deja el status honesto para reportes — es higiene, no el candado. Importa saberlo porque hoy está DORMANT.

### La regla única de "¿tiene Pro?" (auditoría 6 ago 2026)

Había **cuatro** checks de Pro distintos y no coincidían. El de la AI del servidor (`brain_query_ai.isProRestaurant`) era **fail-open**: ignoraba el status y, sin fecha de expiración, devolvía `true` — AI ilimitada de por vida. Con una prueba de 14 días eso era fatal: al vencerse, el dueño perdía descuentos y lealtad pero conservaba la feature más cara para siempre.

Ahora hay **una sola regla, replicada en los tres runtimes y con tests espejo**:

| Runtime | Archivo | Test |
|---|---|---|
| Servidor | `FOODPASS/functions/subscription_entitlement.js` | `subscription_entitlement.test.js` |
| Web | `foodpass-legal/lib/subscription/entitlement.ts` | `scripts/validate-subscription-entitlement.mjs` |
| App | `lib/loyalty/discount_profiles.dart`, `lib/subscription/services/subscription_tier_service.dart` | `test/loyalty/discount_profiles_test.dart` |

**Semántica (fail-closed):** `subscriptionPlan == "pro"` **Y** status ∈ {active, trialing} **Y** `subscriptionAccessExpiresAt > ahora`. Sin fecha → NO es Pro.

**Única excepción:** doc legado con el viejo `plan: "pro"` y CERO campos canónicos (nunca pasó por el backfill) → se le respeta el acceso. En cuanto exista cualquier campo canónico, el canónico manda y manda estricto. El hueco se cierra solo conforme avanza el backfill, sin cortarle el servicio a nadie.

**Don't:** escribir un check de Pro nuevo. Se importa `entitlementOf` / `isProActive`. Si un gate necesita algo distinto, se discute aquí antes.

## Comisión 3% — se queda como está

3% solo en pagos digitales en línea (Mercado Pago). Escala con las ventas DEL restaurante, no con nuestro costo — cobramos solo cuando les va bien. Efectivo y terminal propia: 0%. (El copy público "sin comisiones" se refiere a pedidos por WhatsApp / vs. apps de delivery que cobran ~30% — nunca prometer 0% en pagos en línea MP.)

## El tope de 50 — cómo funciona (cap honesto)

El tope es el **trigger** de venta, no el valor de Pro. Reglas:

1. **El cliente SIEMPRE se guarda en el CRM** — número, visita, gasto. Llegar al tope jamás tira un cliente a la basura (eso era un bug, arreglado 18 jul). Lo único que se detiene al tope es la ACUMULACIÓN de puntos.
2. **Canjear nunca se bloquea** — un premio ya prometido al cliente se cumple siempre (regla never-lie).
3. **El dolor es visible para el DUEÑO, nunca silencioso:**
   - Panel: contador "X/50 visitas de lealtad este mes" con barra de progreso.
   - Panel al tope: banner "🎉 Lealtad llena — actívale ilimitado" (llegar a 50 = el producto funciona = momento de venta, se celebra, no se regaña).
   - Caja al cobrar en tope: "Guardamos a este cliente, pero ya no sumó puntos — lealtad llena este mes."
   - Configuración → Plan: tabla Free vs Pro + botón "Activar Pro" (MP web, ya wired).
4. **El cliente final no paga los platos rotos:** al tope no se le promete puntos que no van a existir (los UI de cliente no deben mostrar "ganaste X pts" si el credit regresó capReached).

## Dónde se comunica (mismas 4 superficies, siempre el mismo mensaje)

1. Panel `/vendor` — contador + banner al tope
2. Caja `/vendor/pos` — aviso al cobrar en tope
3. Configuración `/vendor/configuracion` — sección Plan con Free vs Pro y botón de pago
4. Público `/precios` (+ home) — "Gratis para operar. Pro $299 para que la máquina te regrese clientes." Los anuncios de Google aterrizan en páginas coherentes con esto.

## Los 4 canales de mensajes — cuál cuesta y cuál se cobra

La regla operativa: **si sale del teléfono del dueño, es gratis. Si lo manda la máquina por la API de Meta, nos cuesta — y lo que cuesta, se cobra.**

| # | Canal | Cómo funciona | ¿Nos cuesta? | Free / Pro |
|---|-------|--------------|--------------|------------|
| 1 | **Botón de Clientes (manual + AI copiloto)** | En `/vendor/clientes` el AI redacta el mensaje; "Abrir WhatsApp" abre un link `wa.me` y el DUEÑO lo manda desde SU WhatsApp personal | **$0** (Meta no cobra; tokens de redacción son centavos) | **Gratis siempre** — nunca limitarlo |
| 2 | **Winback automático** (`scheduledCustomerWhatsAppReEngagement`) | Cloud Function con horario; manda solo, sin humano, por la **API de WhatsApp Business** (graph.facebook.com) | **Sí** — Meta cobra por conversación business-initiated | Free = probadita (~10 msgs/mes) · Pro = ilimitado. **Candado pendiente de construir** |
| 3 | **Push notifications** (FCM) | Automáticas a clientes con app (reward unlocked, expiry, at-risk) | ~$0 (FCM) | **Gratis siempre** |
| 4 | **Campañas masivas** (WhatsApp Operator, construido jun 14, dormido) | El dueño dispara UNA promo a TODOS sus números capturados; la máquina la manda por la API de paga | **Sí** — por mensaje | **Producto aparte, por créditos** (ej. 100 msgs / $99). Activar en after-10-vendors, NO antes |

Comeleal AI (chat del panel): tokens de Gemini cuestan → free = uso ligero, Pro = ilimitado. Candado pendiente.

## Menú completo de monetización (roadmap)

1. **Vivo hoy:** 3% comisión pagos digitales MP · Pro $299/mes (hoy su único candado real es el tope de 50 — ver pendientes).
2. **Vendible YA sin código — el tiempo de Ricardo:** *Setup premium* (~$999–1,499 una vez): menú cargado con fotos, recompensas configuradas, equipo entrenado en la Caja, página en Google verificada, primera campaña de lealtad andando. El "te dejamos funcionando hoy" gratis sigue siendo el gancho básico; esto es el paquete completo.
3. **After-10-vendors:** Campañas de WhatsApp por créditos (canal 4 — pipe ya construido, no rebuilddear).
4. **Cuando haya datos de Search Console (meses):** "Tu página en Google" premium — el play Owner.com: landing propia, SEO local, Google Business, reseñas. Se vende con el reporte de tráfico en la mano ("200 personas te encontraron por Google este mes").
5. **Nunca se cobra:** menú QR, Caja/POS, pedidos, CRM, reportes, Wallet passes, canal 1 (manual) y canal 3 (push).

## Estado de los candados

- [x] **Tope 50 visitas de lealtad** — vivo (web, cap honesto + avisos, 18 jul).
- [x] **Descuentos especiales Pro-gated** — vivo en web (27 jul): `discountsEnabled()` exige plan pro activo/trialing. Free ve upsell "⭐ Incluido en Pro" en Configuración + bullet en Tu plan y /precios. TEMP: override de prueba para Luzz (`FOUNDER_TEST_RESTAURANT_IDS`) — quitar antes de vender. Paridad app pendiente (release-blocking).
- [x] **Comeleal AI chat: free 20 preguntas/mes, Pro ilimitado** — construido 18 jul en `FOODPASS/functions/brain_query_ai.js`. Contador mensual en `restaurants/{rid}/aiUsage/current`; al tope responde upsell amable (nunca error); solo quema cuota en respuestas reales; falla ABIERTO si el check truena. Límite movible por env `AI_QUERY_FREE_MONTHLY_LIMIT`. **Pendiente: deploy de la function.**
- [ ] **Winback automático (~10 msgs/mes free)** — DIFERIDO a propósito: la API de WhatsApp de Meta NO está configurada aún (sin token el sender no manda nada). El candado se construye el mismo día que se conecte la API — no antes ni después.
- El AI acotado que corre solo (brain diario, siguiente movimiento, reporte semanal, drafts de recompensas, importador de menú) se queda GRATIS: cuesta lo mismo lo use o no, y es el gancho del producto.
- "Soporte directo" NO es perk de venta de Pro (débil). Pro se vende con 4 duras: lealtad ilimitada, winback ilimitado, AI ilimitado y descuentos especiales.
- Futuro enterprise: winback desde el número PROPIO verificado del restaurante (trámite Meta por vendor — lo que Swirvle cobra $749–1,349/mes). Automatizar WhatsApp personal = ban de Meta, jamás.

## Don'ts

- No inventar límites a cosas que escalan (menú, POS, pedidos, reportes, CRM) — matan la activación y fallan el test.
- No gate-ear features del lado free "porque son valiosos" — se cobran por costo real, no por valor percibido. Única salida: la **excepción de operador** (las 3 condiciones, documentada arriba). Si no cumple las tres, es gratis.
- No prometer "todo gratis para siempre" en copy nuevo — free = operar; la máquina completa es Pro.
- No activar presión de venta agresiva mientras haya <10 vendors activos: hoy el cuello es activación, no monetización.
- Brand: nunca "fideliza clientes" / "programa de recompensas" / SaaS-speak. Es "la máquina de que regresen" / "la tarjetita de sellos, pero digital".
