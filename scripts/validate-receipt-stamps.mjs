#!/usr/bin/env node
// Candado (18-sep-2026): stamps del recibo — paso 1 de docs/REFERIDOS_POR_TELEFONO.md
// (FOODPASS). Antes de construir el referido hay que VER el canal: ventas con
// teléfono → recibos tocados → páginas abiertas. Este candado cuida que:
//   1. el molde de campos sea el mismo para tap y vista (primera vez fija,
//      última vez y conteo se mueven) — la app escribe el mismo molde;
//   2. los dos botones de recibo (Pedidos y Caja web) marquen el tap SIN
//      esperar (el window.open del wa.me va primero);
//   3. la página del pedido marque "visto" solo tras render (IntersectionObserver),
//      nunca para el dueño/equipo, una vez por carga;
//   4. el POST valide ids, solo toque pedidos con recibo público y no regrese datos.
// Run: node scripts/validate-receipt-stamps.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { receiptStampFields } from "../lib/order/receiptStamps.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// ── 1. El molde ──────────────────────────────────────────────────────────────
assert.deepEqual(
  receiptStampFields("receiptTapped", undefined, "NOW", "INC", "web"),
  { receiptTappedAt: "NOW", receiptTappedLastAt: "NOW", receiptTappedCount: "INC", receiptTapSource: "web" },
  "primer tap: fija receiptTappedAt + última + conteo + fuente",
);
assert.deepEqual(
  receiptStampFields("receiptTapped", { receiptTappedAt: "ANTES" }, "NOW", "INC", "app"),
  { receiptTappedLastAt: "NOW", receiptTappedCount: "INC", receiptTapSource: "app" },
  "segundo tap: NO toca receiptTappedAt (la primera vez es la primera vez)",
);
assert.deepEqual(
  receiptStampFields("viewed", {}, "NOW", "INC"),
  { viewedAt: "NOW", viewedLastAt: "NOW", viewedCount: "INC" },
  "primera vista: viewedAt + última + conteo, sin fuente",
);
assert.deepEqual(
  receiptStampFields("viewed", { viewedAt: "ANTES" }, "NOW", "INC", "web"),
  { viewedLastAt: "NOW", viewedCount: "INC" },
  "vista repetida: no toca viewedAt ni escribe fuente",
);

// ── 2. Los dos botones de recibo marcan el tap ───────────────────────────────
const pedidos = read("../app/vendor/pedidos/page.tsx");
assert.ok(pedidos.includes('import { markReceiptTapped } from "@/lib/order/receiptStamps";'), "Pedidos importa markReceiptTapped");
const pedidosOpen = pedidos.indexOf('"noopener,noreferrer",\n    );\n    // Stamp del embudo del recibo');
assert.ok(pedidosOpen > 0, "Pedidos: el stamp va DESPUÉS del window.open (el popup no espera)");
assert.ok(pedidos.includes("void markReceiptTapped(getFirebaseDb(), restaurantId, order.id);"), "Pedidos: stamp sin await");

const pos = read("../app/vendor/pos/page.tsx");
assert.ok(pos.includes('import { markReceiptTapped } from "@/lib/order/receiptStamps";'), "Caja importa markReceiptTapped");
assert.ok(pos.includes('window.open(receiptUrl, "_blank", "noopener,noreferrer");\n                // Stamp del embudo del recibo (docs/REFERIDOS_POR_TELEFONO.md §10).\n                onReceiptTapped?.();'), "Caja: onReceiptTapped después del window.open");
assert.ok(pos.includes("orderId: orderRef.id });"), "Caja: el éxito guarda el orderId para el stamp");
assert.ok(pos.includes("if (restaurantId && success.orderId) void markReceiptTapped(getFirebaseDb(), restaurantId, success.orderId);"), "Caja: stamp con restaurantId + orderId, sin await");

// ── 3. La página marca "visto" solo tras render y nunca para el local ────────
const page = read("../app/menu/[restaurantId]/order/[orderId]/page.tsx");
assert.ok(page.includes("new IntersectionObserver("), "página: visto = bloque dibujado (IntersectionObserver), no fetch del servidor");
assert.ok(page.includes("if (!order || !viewerResolved || viewerIsStaff || viewStampSentRef.current) return;"), "página: no marca sin pedido, sin saber quién mira, ni para dueño/equipo, ni dos veces");
assert.ok(page.includes("ref={receiptCardRef}"), "página: el observer mira la tarjeta del pedido");
assert.ok(page.includes("fetch(RECEIPT_VIEWED_ENDPOINT, {") && page.includes('method: "POST"'), "página: POST al endpoint de visto");
assert.ok(page.includes("keepalive: true"), "página: keepalive (el comensal cierra rápido)");
assert.ok(page.includes(".catch(() => { /* medir jamás rompe el recibo */ })"), "página: medir jamás rompe el recibo");

// ── 4. El POST ───────────────────────────────────────────────────────────────
const route = read("../app/api/order-receipt/viewed/route.ts");
assert.ok(route.includes("const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;"), "POST: mismo filtro de ids que el GET");
assert.ok(route.includes("if (!receiptViewFromOrder(snap.data(), undefined)) return;"), "POST: solo pedidos con recibo público (Caja y menú web)");
assert.ok(route.includes('receiptStampFields("viewed", snap.data(), FieldValue.serverTimestamp(), FieldValue.increment(1))'), "POST: mismo molde, servidor fija la primera vez");
assert.ok(route.includes("return new NextResponse(null, { status: 204"), "POST: no regresa datos del pedido");
assert.ok(!route.includes("NextResponse.json({ order"), "POST: jamás regresa el pedido");

// ── Allowlist: los stamps NO salen por el recibo público ─────────────────────
const view = read("../lib/order/receiptView.ts");
for (const k of ["receiptTappedAt", "viewedAt", "viewedCount", "receiptTapSource"]) {
  assert.ok(!view.includes(k), `receiptView: '${k}' no está en la allowlist (no se filtra al comensal)`);
}

console.log("validate-receipt-stamps: OK");
