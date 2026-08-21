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
