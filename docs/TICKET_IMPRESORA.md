# Ticket para impresora térmica (web) — 10-sep-2026

## Por qué existe

Zahir (Central Fast Food, Las Matas de Farfán, RD) preguntó si podía conectar
su impresora **Aokia de 80 mm**. Es una térmica ESC/POS normal, como el 95% de
las que se venden en RD y MX (RD$3,800–5,500). *(Se creyó Bluetooth; el 12-sep
se confirmó que NO — ver la sección de abajo.)*

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

## 12-sep-2026 — su impresora de verdad, y qué NO se construye

**El modelo:** AOKIA **AK-3280**, 80 mm, corte automático, ESC/POS + STAR.
Zahir mandó foto de los conectores: **corriente, RJ11 (gaveta), USB-B y RJ45 de
red** con las luces prendidas. **No trae Bluetooth.** El fabricante (Shanghai
Aokia) la publica "Interface: USB or LAN"; las tiendas de RD igual (Data
Import, Fercomse, CM Store RD). Aokia sí nombra sus modelos con Bluetooth
(ej. AK-3358 "58mm Bluetooth + USB"). → Los tres pasos de Bluetooth de
Configuración **no aplican a su impresora**.

**Cómo imprime con ella:**
- **Computadora:** cable USB + su driver → Chrome la ve → Imprimir. Sin app
  puente, sin IP.
- **Celular:** cable de red al módem; la impresora imprime su IP si se prende
  con el botón del papel apretado; esa IP va en **RawBT** (impresora de red,
  puerto 9100). *ESCPOS Bluetooth Print Service NO sirve: es solo Bluetooth.*
  El celular necesita la app puente porque Android no sabe hablarle a una
  térmica de fábrica.

**Lo que se descubrió en la misma foto:** en el suelo había un ticket de OTRO
sistema ("COMANDA DE ANULACIÓN · Factura · CUENTA M14 · Camarero: CAJA ·
FRANCO DELIVERY"). **Esa impresora ya la maneja su otro punto de venta.** O sea
que ya está enchufada a un aparato que funciona. La pregunta correcta no es
"cómo la conectamos" sino **"¿en qué aparato corre tu sistema de facturas?"** —
si es computadora, abre Comeleal ahí e imprime, y ya.

**Decisiones (Ricardo, 12-sep):**
- **Cero código.** El botón y la hoja de ticket ya existen desde el 10-sep. Lo
  que le falta a Zahir es configuración de su lado, no producto.
- **No se cobra** ayudarle a dejarla andando: son ~15 minutos. La regla "las
  manos se cobran" es para trabajo de horas (montar menú, piel).
- **La impresora de nube (auto-print) NO se construye para él.** Sigue siendo
  Pro futuro para un local con cocina separada que lo pida y pueda pagar. Él no
  tiene cómo pagar (MP no existe en RD, es de puro navegador, y la reja de Pro
  vive en la Caja que no usa).
- **Además, la impresora no es su problema:** del 9 al 12-sep lleva cero
  pedidos. Un ticket imprime pedidos que entran.

**Pendiente (no urgente):** el texto de Configuración → Impresora de tickets
solo explica Bluetooth. Cuando lo toque alguien, que diga los tres caminos
(USB en computadora, red por IP en celular, Bluetooth en celular).

## 23-sep-2026 — ticket de cocina, letras grandes

Zahir (Central Fast Food) respondió que el ticket es **para la cocina** y pidió
**letras más grandes**. Antes era un recibo: platillo con precio en 12 px,
total en 16. Ahora es un ticket de cocina:

- **Lo grande:** número corto + hora (22 px), la caja de a dónde va (A
  DOMICILIO / MESA / PARA LLEVAR, 20 px), cada platillo con su cantidad
  (22 px negritas), opciones y notas (17 px, notas en negritas, sangría).
- **Sin precio por platillo.** La cocina no lo lee.
- **Lo chico, al final:** envío, TOTAL y cómo paga (14–15 px). Se queda para
  que la misma hoja siga sirviendo de pre factura, que es lo que se le
  prometió a Zahir el 22-sep. El nombre del local baja a 14 px.
- Líneas punteadas y recuadro más gruesos (2 px) para que la térmica los
  marque.

Candado en `scripts/validate-print-ticket.mjs`: platillo ≥ 20 px, opciones
≥ 16 px, a dónde va ≥ 18 px, nada de `formatPrice(line)`, el total sigue.

QA: en producción con la sesión de Luzz Pizza (localhost no tiene sesión).

## 23-sep-2026 (tarde) — el ticket de cocina es PRO, y sale solo

**Por qué.** Zahir es el dueño que más pide (delivery, pre factura, letras
grandes) y cero ha pagado. Ricardo: "quiero que lo use bien Y que pague".
Lo que él pidió es justo lo que los grandes cobran aparte (Toast y Square
cobran la cocina); nadie más en México lo usa hoy, así que no se le quita
nada a nadie.

**Pared 4 — `kitchenPrint`** (`lib/subscription/entitlement.ts`,
`kitchenPrintAccess`; free = false, Pro = true; bypass de fundador abre).
La misma `ProWall` de la Caja, con sus 14 días gratis de un toque y sin
tarjeta. Título "Ticket de cocina e impresora"; resultado "Para que cada
pedido salga solo en tu cocina, en grande, sin que nadie lo copie a mano".
**Solo web:** la app no imprime, así que el nombre no tiene espejo en el Dart
a propósito (el candado de paridad sigue leyendo los cuatro de siempre).

Dónde está la reja (con reja cerrada, la pared sale AL TOCAR y, si se abre,
repite la acción):
- Pedidos → 🖨️ de cada tarjeta (`openTicket`).
- Caja → "Imprimir ticket" del éxito (`onTicket`; la Caja ahora pinta
  `wall={wallKind}`: mesas o ticket).
- Configuración → "Imprimir ticket de prueba" y el interruptor "Sale solo".
- La hoja `/vendor/ticket/{id}` misma (por si abren el link directo): lee el
  plan con `fetchWithBilling` y no imprime con reja cerrada.

**Sale solo — `autoPrintTickets`** (doc del restaurante, default false; se
prende en Configuración → Impresora, solo con Pro/prueba):
- Pedidos ya recibe los pedidos en vivo. Con el interruptor prendido y Pro,
  cada pedido que ENTRA a la bandeja (pending/open_tab) después de abrir la
  pestaña (colchón de 2 min, `shouldAutoPrint`) se abre en un **iframe
  escondido** (420×640 fuera de la vista; uno de 0×0 imprime en blanco) y la
  hoja llama `print()`. Uno a la vez: la hoja avisa con
  `postMessage("comeleal:ticket-printed")` y Pedidos quita el iframe y sigue;
  si nadie contesta en 45 s, sigue igual. Lo que ya estaba en la bandeja al
  abrir NO se imprime (nada de 20 tickets de anoche).
- **Sin ventana:** Chrome abierto con `--kiosk-printing` imprime a la
  impresora predeterminada sin preguntar. Los pasos están en Configuración
  (acceso directo → Propiedades → Destino). Sin ese modo sale la ventana y
  basta un Enter.
- La pestaña lo dice: "🖨️ Sale solo en tu impresora"; si se acabó la prueba,
  "Impresión automática en pausa · es Pro" y abre la pared.
- El interruptor se lee una vez al abrir Pedidos (getDoc): cambiarlo en
  Configuración pide recargar Pedidos.

**Cobrarle a Zahir (RD, sin Mercado Pago):** paga por PayPal o envío de
dinero, y Pro se prende a mano en `restaurants/{id}/private/billing`:
`subscriptionPlan: "pro"`, `subscriptionAccessStatus: "active"`,
`subscriptionAccessExpiresAt: +31 días`, `subscriptionUpdatedAt`,
`subscriptionReconcileSource: "manual"`. La regla única (`entitlementOf`)
lo lee tal cual; al vencer, el barrido de billing lo regresa a free.

**Candados:** `validate-caja-pro-gate.mjs` §6b (tabla, bypass, las cuatro
superficies, ningún `window.open` directo en Pedidos) y
`validate-print-ticket.mjs` §5 (tabla de `shouldAutoPrint`, postMessage,
iframe con tamaño, cola, copy de Configuración).

**Paridad app:** nada. La app no imprime ni ve esta pared (documentado en
PARIDAD: "impresión = web-only").

**QA:** en prod con Luzz (bypass: sin pared) se ve el interruptor, la
etiqueta "Sale solo" y el ticket sigue saliendo. La pared con reja cerrada
la afirman los candados; el primer dueño real que la vea es Zahir.
