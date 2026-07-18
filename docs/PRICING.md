# Comeleal — Pricing canónico (v1, 18 jul 2026)

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

## Don'ts

- No inventar límites a cosas que escalan (menú, POS, pedidos, reportes, CRM) — matan la activación y fallan el test.
- No gate-ear features del lado free "porque son valiosos" — se cobran por costo real, no por valor percibido.
- No prometer "todo gratis para siempre" en copy nuevo — free = operar; la máquina completa es Pro.
- No activar presión de venta agresiva mientras haya <10 vendors activos: hoy el cuello es activación, no monetización.
- Brand: nunca "fideliza clientes" / "programa de recompensas" / SaaS-speak. Es "la máquina de que regresen" / "la tarjetita de sellos, pero digital".
