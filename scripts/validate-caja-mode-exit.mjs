// 🔒 Modo Caja: SIEMPRE hay salida en el celular (10-sep-2026).
//
// POR QUÉ EXISTE: el botón "Salir de Modo Caja" vivía solo en la barra
// lateral de escritorio (hidden md:flex). Zahir (Central Fast Food) activó el
// candado en su teléfono y quedó encerrado en Caja/Pedidos: "no puedo quitar
// el seguro". Por eso no llegaba a Configuración. Reglas:
//   1. La hoja "Más" del nav móvil enseña "Salir de Modo Caja" cuando está
//      bloqueado y abre el MISMO diálogo (PIN de gerente, fail-open).
//   2. El candado 🔒 del header de la Caja es un botón que pide ese diálogo.
//   3. El layout escucha esa petición.
//
// Run: node scripts/validate-caja-mode-exit.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layout = readFileSync(join(root, "app/vendor/layout.tsx"), "utf8");
const pos = readFileSync(join(root, "app/vendor/pos/page.tsx"), "utf8");

const moreSheet = layout.slice(layout.indexOf('Hoja "Más"'));
assert.ok(moreSheet.includes("Salir de Modo Caja"), 'la hoja "Más" del celular tiene "Salir de Modo Caja"');
assert.ok(/cajaLocked && \(\s*<button[\s\S]*?setExitDialogOpen\(true\)/.test(moreSheet), "el botón móvil abre el diálogo de salida");
assert.ok(layout.includes('addEventListener("cajaModeExitRequested"'), "el layout escucha la petición de salir");
assert.ok(pos.includes('new Event("cajaModeExitRequested")'), "el candado de la Caja pide salir");
assert.ok(!pos.includes('title="Modo Caja activo — salir desde la barra lateral'), "el candado ya no manda a una barra lateral que el celular no tiene");

// ── 4. El candado solo se OFRECE cuando cierra de verdad ────────────────────
// Sin un Gerente activo con PIN, salir es un toque (fail-open): ofrecerlo es
// regalar un dedazo. Un dueño solo (un PIN de cajero) no ve el 🔓.
assert.ok(
  /posStaff\.some\(\(m\) => m\.active && m\.role === "gerente"\) && vendorRole !== "employee" && !cajaLocked && \(/.test(pos),
  "el 🔓 de la Caja exige un Gerente activo en el equipo",
);
assert.ok(!/posStaff\.length > 0 && vendorRole !== "employee" && !cajaLocked/.test(pos), "prohibido ofrecer el candado con cualquier PIN");
console.log("✅ modo caja: hay salida en el celular y solo se ofrece con gerente");
