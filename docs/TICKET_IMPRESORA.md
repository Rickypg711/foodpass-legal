# Ticket para impresora térmica (web) — 10-sep-2026

## Por qué existe

Zahir (Central Fast Food, Las Matas de Farfán, RD) preguntó si podía conectar
su impresora **Aokia de 80 mm con Bluetooth**. Es una térmica ESC/POS normal,
como el 95% de las que se venden en RD y MX (RD$3,800–5,500).

## El camino elegido: el navegador imprime, nosotros no tocamos Bluetooth

`/vendor/ticket/{orderId}` es una hoja limpia (sin panel, sin nav) con el
pedido en formato de 80 mm (o 58) que llama `window.print()`. Quien pone la
impresora es el sistema:

- **Android:** el dueño empareja la impresora por Bluetooth en su celular e
  instala una app puente gratis (**ESCPOS Bluetooth Print Service**; también
  sirven RawBT o Thermer). Esa app aparece como impresora en el diálogo de
  Chrome. Toca Imprimir → elige la impresora → sale el ticket.
- **Computadora con impresora USB:** Chrome la imprime directo.
- **Impresora de red (LAN):** la misma app puente acepta la IP.

Sirve con cualquier marca, sin SDKs, sin mantener drivers. Es el camino 1 de
tres; los otros dos (impresora de nube tipo Star CloudPRNT / Epson que imprime
sola al entrar el pedido; impresión nativa desde la app) quedan para cuando un
local con cocina separada lo pida — y ese sí es Pro.

## Qué hay

- **Ticket** (`app/vendor/ticket/[orderId]/page.tsx`): nombre del local,
  número corto y hora, caja con **a dónde va** (A DOMICILIO + dirección /
  MESA N / PARA LLEVAR + PIN), cliente y teléfono, platillos con opciones y
  notas, premio gratis, envío, TOTAL grande y cómo paga (PAGA CON EFECTIVO AL
  RECIBIR / PAGADO POR TRANSFERENCIA / PAGA AL FINAL EN LA MESA). Monoespaciado,
  sin emojis (las térmicas los pintan como cuadros). `?w=58|80` manda sobre el
  ancho guardado; `?auto=0` no abre el diálogo (QA). `/vendor/ticket/prueba`
  pinta un pedido de muestra.
- **Pedidos:** botón 🖨️ en cada tarjeta.
- **Caja:** el éxito del cobro ofrece "🖨️ Imprimir ticket" al lado de "Enviar
  recibo por WhatsApp" (con teléfono) o solo (sin teléfono). Con ticket, el
  éxito ya no se cierra solo a los 2 s.
- **Configuración → Impresora de tickets:** ancho del papel (`ticketPaperMm`
  58|80, default 80), los tres pasos de Android y "Imprimir ticket de prueba".
- **WhatsApp no cambia:** el recibo por WhatsApp es del cliente (recibo +
  puntos); el ticket es del local (cocina y el papel del pedido a domicilio).

## Candado

`scripts/validate-print-ticket.mjs` (npm test): layout bypass, contenido del
ticket, botones en Pedidos y Caja, Configuración guarda el ancho y tiene
prueba, y nada de Bluetooth/USB desde nuestro código.

## Probado

10-sep en localhost con la sesión de TEST REJA 9-SEP: ticket del pedido real
a domicilio a 80 mm, ticket de prueba a 58 mm, sección de Configuración a
ancho de celular, 3 botones 🖨️ en Pedidos. La impresión física la hace Zahir
con su Aokia (primera impresión por videollamada con Ricardo).

## Pendiente / app

La app no imprime (viaja aparte: impresión Bluetooth nativa, solo si un dueño
con app lo pide). El cobro cross-plataforma no cambia.
