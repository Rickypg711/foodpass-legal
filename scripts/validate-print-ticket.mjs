// 🖨️ Ticket para impresora térmica (10-sep-2026) — contrato.
//
// POR QUÉ EXISTE: Zahir (Central Fast Food, RD) tiene una Aokia de 80 mm con
// Bluetooth. El camino que sirve con CUALQUIER impresora ESC/POS es una hoja
// limpia que el navegador imprime (app puente en Android, USB en compu).
// Reglas:
//   1. /vendor/ticket vive SIN el layout del panel (lo impreso es solo el ticket).
//   2. El ticket trae lo que la cocina y el repartidor necesitan: a dónde va
//      (dirección / mesa / PIN), envío, total y cómo paga.
//   3. Hay botón en Pedidos y en el éxito de la Caja; Configuración elige el
//      ancho (58/80) y tiene ticket de prueba.
//   4. Bluetooth JAMÁS desde nuestro código: solo window.print().
//
// Run: node --experimental-strip-types scripts/validate-print-ticket.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TICKET_SAMPLE_ID, ticketPaperMm } from "../lib/pos/ticketPaper.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

assert.equal(ticketPaperMm({}), 80, "sin campo = 80 mm");
assert.equal(ticketPaperMm({ ticketPaperMm: 58 }), 58);
assert.equal(ticketPaperMm({ ticketPaperMm: "58" }), 58);
assert.equal(ticketPaperMm({ ticketPaperMm: 72 }), 80, "solo 58 u 80");
assert.equal(TICKET_SAMPLE_ID, "prueba");

const layout = read("app/vendor/layout.tsx");
assert.ok(/pathname\.startsWith\("\/vendor\/ticket"\)/.test(layout), "el ticket sale sin panel (layout bypass)");

const ticket = read("app/vendor/ticket/[orderId]/page.tsx");
assert.ok(ticket.includes("window.print()"), "imprime con el diálogo del navegador");
assert.ok(!/bluetooth|navigator\.usb|navigator\.serial/i.test(ticket.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), "nada de Bluetooth/USB desde nuestro código");
for (const must of ["A DOMICILIO", "order.deliveryAddress", "PARA LLEVAR", "PIN ", "Envío", "TOTAL", "@page { size: ${widthMm}mm auto", "ticketPaperMm(r)", "TICKET_SAMPLE_ID"]) {
  assert.ok(ticket.includes(must), `el ticket trae: ${must}`);
}

const pedidos = read("app/vendor/pedidos/page.tsx");
assert.ok(pedidos.includes("/vendor/ticket/${encodeURIComponent(order.id)}"), "Pedidos tiene el botón de imprimir");
const pos = read("app/vendor/pos/page.tsx");
assert.ok(pos.includes("ticketUrl: `/vendor/ticket/${encodeURIComponent(orderRef.id)}`"), "la Caja ofrece el ticket al cobrar");
assert.ok(pos.includes("if (receiptUrl || ticketUrl) return;"), "con ticket, el éxito no se cierra solo");
assert.ok(pos.includes("Enviar recibo por WhatsApp") && pos.includes("Imprimir ticket"), "WhatsApp y ticket conviven");

const config = read("app/vendor/configuracion/page.tsx");
assert.ok(config.includes("ticketPaperMm: paperMm"), "Configuración guarda el ancho");
assert.ok(config.includes("Imprimir ticket de prueba"), "Configuración tiene ticket de prueba");
assert.ok(config.includes("ESCPOS Bluetooth Print Service"), "Configuración explica la app puente");
console.log("✅ ticket impresora: contrato OK");
