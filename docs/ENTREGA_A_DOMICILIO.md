# Entrega a domicilio (web) — 9-sep-2026

## Por qué existe

Central Fast Food (Las Matas de Farfán, República Dominicana) es un negocio de
pedidos a casa: la gente pide por la liga, paga en efectivo o transferencia y
el dueño entrega. En 4 días hizo 10 pedidos web reales y TODOS entraron como
"para recoger" porque no había otra opción. Una clienta escribió "Daly dígale
a Harol" en el campo del NOMBRE para dejar el recado de entrega. Zahir pidió
por WhatsApp "el que entrega los pedidos a las personas".

Delivery vivía en el DO-NOT-BUILD de FOODPASS/docs/PENDIENTES.md. Este fue el
trigger, y se construyó el mismo día, web primero (la app no está en RD).

## Qué se construyó (mínimo a propósito)

**Dueño — Configuración → "Entrega a domicilio"**
- `deliveryEnabled` (bool, default apagado): "🛵 Entrego a domicilio".
- `deliveryFee` (número, opcional): costo fijo que se SUMA al total del pedido.
- `deliveryZone` (texto, opcional): "¿Hasta dónde entregas?" — el comensal lo
  lee al elegir A domicilio.

**Comensal — checkout (`/menu/{id}/checkout`)**
- Solo si `deliveryEnabled` y NO hay mesa: "¿Cómo quieres tu pedido?" con dos
  botones grandes, 🛍️ Para recoger (default) / 🛵 A domicilio (muestra el envío).
- A domicilio pide UNA caja de texto: "¿Dónde te lo llevamos?" (mín. 5, máx.
  240 caracteres, texto libre). Sin mapa, sin calle+número, sin geocodificar:
  en su pueblo la dirección es "casa azul frente al colmado" y su pin sigue en
  lat 0.
- El copy de pago cambia a "al recibir" (`DELIVERY_CHOICE_COPY`), el botón
  cobra platillos + envío, y el navegador recuerda la dirección para la
  siguiente vez (`dinerIdentity.address`).

**Pedido (Firestore)** — mismos nombres que YA leía la app
(`lib/models/order.dart`, `OrderDetailScreen.dart`):
- `orderType: "delivery"`, `deliveryAddress: string`, `deliveryFee: number`
  (solo si > 0), `total` = platillos + envío.
- `pickupPaymentMethod` se sigue escribiendo (cómo dijo que paga en la puerta).

**Dueño — Pedidos web**: chip "A domicilio" y la dirección en verde grande
(como la mesa), renglón ENVÍO sobre el TOTAL. "¿Ya te pagó?" cobra el total
con envío porque cobra `order.total`.

**Comensal — página del pedido**: "Te lo llevamos a 🛵 …" en lugar del PIN,
estados propios ("¡Ya va en camino! 🛵"), renglón de envío, y el WhatsApp
lleva `*A domicilio:* dirección` + `Envío — $X`.

**Mercado Pago**: `create-preference` agrega "Envío a domicilio" como
renglón; sin eso MP cobraría menos que `order.total`.

**Línea del menú** (`menuPaymentLine.ts`): con delivery prendido dice
"Ordena en línea · A domicilio o para recoger".

## Candado

`scripts/validate-delivery.mjs` (en `npm test`): default apagado, envío sano,
dirección normalizada, copy sin "recoger" en modo domicilio, delivery SOLO sin
mesa + elegido + con dirección, envío SUMADO al total, nombres canónicos,
Pedidos y WhatsApp pintan la dirección, MP cobra el envío.

## Probado en vivo (9-sep, localhost, TEST REJA 9-SEP `E03GatyUpifyDy7pvRKo`)

Pedido `H2mz2GBJ82ECVVOiYNkW`: `orderType delivery`, dirección guardada,
`deliveryFee 25`, `total 85` (60 + 25), `pickupPaymentMethod cash`; la
validación sin dirección detiene el envío; el WhatsApp salió con la dirección;
un pedido para recoger después siguió saliendo `pickup` sin campos de envío.

## Paridad app (PENDIENTE — viaja en +53 o después)

1. Configuración de la app: toggle + costo + zona (mismos campos).
2. Checkout de la app (`CustomerCartScreen`): la misma pregunta + dirección.
3. Pedidos/Caja de la app: pintar `deliveryAddress` en la tarjeta (el detalle
   ya la pinta). Hoy nadie lo necesita: Zahir es web-only.
