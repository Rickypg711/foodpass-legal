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
