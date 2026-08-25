// Cuenta de mesa Etapa 1 — la mitad VISIBLE: agrupar en la Caja.
// Diseño: docs/PEDIDO_EN_MESA.md → "EL PENDIENTE". Espejo Dart:
// FOODPASS lib/pages/pos/tab_groups.dart (paridad vigilada por
// validate-table-orders.mjs).
//
// Agrupar, NO fusionar: cada ronda sigue siendo su propio pedido (la cocina
// ya lo ve así); la Caja suma por `tabId` y enseña UNA fila:
// "Mesa 5 · 3 personas · $840".

export type TabOrderLike = {
  id: string;
  tabId?: unknown;
  tabName?: unknown;
  customerName?: unknown;
  customerId?: unknown;
  customerPhone?: unknown;
  total?: unknown;
  items?: unknown;
  createdAt?: unknown;
};

export type TabGroup<T extends TabOrderLike> = {
  /** Llave del grupo: tabId, o el propio id si la cuenta es pre-tabId. */
  key: string;
  /** La cuenta MÁS VIEJA del grupo — la que "fundó" la mesa. El cobro, la
   * propina y el teléfono del cierre se anclan aquí. */
  anchor: T;
  /** Todas las rondas, de la más vieja a la más nueva. */
  orders: T[];
  /** Personas = comensales distintos (customerId únicos; sin id, cada ronda
   * cuenta como una persona). Es el número del remate: cada quien dejó SU
   * teléfono. */
  people: number;
  /** Suma de los totales de las rondas (netos actuales). */
  total: number;
  label: string;
};

function toMillis(v: unknown): number {
  if (v && typeof (v as { toMillis?: unknown }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (v instanceof Date) return v.getTime();
  return 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Agrupa las cuentas abiertas por tabId. Una cuenta legada sin tabId agrupa
 * bajo su propio id — que es EXACTAMENTE la llave que la callable
 * `resolveTableTab` reparte a las rondas nuevas de esa mesa, así que las
 * rondas post-deploy se cuelgan del grupo de la cuenta vieja solas.
 * Grupos ordenados por actividad más reciente (como estaba la lista).
 */
export function groupOpenTabs<T extends TabOrderLike>(orders: T[]): TabGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const o of orders) {
    // Defensa de dinero: una ronda ya PAGADA no es "por cobrar" — no entra al
    // grupo ni a su total, aunque un doc legado traiga isOpenTab colgado.
    if (String((o as {paymentStatus?: unknown}).paymentStatus || "") === "paid") continue;
    const key = str(o.tabId) || o.id;
    const list = byKey.get(key);
    if (list) list.push(o);
    else byKey.set(key, [o]);
  }
  const groups: TabGroup<T>[] = [];
  for (const [key, list] of byKey.entries()) {
    list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const anchor = list[0];
    const ids = new Set<string>();
    let anonymous = 0;
    for (const o of list) {
      const cid = str(o.customerId);
      if (cid) ids.add(cid);
      else anonymous += 1;
    }
    const total = list.reduce(
      (sum, o) => sum + (typeof o.total === "number" ? o.total : 0),
      0,
    );
    groups.push({
      key,
      anchor,
      orders: list,
      people: Math.max(1, ids.size + anonymous),
      total: Math.round(total * 100) / 100,
      label:
        str(anchor.tabName) ||
        str(anchor.customerName) ||
        `Cuenta #${anchor.id.slice(-4)}`,
    });
  }
  groups.sort(
    (a, b) =>
      toMillis(b.orders[b.orders.length - 1].createdAt) -
      toMillis(a.orders[a.orders.length - 1].createdAt),
  );
  return groups;
}

/**
 * Reparte el NETO del cierre entre las rondas, proporcional a su bruto, en
 * centavos exactos: la suma de las partes ES el neto cobrado (el residuo del
 * redondeo cae en la última ronda). Los puntos de cada teléfono salen de su
 * parte — sobre lo pagado, nunca sobre lo tachado (regla anti-farming).
 */
export function distributeGroupNet(grossPerOrder: number[], net: number): number[] {
  const gross = grossPerOrder.map((g) => (Number.isFinite(g) && g > 0 ? g : 0));
  const grossSum = gross.reduce((a, b) => a + b, 0);
  const netCents = Math.round(net * 100);
  if (grossSum <= 0 || netCents <= 0) {
    return gross.map((_, i) => (i === gross.length - 1 ? Math.max(0, netCents) / 100 : 0));
  }
  const shares: number[] = [];
  let assigned = 0;
  for (let i = 0; i < gross.length; i++) {
    if (i === gross.length - 1) {
      shares.push((netCents - assigned) / 100);
    } else {
      const cents = Math.round((gross[i] / grossSum) * netCents);
      shares.push(cents / 100);
      assigned += cents;
    }
  }
  return shares;
}
