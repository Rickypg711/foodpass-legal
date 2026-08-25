// Cuenta de mesa Etapa 1 — el lado CLIENTE de resolveTableTab.
//
// El comensal no puede leer los pedidos de los demás (firestore.rules), así
// que le pregunta al servidor a qué cuenta de su mesa colgarse. Si no hay
// cuenta abierta (o el servidor no contesta), se funda una con una llave
// fresca — pedir la mesa NUNCA se bloquea por esto: en el peor caso la ronda
// abre su propia cuenta y la Caja la ve como fila aparte, que es exactamente
// el comportamiento de antes de tabId.
//
// Diseño completo: docs/PEDIDO_EN_MESA.md → "EL PENDIENTE".

import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

/** Llave fresca para fundar la cuenta de la mesa (opaca; solo agrupa). */
export function freshTabId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `tab_${rand}`;
}

/**
 * tabId de la cuenta abierta de la mesa en la jornada actual, o null si esta
 * ronda funda la cuenta. Best-effort con timeout corto: la red del local no
 * detiene la comanda.
 */
export async function resolveTableTabId(
  restaurantId: string,
  tableNumber: string,
): Promise<string | null> {
  try {
    const call = httpsCallable<
      { restaurantId: string; tableNumber: string },
      { tabId: string | null }
    >(getFirebaseFunctions(), "resolveTableTab");
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("resolve_table_tab_timeout")), 3500),
    );
    const result = await Promise.race([
      call({ restaurantId, tableNumber }),
      timeout,
    ]);
    const tabId = result.data?.tabId;
    return typeof tabId === "string" && tabId ? tabId : null;
  } catch {
    return null;
  }
}
