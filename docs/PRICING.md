# Comeleal — Pricing canónico (v1.1, 18 jul 2026)

**Esta es la ley de qué es gratis y qué se cobra.** Cualquier feature nuevo se clasifica con esta regla ANTES de construirse. Si un cambio contradice este doc, se discute aquí primero.

## La regla (test de Hormozi)

> "If it scales, it's free. If it doesn't scale, you have a price tag."

- **Escala (costo marginal ~cero por vendor) → GRATIS.** Software puro: un restaurante más cuesta centavos de Firebase.
- **No escala (costo real por uso o tiempo humano) → SE COBRA.** Mensajes de WhatsApp (Meta cobra por conversación), tokens de AI (Gemini cobra por uso), y el tiempo de Ricardo (setup presencial, soporte directo).

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
- **Soporte directo** (una persona real — el tiempo de Ricardo no escala)

Cobro: IAP en app stores (ya vivo) + suscripción MP en web (`/api/mercado-pago/subscribe`, ya vivo). Campos canónicos en `restaurants/{id}`: `subscriptionPlan == "pro"` + `subscriptionAccessExpiresAt` (los escriben el webhook MP y el IAP).

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
- [x] **Comeleal AI chat: free 20 preguntas/mes, Pro ilimitado** — construido 18 jul en `FOODPASS/functions/brain_query_ai.js`. Contador mensual en `restaurants/{rid}/aiUsage/current`; al tope responde upsell amable (nunca error); solo quema cuota en respuestas reales; falla ABIERTO si el check truena. Límite movible por env `AI_QUERY_FREE_MONTHLY_LIMIT`. **Pendiente: deploy de la function.**
- [ ] **Winback automático (~10 msgs/mes free)** — DIFERIDO a propósito: la API de WhatsApp de Meta NO está configurada aún (sin token el sender no manda nada). El candado se construye el mismo día que se conecte la API — no antes ni después.
- El AI acotado que corre solo (brain diario, siguiente movimiento, reporte semanal, drafts de recompensas, importador de menú) se queda GRATIS: cuesta lo mismo lo use o no, y es el gancho del producto.
- "Soporte directo" NO es perk de venta de Pro (débil). Pro se vende con 3 duras: lealtad ilimitada, winback ilimitado, AI ilimitado.
- Futuro enterprise: winback desde el número PROPIO verificado del restaurante (trámite Meta por vendor — lo que Swirvle cobra $749–1,349/mes). Automatizar WhatsApp personal = ban de Meta, jamás.

## Don'ts

- No inventar límites a cosas que escalan (menú, POS, pedidos, reportes, CRM) — matan la activación y fallan el test.
- No gate-ear features del lado free "porque son valiosos" — se cobran por costo real, no por valor percibido.
- No prometer "todo gratis para siempre" en copy nuevo — free = operar; la máquina completa es Pro.
- No activar presión de venta agresiva mientras haya <10 vendors activos: hoy el cuello es activación, no monetización.
- Brand: nunca "fideliza clientes" / "programa de recompensas" / SaaS-speak. Es "la máquina de que regresen" / "la tarjetita de sellos, pero digital".
