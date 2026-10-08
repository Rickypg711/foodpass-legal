/**
 * Lazo 4 de los patrones (7-oct-2026): Pecado teclea "T1", "L2", "BARRA" en
 * el nombre del cliente en ~140 ventas al mes y cobra todo junto, sin cuenta
 * de mesa. En el MOMENTO en que el cajero teclea una mesa, la Caja ofrece
 * abrir la cuenta (memoria momento-caliente-antes-que-visita). Misma regla de
 * "parece mesa" que los reportes (TABLE_NAME_RE en lib/reports/salesPatterns).
 *
 * ESPEJO: FOODPASS lib/pos/table_name_hint.dart.
 */
import { TABLE_NAME_RE } from "../reports/salesPatterns.ts";

/** "T1", "m 2", "Mesa 4", "Barra" → true. "Juan" → false. */
export function looksLikeTable(name: string): boolean {
  return TABLE_NAME_RE.test(String(name ?? "").trim());
}

/** "¿Abrir cuenta de mesa T1?" (con la mesa tal cual la tecleó, en mayúsculas). */
export function tableTabPrompt(name: string): string {
  return `¿Abrir cuenta de mesa ${String(name ?? "").trim().toUpperCase()}?`;
}

export const TABLE_TAB_PROMPT_SUB = "Juntas las rondas y cobras una sola vez.";
