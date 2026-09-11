/**
 * El reloj de Pedidos — contrato (web ↔ app).
 *
 * POR QUE EXISTE (10-sep-2026, La Familia): las ventas de la Caja se quedaban
 * en "Pendientes" horas porque nadie tocaba Comenzar → Listo → Entregado.
 * Ricardo eligio: reloj en cada pedido (naranja a los 10 min, rojo y
 * parpadeando a los 20) y un aviso que suena cada 5 min mientras alguno pase
 * de 20 — en la web Y en la app, con los mismos numeros y las mismas palabras.
 * Ruby NO quiso "Entregado directo": el camino de siempre se queda. Este candado
 * lee el Dart para que web y app no se separen.
 *
 * Run: node scripts/validate-order-aging.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import {
  ORDER_WAIT_WARN_MINUTES,
  ORDER_WAIT_LATE_MINUTES,
  ORDER_REMINDER_EVERY_MINUTES,
  orderWaitingMinutes,
  orderWaitLevel,
  orderWaitLabel,
  isWaitingOrder,
  shouldRemindLateOrders,
  lateOrdersBanner,
} from "../lib/order/orderAging.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

const MIN = 60000;

// ── Los numeros que eligio Ricardo ──────────────────────────────────────────
check("naranja a los 10 min", ORDER_WAIT_WARN_MINUTES, 10);
check("rojo a los 20 min", ORDER_WAIT_LATE_MINUTES, 20);
check("suena cada 5 min", ORDER_REMINDER_EVERY_MINUTES, 5);

// ── Minutos ─────────────────────────────────────────────────────────────────
check("minutos completos", orderWaitingMinutes(0, 12 * MIN + 59000), 12);
check("reloj adelantado => 0, nunca negativo", orderWaitingMinutes(5 * MIN, 0), 0);
check("basura => 0", orderWaitingMinutes(NaN, 1), 0);

// ── Colores ─────────────────────────────────────────────────────────────────
check("9 min => ok", orderWaitLevel(9), "ok");
check("10 min => naranja", orderWaitLevel(10), "warn");
check("19 min => naranja", orderWaitLevel(19), "warn");
check("20 min => rojo", orderWaitLevel(20), "late");

// ── Lo que dice la tarjeta ──────────────────────────────────────────────────
check("recien llegado", orderWaitLabel(0), "Ahora");
check("3 min", orderWaitLabel(3), "Hace 3 min");
check("12 min (naranja, sin regaño)", orderWaitLabel(12), "Hace 12 min");
check("25 min (rojo, pregunta)", orderWaitLabel(25), "Lleva 25 min · ¿ya lo entregaste?");
check("59 min", orderWaitLabel(59), "Lleva 59 min · ¿ya lo entregaste?");
check("60 min => en horas", orderWaitLabel(60), "Lleva 1 h · ¿ya lo entregaste?");
check("65 min", orderWaitLabel(65), "Lleva 1 h 5 min · ¿ya lo entregaste?");

// ── Que cuenta como "esperando" ─────────────────────────────────────────────
check("pendiente cuenta", isWaitingOrder({ status: "pending" }), true);
check("en cocina cuenta", isWaitingOrder({ status: "preparing" }), true);
check("listo cuenta", isWaitingOrder({ status: "ready" }), true);
check("entregado NO", isWaitingOrder({ status: "completed" }), false);
check("cancelado NO", isWaitingOrder({ status: "cancelled" }), false);
check("cuenta abierta NO (la mesa sigue abierta a proposito)", isWaitingOrder({ status: "pending", isOpenTab: true }), false);
check("status open_tab NO", isWaitingOrder({ status: "open_tab" }), false);

// ── Cada cuanto suena ───────────────────────────────────────────────────────
check("nada en rojo => no suena", shouldRemindLateOrders({ lateCount: 0, lastRemindAtMs: null, nowMs: 0 }), false);
check("primer rojo => suena", shouldRemindLateOrders({ lateCount: 1, lastRemindAtMs: null, nowMs: 0 }), true);
check("4:59 despues => todavia no", shouldRemindLateOrders({ lateCount: 2, lastRemindAtMs: 0, nowMs: 5 * MIN - 1000 }), false);
check("5:00 despues => otra vez", shouldRemindLateOrders({ lateCount: 2, lastRemindAtMs: 0, nowMs: 5 * MIN }), true);

// ── El letrero ──────────────────────────────────────────────────────────────
check("letrero singular", lateOrdersBanner(1), "1 pedido lleva más de 20 min — ¿ya lo entregaste?");
check("letrero plural", lateOrdersBanner(4), "4 pedidos llevan más de 20 min — ¿ya los entregaste?");

// ── La pantalla de Pedidos lo usa de verdad ─────────────────────────────────
const page = readFileSync(new URL("../app/vendor/pedidos/page.tsx", import.meta.url), "utf8");
check("cada tarjeta dice cuánto lleva", page.includes("orderWaitLabel("), true);
check("la tarjeta en rojo parpadea", page.includes("animate-pulse"), true);
check("el aviso respeta los 5 min", page.includes("shouldRemindLateOrders("), true);
check("el aviso suena con la campana de siempre", page.includes("playNewOrderChime()"), true);
check("la pestaña avisa aunque estén en otra", page.includes('flashTabTitle("⏰ Pedido esperando")'), true);
check("notificación de la compu cuando la pestaña está escondida", page.includes('new Notification("Pedidos esperando"'), true);
check("hay botón para callar el aviso (por dispositivo)", page.includes("pedidosAvisoSilenciado"), true);
check("SIN 'Entregado directo' (Ruby dijo que no)", page.includes("canDeliverDirect"), false);

// ── Espejo en la app (lee el Dart) ──────────────────────────────────────────
const APP = "/Users/ricardoparedes/projects/FOODPASS";
const DART = `${APP}/lib/orders/order_aging.dart`;
if (existsSync(`${APP}/pubspec.yaml`)) {
  check("la app tiene el espejo lib/orders/order_aging.dart", existsSync(DART), true);
  if (existsSync(DART)) {
    const d = readFileSync(DART, "utf8");
    const n = (name) => Number(d.match(new RegExp(`const int ${name} = (\\d+);`))?.[1]);
    check("app: naranja a los mismos minutos", n("kOrderWaitWarnMinutes"), ORDER_WAIT_WARN_MINUTES);
    check("app: rojo a los mismos minutos", n("kOrderWaitLateMinutes"), ORDER_WAIT_LATE_MINUTES);
    check("app: suena cada los mismos minutos", n("kOrderReminderEveryMinutes"), ORDER_REMINDER_EVERY_MINUTES);
    check("app: mismas palabras ('Ahora')", d.includes("'Ahora'"), true);
    check("app: mismas palabras ('¿ya lo entregaste?')", d.includes("¿ya lo entregaste?"), true);
    check("app: SIN 'Entregado directo'", d.includes("canDeliverDirect"), false);
  }
}

if (failed) process.exit(1);
console.log("validate-order-aging: OK");
