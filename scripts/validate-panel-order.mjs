#!/usr/bin/env node
// Candado (9-sep-2026): el Panel del dueño en la web va en los MISMOS 7
// bloques que la app (test/dashboard/owner_panel_order_test.dart en FOODPASS),
// en este orden — "lo diario arriba, luego el marcador, luego el consejo,
// luego lo de vez en cuando" (Ricardo, auditoría en simulador):
//
//   Header + TrialClock + brújula del setup
//   1 Hoy · 2 Ventas con teléfono · 3 Tu siguiente movimiento ·
//   4 Clientes · últimos 30 días · 5 Pregúntale a Comeleal · 6 Herramientas
//
// Fuera para siempre: "Requieren tu atención" como sección (es UNA línea
// dentro de Hoy), "Top productos" (vive en Reportes), "Acciones rápidas", la
// gráfica "Clientes Comeleal — últimos 7 días", "Actividad reciente",
// "Capturas el número", Recuperados y los Atajos. Si alguien los regresa o
// desordena los bloques, esto truena.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../app/vendor/page.tsx", import.meta.url), "utf8");

// Solo lo que ve el dueño: fuera comentarios JSX, de bloque y de línea.
const ownerFacing = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|\s)\/\/.*$/gm, "");

const jsxStart = raw.indexOf("<main className=");
const jsxEnd = raw.indexOf("</main>", jsxStart);
assert.ok(jsxStart > 0 && jsxEnd > jsxStart, "panel: <main> del panel");
const main = raw.slice(jsxStart, jsxEnd);

// 1. Los bloques van en orden dentro de <main>, cada uno UNA vez.
{
  const markers = [
    "<SetupBanner ",
    "<TodayCard",
    "<IdentifiedSalesCard ",
    "<AICoachPreviewCard",
    "<OwnerLookbackCard ",
    "<AskComelealCard ",
    "<ToolsGrid ",
  ];
  let cursor = -1;
  for (const m of markers) {
    const i = main.indexOf(m);
    assert.ok(i > cursor, `panel: ${m.trim()} fuera de orden o ausente`);
    cursor = i;
  }
  for (const m of markers) {
    assert.equal(main.split(m).length - 1, 1, `panel: ${m.trim()} duplicado`);
  }
  // Header y reloj de la prueba ANTES del contenido.
  const trial = raw.indexOf("<TrialClock");
  assert.ok(trial > 0 && trial < jsxStart, "panel: <TrialClock va antes de <main>");
}

// 2. Las tarjetas de números siguen escondidas el primer día; el consejo,
//    la pregunta y las herramientas se ven siempre.
{
  for (const card of ["<TodayCard", "<IdentifiedSalesCard ", "<OwnerLookbackCard "]) {
    const i = main.indexOf(card);
    assert.ok(main.slice(Math.max(0, i - 120), i).includes("{!firstDay &&"), `panel: ${card.trim()} sin gate de firstDay`);
  }
  for (const always of ["<AICoachPreviewCard", "<AskComelealCard ", "<ToolsGrid "]) {
    const i = main.indexOf(always);
    assert.ok(!main.slice(Math.max(0, i - 40), i).includes("firstDay"), `panel: ${always.trim()} no debe esconderse el primer día`);
  }
}

// 3. Hoy: la alerta de pedidos es UNA línea que lleva a Pedidos.
{
  const i = raw.indexOf("function TodayCard(");
  const block = raw.slice(i, raw.indexOf("function IdentifiedSalesCard(", i));
  assert.ok(block.includes("esperando · el más viejo ${formatOrderAge(oldestPendingMinutes)}"), "Hoy: copy '{n} pedidos esperando · el más viejo {edad}'");
  assert.ok(block.includes('<Link href="/vendor/pedidos"'), "Hoy: la alerta lleva a Pedidos");
  assert.ok(block.includes("Ver →"), "Hoy: 'Ver →'");
  assert.ok(block.includes(">Ticket promedio</p>"), "Hoy: ticket promedio");
  assert.ok(block.includes(">Pedidos en cola</p>") && block.includes(">Cuentas abiertas</p>"), "Hoy: pedidos en cola y cuentas abiertas");
  // Pedidos esperando = pending/preparing (jamás payment_pending); listos = ready.
  assert.ok(raw.includes('if (status === "pending" || status === "preparing") {'), "Hoy: esperando = pending/preparing");
  assert.ok(raw.includes('} else if (status === "ready") {'), "Hoy: listos sin entregar = ready");
}

// 4. Clientes · últimos 30 días: la MISMA regla que la app
//    (owner_lookback_service.dart): cada venta PAGADA con teléfono de 10
//    dígitos es una visita del cliente `phone:<últimos 10>`; 2+ = volvió.
{
  assert.ok(raw.includes('if (o.paymentStatus !== "paid") continue;'), "Clientes 30d: solo ventas pagadas");
  assert.ok(raw.includes("if (digits.length < 10) return null;"), "Clientes 30d: teléfono de 10 dígitos");
  assert.ok(raw.includes("return `phone:${digits.slice(-10)}`;"), "Clientes 30d: identidad = últimos 10 dígitos");
  assert.ok(raw.includes("addPhoneSaleVisits(visitCounts, monthOrders);"), "Clientes 30d: las ventas con número suman al mismo mapa que los escaneos");
  assert.ok(raw.includes("if (count >= 2) returnedCustomers++;"), "Clientes 30d: volvió = 2+ visitas");
  const i = raw.indexOf("function OwnerLookbackCard(");
  const block = raw.slice(i, raw.indexOf("function AskComelealCard(", i));
  for (const label of ['"Con teléfono"', '"Volvieron"', '"% que volvió"', '"Premios canjeados"']) {
    assert.ok(block.includes(`label: ${label}`), `Clientes 30d: métrica ${label}`);
  }
  assert.ok(block.includes("Clientes · últimos 30 días"), "Clientes 30d: título");
  assert.ok(block.includes("Cada venta con número suma aquí."), "Clientes 30d: pista sin promesa de puntos");
  assert.ok(block.includes('href="/vendor/clientes"') && />\s*Ver clientes\s*</.test(block), "Clientes 30d: 'Ver clientes' → Clientes");
  assert.ok(block.includes('href="/vendor/recompensas"') && />\s*Recompensas\s*</.test(block), "Clientes 30d: 'Recompensas'");
  assert.ok(!block.includes("/vendor/scanner") && !block.includes("/vendor/pos") && !block.includes("Cobrar con número"), "Clientes 30d: sin escáner ni 'Cobrar con número'");
  assert.ok(!/escane/i.test(block), "Clientes 30d: copy sin 'escanear'");
}

// 5. Pregúntale a Comeleal: compacto, campo + 2 preguntas, reusa Comeleal AI.
{
  const i = raw.indexOf("function AskComelealCard(");
  const block = raw.slice(i, raw.indexOf("function ToolsGrid(", i));
  assert.ok(block.includes("Pregúntale a Comeleal"), "Pregunta: título");
  assert.ok(block.includes("Responde con datos reales de tu negocio"), "Pregunta: subtítulo");
  assert.ok(block.includes("¿Qué debo hacer esta semana?") && block.includes("¿Cuáles son mis mejores clientes?"), "Pregunta: las 2 preguntas");
  assert.ok(block.includes("?q=${encodeURIComponent(clean)}"), "Pregunta: manda a Comeleal AI por ?q= (no es un chat nuevo)");
  assert.ok(!block.includes("httpsCallable") && !block.includes("queryRestaurantBrain"), "Pregunta: no llama al servidor por su cuenta");
}

// 6. Herramientas: 2×2 (4 en escritorio) Menú · Reportes · Equipo · Tu QR,
//    con "Ver mi menú" / "Ver mi página" en chico debajo.
{
  const i = raw.indexOf("function ToolsGrid(");
  const block = raw.slice(i);
  const order = ['label: "Menú", href: "/vendor/menu"', 'label: "Reportes", href: "/vendor/reportes"', 'label: "Equipo", href: "/vendor/configuracion#equipo"', 'label: "Tu QR"'];
  let cursor = -1;
  for (const m of order) {
    const j = block.indexOf(m);
    assert.ok(j > cursor, `Herramientas: ${m} fuera de orden o ausente`);
    cursor = j;
  }
  assert.ok(block.includes("grid-cols-2 gap-3 md:grid-cols-4"), "Herramientas: 2×2 / 4 en escritorio");
  assert.ok(block.includes('id="compartir-qr"'), "Herramientas: #compartir-qr sigue vivo (destino del consejo)");
  assert.ok(block.includes("<MenuShareModal"), "Herramientas: Tu QR abre el modal único de compartir");
  assert.ok(block.includes("Ver mi menú ↗") && block.includes("Ver mi página ↗"), "Herramientas: ligas chicas debajo");
  assert.ok(block.includes(">Herramientas<"), "Herramientas: título");
}

// 7. Fuera para siempre (texto que ve el dueño, no comentarios).
for (const gone of [
  "Top productos",
  "Acciones rápidas",
  "Clientes Comeleal — últimos 7 días",
  "Actividad reciente",
  "Requieren tu atención",
  "Lealtad — últimos 30 días",
  "Capturas el número",
  "Recuperación en marcha",
  "Escanear cliente",
  "Atajos",
  "Clientes Comeleal hoy",
]) {
  assert.ok(!ownerFacing.includes(gone), `panel: '${gone}' debía irse`);
}
for (const dead of ["WeekChart", "QrCard", "<Atajo ", "StatCard", "recentScans", "topProducts", "captureRate", "winbackSent", "expiringRewards"]) {
  assert.ok(!raw.includes(dead), `panel: código muerto '${dead}'`);
}
// Solo un "Nueva venta" por tamaño de pantalla: el del header (escritorio)
// y el CTA móvil bajo el header. Nada de "Acciones rápidas".
assert.equal(ownerFacing.split("Nueva venta").length - 1, 2, "panel: 'Nueva venta' solo en el header (escritorio + móvil)");
// Lecturas que se fueron con sus secciones.
for (const q of ['"reEngagementStats"', '"firstVisitRewardUnlocked"', '"lastWinbackAt"', 'doc(db, "users", uid)']) {
  assert.ok(!raw.includes(q), `panel: la lectura ${q} ya no hace falta`);
}
// visitHistory se lee UNA vez (30 días); de ahí salen hoy y Clientes.
assert.equal(raw.split('"visitHistory"').length - 1, 1, "panel: visitHistory se lee una sola vez");

// 8. Palabras prohibidas para el dueño: jamás "cerebro", jamás "carta".
assert.ok(!/cerebro/i.test(ownerFacing), "panel: 'cerebro' no es palabra de dueño");
assert.ok(!/\bcarta\b/i.test(ownerFacing), "panel: es 'menú', jamás 'carta'");

console.log("validate-panel-order: OK — 7 bloques en orden, sin secciones muertas");
