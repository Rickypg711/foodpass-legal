# 🌶️ Opciones por platillo (salsas, aderezos, extras con costo)

> Construido 22 ago 2026, montando Sushin-Gón.
> Contrato probado en `scripts/validate-cart-options.mjs` (`npm run test:cart-options`).

## Qué resuelve

El menú de papel dice "Elige tu salsa: Mango Habanero, Búfalo, BBQ..." y
"Opcional: Camarón +$25". El menú digital pintaba ese texto como **adorno**: el
pedido llegaba a la cocina sin la salsa, y el extra de $25 no se cobraba.
Alguien tenía que hablarle al cliente para preguntarle.

Lo que YA existía y no se usaba: el pedido reservaba `selectedModifiers` y
`notes`, y `app/vendor/pedidos` ya los pintaba. Faltaba **de dónde sacarlos** y
**cómo capturarlos**.

## El flujo completo

```
Descripción del platillo en Firestore
   → resolveOptionGroups(item)
       ¿tiene optionGroups guardados?  → esos MANDAN
       si no                           → parseOptionGroupsFromDescription(description)
   → el "+" del menú abre ItemOptionsSheet (solo si hay grupos)
   → el cliente elige → addItem({ ..., selectedOptions })
       price  = precio base + suma de priceDelta   ← unitario, multiplica por cantidad
       lineId = menuItemId | grupo=opcion | grupo=opcion   ← ordenado, estable
   → checkout: cada variante es su propia línea, con su nota libre
   → buildCustomerWebOrderPayload → items[].selectedModifiers + items[].notes
   → /vendor/pedidos ya los renderizaba · el WhatsApp los lleva con "↳"
   → order.items[].price → total → preferencia de Mercado Pago
```

## Archivos

| Archivo | Rol |
|---|---|
| `lib/menu/optionGroups.ts` | Tipos + parser de la descripción + `resolveOptionGroups` |
| `lib/cart/lineId.ts` | `buildLineId`, `optionsPriceDelta`, `describeSelectedOptions` |
| `lib/cart/types.ts` | `SelectedOptionGroup`, `CartLine.lineId`, `.selectedOptions`, `.notes` |
| `lib/cart/CartProvider.tsx` | `addItem` calcula precio y lineId · `setLineNotes` |
| `lib/cart/cartLineMath.ts` | Todas las operaciones van por `lineId`, no por `menuItemId` |
| `lib/cart/cartStorage.ts` | Migración de carritos guardados sin `lineId` |
| `components/menu/ItemOptionsSheet.tsx` | La hoja donde el cliente elige |
| `components/vendor/OptionGroupsEditor.tsx` | Donde el dueño los crea y les pone precio |
| `app/vendor/setup/menu/page.tsx` | Monta el editor y guarda `optionGroups` |
| `app/vendor/pos/page.tsx` | La Caja: el "+" abre la misma hoja (22 ago) |

## Las reglas que NO se negocian

1. **Un precio solo sale de un `+$NN` ESCRITO en el menú.** Nunca se infiere.
   Leer "+$25" es leer un precio; adivinar uno es inventarlo.
2. **Una elección sin costo es OBLIGATORIA** (la cocina necesita saber la
   salsa). **Un extra con costo es OPCIONAL** — no se le puede exigir a nadie.
3. **`"Acompañada de:"` no se toca.** Eso es lo que YA viene incluido, no una
   elección del cliente.
4. **Sin opciones, `lineId === menuItemId`.** Los carritos ya guardados y los
   platillos sin opciones se comportan exactamente igual que antes.
5. **El sobreprecio entra al precio UNITARIO**, no al subtotal, para que
   multiplique bien por cantidad.

## Los encabezados que reconoce el parser

`elige|escoge|selecciona [tu|el|la...] X:` → grupo obligatorio, $0
`si la/lo quieres de: · opcional(es): · agrega: · añade: · extras:` → opcional, con precio

⚠️ **La lista es amplia a propósito.** La primera versión solo traía
`"Si la quieres de:"` y el menú real de Sushin-Gón dice `"Opcional:"` — el
único platillo con extras de pago del único restaurante que los tenía se
quedaba fuera. Si un menú nuevo usa otra palabra, **agrégala aquí**, no
reescribas el menú del cliente.

El punto final es opcional (hay descripciones que no lo traen) y un punto
seguido de dígito no corta la lista, para no romper un `+$12.50`.

## El parser es un puente, no el destino

Sirve para que los menús **ya importados** funcionen sin rehacerlos. En cuanto
el dueño guarda un platillo desde el editor, `optionGroups` queda escrito y
**manda sobre la descripción para siempre**. Consecuencia a tener presente: si
después edita la descripción para agregar una salsa nueva, esa salsa NO va a
aparecer — tiene que agregarla en el editor. El editor muestra en pantalla
exactamente lo que se va a guardar, así que lo ve antes de darle.

## Trampas ya pisadas

**El input del nombre del grupo perdía el foco a la primera letra.** El div de
cada grupo usa `key={g.id}`, y el `onChange` del nombre volvía a calcular
`g.id` con `slug()` en cada tecla. Cambiaba la key → React destruía y recreaba
el bloque → el foco se iba. El dueño escribía "S" y tenía que volver a hacer
clic para la siguiente letra. **El `id` se genera UNA vez al crear el grupo y
no se vuelve a tocar.** Hay una aserción sobre el código fuente en
`validate-cart-options.mjs` que lo caza si alguien lo reintroduce.

**`cleanOptionGroups` tira los grupos con menos de 2 opciones.** Si escribes
`optionGroups` a mano en Firestore con una sola opción, el primer guardado del
dueño desde el editor te lo borra sin avisar. Por eso el grupo "Estilo" de las
banderillas de Sushin-Gón trae `Normal ($0)` + `FLAMING HOT (+$15)` y no solo
el FLAMING HOT.

## Caso montado: Sushin-Gón (`Cdawk8tmv6MKIh6R1LKh`)

`FLAMING HOT` estaba capturado como platillo suelto de $15 en una categoría
llamada literalmente **"Banderillas Adicional"** — quien capturó el menú ya
sabía que era un adicional, pero el sistema no tenía cómo representarlo.

Lo que se hizo el 22 ago 2026, **a mano en Firestore**:

- Las 4 banderillas (`KAMARONZA`, `DUETO SHINGÓN`, `SHILANGA`, `NORTEÑAZA`)
  llevan `optionGroups: [{ id: "estilo", name: "Estilo", required: false,
  min: 0, max: 1, options: [Normal +$0, FLAMING HOT +$15] }]`.
- El platillo fantasma `FLAMING HOT` (`wcQ4A4qFMPqkGf8cmCul`) quedó con
  `isAvailable: false`. **No se borró.** El menú público filtra por
  `isAvailable`, así que desaparece de la carta y la categoría vacía se va
  sola — y se revierte con un solo campo si hiciera falta.

Resultado verificado en el navegador: KAMARONZA $74 → con FLAMING HOT $89.

## Pedido real, probado de punta a punta (23 ago 2026)

Pedido `hcmbTFfV1GvsbcoT0EXG` (#0T0EXG) en Sushin-Gón, **pago al recoger** para
no tocar Mercado Pago. KAMARONZA con FLAMING HOT $89 + ALITAS 7 con Mango
Habanero/Ranch y nota "sin apio" $95 = $184. En Firestore quedaron los
`selectedModifiers` y el `notes` con la forma exacta que `/vendor/pedidos`
renderiza. Es un pedido de prueba: se puede borrar.

Dos huecos que solo aparecieron haciendo el pedido de verdad:

- **El recibo del cliente** (`order/[orderId]`) pintaba `1x KAMARONZA $89` y
  nada más. Sobre un platillo de carta de $74. El cliente no tenía de dónde
  saber que los $15 eran el FLAMING HOT que él eligió.
- **El WhatsApp del botón "Confirmar por WhatsApp"** salía SIN las opciones.
  `cartLinesForWa` reconstruye `CartLine[]` desde `order.items` y no traía
  `selectedOptions` ni `notes`, así que `formatWhatsappOrderMessage` no tenía
  qué pintar. Ese mensaje es **como el restaurante se entera del pedido**: el
  bug que esta función venía a matar sobrevivía en el único botón que el
  cliente sí aprieta.

Los dos arreglados. Si tocas `cartLinesForWa`, acuérdate de que lo que no
copies ahí desaparece del mensaje sin que nada truene.

## El ciclo completo, ejercitado (23 ago 2026)

Ya se probó **cada eslabón contra datos reales**, no solo por código:

| Eslabón | Cómo se probó |
|---|---|
| Parser → menú | 329 platillos / 27 restaurantes, 0 falsos positivos |
| Cliente elige y paga de más | BOLA DE ARROZ $95 + "Res + Camarón" = $130 |
| Dos variantes no se pisan | ALITAS Búfalo/Ranch y ALITAS BBQ/César, líneas separadas |
| Pedido → Firestore | `hcmbTFfV1GvsbcoT0EXG`, con `selectedModifiers` y `notes` |
| Panel del dueño | `/vendor/pedidos` pinta *Estilo: FLAMING HOT* y la nota en el #0T0EXG |
| Recibo del cliente | Pinta las opciones bajo cada platillo |
| WhatsApp al restaurante | Lleva salsa, aderezo y nota con "↳" |
| **Editor → Firestore** | BOLA DE ARROZ guardado desde el panel: `optionGroups` escrito con los 4 extras y sus precios |
| Guardado → menú | El menú lee lo guardado y sigue cobrando $130 |

Lo único que **NUNCA se ha corrido** es un cobro real de Mercado Pago. Los
montos están verificados, pero el cargo de verdad sigue pendiente de un humano.

## La Caja (POS web) — 22 ago 2026

**Esto no era una regresión, era un hueco.** El menú del cliente preguntaba la
salsa desde el 22 ago, pero `app/vendor/pos/page.tsx` **nunca conoció
`optionGroups`**: su `CartItem` era `{menuItem, quantity}` y se indexaba por
`menuItemId`. Consecuencia: toda venta de mostrador llegaba a la cocina sin
salsa y sin cobrar el `+$25`, mientras la misma orden hecha por el cliente sí
las llevaba. Se descubrió porque Ricardo fue a probarlo a la Caja y no pasaba
nada.

Se cerró **reusando todo**, sin lógica nueva: `resolveOptionGroups`,
`ItemOptionsSheet`, `buildLineId`, `optionsPriceDelta`, `describeSelectedOptions`.
Lo que se agregó al POS:

- `MenuItem` ahora declara `optionGroups` (el loader ya lo traía en el
  `...d.data()`, solo faltaba el tipo — y con la descripción, el parser cubre
  los menús importados).
- `CartItem` gana `lineId`, `unitPrice` y `selectedOptions`. **Alitas búfalo y
  alitas BBQ son dos líneas**, no una de cantidad 2.
- `cartLineToOrderItem()` — **un solo lugar** que arma la línea del pedido, con
  `selectedModifiers` en la forma que `/vendor/pedidos` ya renderizaba. Lo usan
  tanto el pedido nuevo como el "agregar a cuenta abierta"; antes eran dos
  copias del mismo `map` y por ahí es como se abren estas grietas.
- El sobreprecio entra al **precio unitario** (regla 5), así que multiplica bien
  por cantidad y el recálculo del descuento al cerrar lo ve.

Probado en el Chrome de Ricardo contra el menú real de Sushin-Gón: ALITAS 7 pide
Salsa + Aderezo y bloquea hasta elegir; Búfalo+Ranch y BBQ+César quedan en dos
líneas; BOLA DE ARROZ con Camarón sube el botón de `$95` a `$120`.

**Pendiente hermano: el POS del app Flutter sigue sin esto** (ver abajo).

## El lado de la app (Flutter) — 23 ago 2026

**Cerrado:** la app **no pintaba `selectedModifiers` en ninguna pantalla de
pedidos**, con el dato ya guardado en Firestore y el campo ya en su modelo
`OrderItem`. La cocina leía "1× ALITAS" sin la salsa. Arreglado en FOODPASS
`6d38102`, con la lógica en un solo archivo: `lib/order/order_modifiers.dart`,
espejo de `describeSelectedOptions` de aquí.

**Abierto:** el catálogo. La app tiene `modifiers` en su `MenuItem`
(`{name, options[{name, additionalPrice}], isMultiple}`) y la web escribe
`optionGroups`. Dos campos para el mismo trabajo.

Dato que cambia la decisión: **`modifiers` está en `null` en todos los platillos
de los restaurantes revisados**, así que no hay datos que migrar — solo hay que
decidir cuál gana. Y que la app deje **elegir** opciones no es un arreglo de
paridad: es construirle su propia hoja de selección. Hoy no rompe nada, porque
nadie captura desde la app y el pedido de la web llega completo.

**Lo que cambió el 22 ago:** ya NO es cierto que "nadie captura desde la app".
La Caja de la web ya pregunta las opciones, así que el app es el **único** lugar
donde una venta de mostrador todavía pierde la salsa y no cobra el extra. Y ya
hay un espejo exacto que copiar (`lib/cart/lineId.ts` +
`components/menu/ItemOptionsSheet.tsx` + `cartLineToOrderItem`). Sigue pidiendo
simulador y ojos encima.

## Cómo montar esto en un restaurante nuevo

1. Corre el parser contra su menú **antes** de prometer nada. Un barrido de los
   329 platillos de los 27 restaurantes dio 6 platillos con grupos y **cero
   falsos positivos** — pero un menú nuevo puede traer una palabra que no está
   en la lista de encabezados.
2. Ojo con los grupos que salen **obligatorios**: bloquean agregar al carrito
   hasta que el cliente elija. Un falso positivo ahí deja al restaurante sin
   poder vender ese platillo.
3. Si el menú tiene un "adicional" capturado como platillo suelto (el patrón
   FLAMING HOT), conviértelo en grupo y apaga el platillo con `isAvailable`.

## Lo que enseñó Spicy & Sweet (23 ago 2026)

Segundo restaurante con opciones, y el primero donde la elección **es** el producto
("haz tu combinación", 23 salsas de barra libre). Tres cosas que no estaban aquí:

### 6. El nombre del grupo es un SUSTANTIVO, nunca un imperativo
El CTA de `ItemOptionsSheet` se arma como `` `Elige ${g.name.toLowerCase()}` ``. Un grupo
llamado "Escoge tus 8 salsas" produce el botón **"Elige escoge tus 8 salsas"**.

| Nombre del grupo | Encabezado | Botón |
|---|---|---|
| ❌ `Escoge tus 8 salsas` | Escoge tus 8 salsas | Elige escoge tus 8 salsas |
| ❌ `¿Boneless o alitas?` | ¿Boneless o alitas? | Elige ¿boneless o alitas? |
| ✅ `Tus 8 salsas` | Tus 8 salsas | Elige tus 8 salsas |
| ✅ `Boneless o alitas` | Boneless o alitas | Elige boneless o alitas |

El nombre se pinta en DOS lugares con gramática distinta. Escríbelo para los dos.

### 7. "Incluye N" se modela `min: 1, max: N` — nunca `min: N`
El combo #7 incluye 8 salsas. `min: 8` obliga a dar **8 taps antes de poder agregar al
carrito**: la hoja deshabilita "Agregar" mientras falten. Con `min: 1, max: 8` la cocina
siempre recibe salsa (regla 2), el que quiere las 8 las toma, y nadie se atora.
La hoja ya pinta "Hasta 8" sola, así que el cliente sabe cuántas le tocan.

### 8. El parser NO cacha "Con 1 salsa a escoger."
Los encabezados reconocidos piden el verbo **al principio y dos puntos**
(`elige|escoge|selecciona … :`). El menú de Spicy & Sweet dice `"Con 1 salsa a escoger."`
— verbo al final, sin dos puntos. Cero grupos parseados de 16 platillos que sí los
necesitaban.

**No agregues ese patrón al parser a la ligera.** "Con 1 salsa a escoger" describe lo que
el platillo INCLUYE; sin la lista de salsas al lado (vive en otra caja del flyer, la
"BARRA DE SALSAS") el parser no tiene de dónde sacar las opciones. Aquí los 16 platillos
se escribieron a mano contra el flyer, como Sushin-Gón. **Cuando la lista de opciones vive
en otra parte del menú, es trabajo humano — el parser solo puede con lo que está en la
descripción del platillo.**

### Estado de datos de Spicy & Sweet (`ToC7qqk1VODAR9tiG6JK`), 23-ago-2026
16 platillos con `optionGroups` escritos con el Admin SDK:
- **`boneless-o-alitas`** (obligatorio, 1 de 2) en combos #1–#6, los 5 por kilo y el
  infantil de 150 g. **#7 MIX FAMILY NO lo lleva** — ese trae boneless *y* alitas, no hay
  qué escoger.
- **`salsas`** (obligatorio, `min 1` / `max` = las que incluye) con las **23** de la barra,
  todas a $0, en los 7 combos, los 5 por kilo y los 4 del infantil.
- Buffet: **sin grupo**, la barra de salsas es libre.
- Costillas: **sin grupo**. Dicen "2 guarniciones" pero el flyer nunca dice cuáles —
  inventarlas rompería la regla 1. Falta preguntarle al dueño.
- Los nombres de las salsas van con la ortografía del flyer ("Lousiana", "Pikin Limon").
  No se corrige el menú del cliente.

Verificado en vivo: #3 JUST US → elegir Boneless + 2 salsas → el botón pasa de
"Elige boneless o alitas" a **"Agregar — $380"**. El carrito no se bloquea y el precio no
se mueve.
