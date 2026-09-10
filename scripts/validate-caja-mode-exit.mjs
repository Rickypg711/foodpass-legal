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
console.log("✅ modo caja: hay salida en el celular");
