# 🍽️ Pedido desde la mesa (QR numerado)

> Construido 6 ago 2026. Robo del teardown de Maspedidos.
> Contrato probado en `scripts/validate-table-orders.mjs` (`npm run test:table-orders`).

## Qué resuelve

Ya teníamos menú QR y pago en línea, pero el menú era **a nivel restaurante**:
cuando entraba un pedido, nadie sabía a qué mesa llevarlo. Esto lo cierra: el
comensal escanea el QR de SU mesa, ordena desde su teléfono, puede pagar ahí
mismo, y el pedido llega a la caja con el número de mesa.

## El flujo completo

```
QR impreso de la mesa 5
   → /menu/{restaurantId}?mesa=5
   → app/menu/[restaurantId]/page.tsx captura ?mesa= y lo guarda en sessionStorage
      (⚠️ ESTE es el punto crítico: de aquí en adelante el parámetro se pierde
       de la URL. Si este efecto no corre, el pedido sale como "para recoger")
   → banda "Estás en la mesa 5" en el menú
   → checkout lee la mesa de sessionStorage + pregunta "¿cuántas personas?"
   → buildCustomerWebOrderPayload → orderType: "dine_in" + tableNumber + diners
   → /vendor/pedidos muestra el chip verde "🍽️ Mesa 5 · 4p"
```

## Archivos

| Archivo | Rol |
|---|---|
| `lib/order/tableSession.ts` | Lógica pura: normalizar mesa/personas, persistir en sessionStorage, armar la URL del QR |
| `lib/types/order.ts` | `ORDER_TYPE_DINE_IN`, `tableNumber?`, `diners?` |
| `lib/order/buildOrderPayload.ts` | La mesa decide el modo: `tableNumber ? dine_in : pickup` |
| `lib/order/createCustomerOrder.ts` | Pasa mesa/personas al builder |
| `app/menu/[restaurantId]/page.tsx` | **Captura `?mesa=`** + banda de mesa |
| `app/menu/[restaurantId]/checkout/page.tsx` | Bloque de mesa + "¿cuántas personas?" |
| `app/vendor/mesas/page.tsx` | Genera e imprime los QR (2 por hoja, CSS `@media print`) |
| `app/vendor/pedidos/page.tsx` | Chip verde con la mesa |
| `app/vendor/layout.tsx` | Entrada "Mesas / QR" en el nav secundario |

## Decisiones que NO son obvias

- **`tableNumber` es string, no número.** En la vida real las mesas se llaman
  "Barra", "T3", "Terraza 2". `normalizeTableNumber` acepta letras, números,
  espacios, `#` y `-`, corta a 12 caracteres y sanea el resto.
- **sessionStorage, no localStorage.** La mesa debe morir al cerrar el
  navegador. No queremos que un cliente que ordenó en la mesa 5 el martes
  siga "en la mesa 5" cuando pida para llevar el viernes.
- **El `pickupPin` se sigue generando siempre**, también en dine_in. Sirve de
  folio corto para que el mesero cante el pedido sin leer un id de Firestore.
- **El QR se genera con `SITE_URL`, NO con `window.location.origin`.** Estos QR
  se imprimen y se pegan a la mesa para siempre; generarlos con el origin del
  navegador dejaría pegado el dominio de un preview de Vercel o de localhost.
- **El pago ya funcionaba.** Mercado Pago y "pagar al recoger" no se tocaron:
  en dine_in, pagar en línea = pagar desde la mesa, y pagar al recoger = pagarle
  al mesero. Cero cambios en el camino del dinero.

## Lo que falta (app + paridad)

La app de Flutter aún **no muestra** `tableNumber` en su pantalla de Pedidos.
Como el campo es opcional y la app ignora campos que no conoce, no se rompe
nada — pero un vendor que trabaje los pedidos desde la app no verá la mesa.
**Pendiente POST-5.1.3** (5.1.3 es SOLO-billing por el deadline de PBL 8).
Regla de paridad: esto no es dinero ni puntos, así que la divergencia temporal
es tolerable — pero hay que cerrarla.

---

## 🔜 Siguiente: la sesión de mesa (idea de Ricardo, 6 ago 2026 — NO construido)

**La cuenta dividida ya funciona por accidente y es buena.** Cada persona que
escanea el QR abre su propia sesión (usuario anónimo propio + carrito propio en
sessionStorage, que es por navegador). 5 personas en la mesa 6 = **5 órdenes
separadas, las 5 con `tableNumber: "6"`**, cada quien paga la suya. Nadie tiene
que partir la cuenta a mano.

**Y cada una deja su propio teléfono.** 5 clientes en la base en vez de 1 — el
que paga la cuenta de todos captura uno solo y deja 4 fantasmas. Para un
producto de lealtad eso multiplica por 5 la materia prima de puntos, winback y
CRM. Ni Owner.com ni Maspedidos ni FluxSales lo hacen.

**Lo que falta es del lado del restaurante:**

1. La cocina ve 5 tickets sueltos llegando en 5 momentos y no sabe que son la
   misma mesa → la comida sale escalonada. Inaceptable con meseros.
2. El dueño no puede ver "mesa 6: 5 pedidos, $840, todos pagados".
3. Se pregunta "¿cuántas personas?" 5 veces.

**El fix:** agrupar los pedidos de una misma mesa dentro de una ventana de
tiempo como una sola visita — lo que un POS llama "la cuenta". Resuelve los 3.

**Prioridad:** no urgente para taquerías, food trucks, comida rápida ni dark
kitchens. **Sí necesario** antes de vender a marisquerías, bares y restaurantes
de mesas grandes — justo las verticales que ya tienen landing.

**A checar cuando se construya:** montos mínimos de Mercado Pago con 5
transacciones chicas · el caso "yo invito" (hoy no hay forma de unir carritos) ·
cuánto dura la ventana de la sesión (ojo con la jornada de corte 4 AM) ·
paridad con la app.

---

## ✅ Construido: la mesa abre una cuenta (23 ago 2026)

De los 3 problemas de arriba, este cierra el **#1 y el #2**.

### Qué cambió

**1. Sentado en la mesa ya no se pregunta cómo va a pagar.**

Antes el comensal de la mesa 5 veía "Forma de pago → Pagar al recoger — Efectivo
o tarjeta **en el local**". Está sentado adentro: no va a recoger nada, y la
decisión de cómo se paga la cuenta ni siquiera es suya todavía. Ahora el botón
dice **"Mandar a la cocina · $120"** y abajo **"Se agrega a la cuenta de tu
mesa. Pagas al final."**

También el nombre pasó a ser **opcional** en mesa (paridad con
`pickup_info_dialog` de la app), con otra razón de ser: *"Para que el mesero sepa
cuál platillo es tuyo"*, no *"para avisarte cuando esté listo"*.

**2. El pedido de mesa nace como cuenta abierta, no como ticket cerrado.**

`status: "pending"` + `isOpenTab: true` — la forma canónica de una cuenta
(`pos_service.dart` §62). Así el mesero la cierra con la máquina que YA existe:
propina, teléfono para los puntos, y canje del premio al cobrar.

La cocina la sigue viendo: `app/vendor/pedidos/page.tsx` mete `pending` y
`open_tab` en la misma columna de pendientes.

### Las dos trampas que tiene esto (y que hay un test para cada una)

**a) Una mesa YA PAGADA con Mercado Pago no debe abrir cuenta.** Una cuenta
abierta es algo *por cobrar*. Si un pedido de mesa prepagado se abriera igual, se
quedaría colgado para siempre en "Cuentas abiertas" esperando un cobro que nunca
llega. Por eso la condición es mesa **Y** `pay_at_pickup`, nunca solo mesa.

**b) El nombre de la cuenta pasa por `tableLabel`, no por `` `Mesa ${n}` ``.**
Una mesa llamada "Barra" o "Terraza 1" saldría como "Mesa Barra" — el mismo bug
que ya arregló `tableLabel` en la hoja de QR.

`scripts/validate-table-orders.mjs` verifica las dos, **y la forma en los dos
repos**: si la app y la web dejan de escribir el mismo documento, truena.

### Lo que NO se construyó, y por qué

**Los 4 amigos de la mesa 5 siguen abriendo 4 cuentas, no una.**

No es flojera: las reglas de seguridad de Firestore dicen que un cliente solo
puede escribir en SU propio pedido —

```
allow update: if isRestaurantAssociate(...) || resource.data.customerId == request.auth.uid
```

— así que el comensal B **no puede** agregarle su orden a la cuenta del
comensal A. Y está bien que no pueda: lo contrario deja que cualquier sesión
anónima le escriba pedidos a la cuenta de un desconocido.

Juntarlas de verdad necesita una **Cloud Function** que haga el merge del lado
del servidor (donde las reglas no aplican y se puede validar que de veras es la
misma mesa, la misma jornada y el mismo restaurante). Eso es la pieza que sigue.

Mientras tanto el mesero ve 4 cuentas **todas llamadas "Mesa 5"**, juntas en la
lista — que es peor que una sola cuenta, pero muchísimo mejor que 4 tickets
cerrados sueltos que tenía que sumar de cabeza.

**Cuenta dividida de verdad** (cada quien paga lo suyo desde su teléfono) sigue
sin construirse **a propósito**: hoy ya funciona por accidente y mejor, porque
cada quien deja su propio teléfono y son 5 clientes en la base en vez de 1.

---

## 📋 EL PENDIENTE — juntar a los amigos en UNA cuenta

> **Estado: NO construido.** Esto es el diseño, no una descripción de algo que
> ya exista. Escrito el 23-ago-2026 para no volver a partir de cero.

### El problema en una frase

4 amigos en la mesa 5 abren **4 cuentas** (todas llamadas "Mesa 5", juntas en la
lista de la Caja). Deberían ser **1 cuenta con 4 personas adentro**.

### La trampa que hay que NO caer

El impulso obvio es *"que el segundo pedido se meta adentro del primero"*. Está
mal por dos razones:

1. **Las reglas no lo permiten, y con razón.** Un comensal solo puede leer y
   escribir **su propio** pedido (`firestore.rules` → `resource.data.customerId
   == request.auth.uid`). Ni siquiera puede *ver* la cuenta del otro para
   sumarse. Aflojar eso deja que cualquier sesión anónima le escriba pedidos a
   la cuenta de un desconocido.
2. **La cocina quiere las rondas separadas.** Si el segundo pedido desaparece
   dentro del primero, la comanda nueva se pierde: la cocina ya vio ese ticket.
   Fusionar documentos rompe el flujo de cocina para arreglar el de cobro.

### El diseño: agrupar, no fusionar

Un campo nuevo, **`tabId`**, en los pedidos de mesa.

- **Para la cocina, nada cambia:** cada pedido sigue siendo su propio ticket. Las
  rondas llegan como rondas. Eso ya está bien y no se toca.
- **Para el cobro, es una sola cuenta:** la Caja agrupa por `tabId` y enseña
  **una fila**: *"Mesa 5 · 4 personas · $840"*.

El primer pedido de la mesa en la jornada **crea** el `tabId` (el suyo propio).
Los siguientes **se cuelgan** del mismo.

### La única pieza que de veras necesita servidor

Una callable chiquita:

```
resolveTableTab({ restaurantId, tableNumber }) -> { tabId }
```

Busca la cuenta abierta más vieja de esa mesa **en la jornada actual** y
devuelve su `tabId`; si no hay, devuelve el nuevo. El cliente luego escribe ese
`tabId` **en su propio pedido**, que las reglas sí permiten.

**Por qué tiene que ser servidor:** el comensal no puede leer los pedidos de los
demás, así que no puede encontrar la cuenta por su cuenta. Fíjate que la función
**no escribe nada de nadie más** — solo lee y responde un id. Es la superficie
más chica posible.

**Ojo con la jornada:** "hoy" es la jornada de negocio con corte a las **4 AM**
(`resolveBusinessDayCutoffHour`, ya existe y tiene tests), no la medianoche. Una
mesa de las 11 PM y otra de la 1 AM son la misma noche.

### El cierre (esto NO necesita función)

El dueño **sí** puede escribir todos los pedidos de su restaurante. El cierre es
una transacción del lado de la Caja sobre los N pedidos con ese `tabId`:
una propina, un descuento, un total.

### 🎁 Y aquí está el remate — lo que los grandes NO hacen

**Cada comensal dejó SU PROPIO teléfono al ordenar.**

Un POS normal cierra la mesa 5 y captura **un** cliente: el que pagó. Los otros 3
son fantasmas. Comeleal ya tiene los 4 números, cada uno amarrado a lo que ESA
persona pidió y pagó.

Entonces al cerrar la cuenta, los puntos **se acreditan a los 4 teléfonos**, cada
quien por su consumo. Una mesa de 4 = **4 clientes en la base**, no 1. Para un
producto de lealtad eso multiplica por 4 la materia prima de puntos, winback y
CRM — y es la razón de fondo por la que este flujo vale la pena, más allá de que
el mesero deje de sumar tickets de cabeza.

Es lo mismo que ya hace [[checkout_redemption]] en un pedido individual, pero por
persona dentro de una mesa.

### Definición de "listo"

- [ ] Callable `resolveTableTab` desplegada, con corte de jornada 4 AM
- [ ] `buildOrderPayload.ts` y `pos_service.dart::createOrder` escriben `tabId`
      (los dos, o `validate-table-orders.mjs` truena)
- [ ] La Caja agrupa por `tabId`: una fila por mesa, con cuántas personas
- [ ] El cierre cobra los N pedidos en una transacción
- [ ] Los puntos se acreditan a **cada** teléfono por su propio consumo
- [ ] Paridad app ↔ web, verificada en las dos

---

## 🏛️ Cómo lo hacen los grandes (y qué copiar, qué no)

> Referencia escrita el 23-ago-2026. **Nada de esta sección está construido.**
> Sirve para no volver a derivar el modelo desde cero cuando toque la Etapa 2.

Toast, Square for Restaurants, Lightspeed, Sunday y Bbot llegaron **al mismo
modelo de tres capas**, y ninguna de las tres es "el pedido":

| Capa | Qué es | Quién la ve |
|---|---|---|
| **Party / sesión de mesa** | quiénes están sentados, cuándo abre y cierra | nadie, es interna |
| **Check (la cuenta)** | el objeto de **dinero**: total, cuánto se pagó, versión | mesero y quien paga |
| **Rounds / comandas** | lo que se manda a cocina, ronda por ronda | la cocina |

**La lección principal: la cuenta es un documento propio, no "el primer pedido de
la mesa".** Los pedidos cuelgan de ella, nunca al revés.

### El truco de verdad: no se divide la cuenta, se divide el PAGO

El instinto es partir la cuenta en 4 cuentas. Los grandes **no** hacen eso. La
cuenta sigue siendo **una**, y encima caen **pagos parciales**:

```
Cuenta mesa 5:  total $840  ·  pagado $210  ·  falta $630
  └─ pago de Ana  $210 ✅
```

La cuenta **se cierra sola cuando el saldo llega a cero**. No importa si pagaron
1, 4 o 7 personas, ni si uno pagó por dos. Eso resuelve gratis los casos que en
el modelo "4 cuentas separadas" son un infierno:

- **Alguien se va temprano** → paga lo suyo, la mesa sigue abierta
- **"Yo invito la mitad"** → un pago de $420, sin acomodar platillos
- **La botana compartida** → se reparte entre los que faltan por pagar
- **Propina** → va por pago, no por cuenta (cada quien la suya)

### Los tres detalles que separan lo que funciona de lo que se rompe

1. **Bloquear la cuenta cuando cae el primer pago.** Si Ana ya pagó $210 y luego
   alguien pide otra ronda, el total cambió **después** de que ella pagó. O se
   congela la cuenta, o se vuelve a cotizar. Sin esto hay descuadres de dinero
   reales.
2. **Llave de idempotencia por pago.** Doble tap = un solo cargo. No opcional.
3. **Versión en la cuenta (concurrencia optimista).** Dos personas pagando al
   mismo tiempo desde su teléfono es el caso **normal**, no el raro. Sin
   versión, los dos leen "falta $630" y pagan de más.

### Qué NO copiar

**Sunday vale casi solo por integrarse con el POS ajeno** — su moat entero es
leer la cuenta de un Toast o un Lightspeed. **Comeleal ES el POS.** Ese problema
no existe aquí; se salta completo.

### 🎁 Dónde Comeleal ya va adelante

> Toast cierra la mesa 5 y conoce **al que pagó**. Los otros 3 son fantasmas.
> Comeleal ya tiene **los 4 teléfonos**, cada uno amarrado a lo que ESA persona
> pidió.

No es una feature, es una diferencia de categoría. Un POS captura clientes como
**efecto secundario** de cobrar. Aquí se capturan **porque la lealtad es el
producto**, y la identidad es el punto de entrada, no un opcional al final.

### Orden recomendado — dos etapas, no una

- **Etapa 1 — `tabId`** (diseñada arriba, en "EL PENDIENTE"): una fila por mesa
  en la Caja, el mesero deja de sumar tickets, puntos a los N teléfonos. Barato,
  sin colección nueva, **sin tocar dinero**.
- **Etapa 2 — la cuenta como documento con saldo y pagos parciales**: el modelo
  de los grandes completo. Aquí es donde cada quien paga desde su teléfono.

**La Etapa 2 toca dinero de verdad** (concurrencia, idempotencia, descuadres).
No construirla hasta que un cliente real la pida — hoy ni Sushin-Gón ni Luzz la
necesitan. Está en la lista `DO-NOT-BUILD` de `FOODPASS/docs/PENDIENTES.md` a
propósito.
