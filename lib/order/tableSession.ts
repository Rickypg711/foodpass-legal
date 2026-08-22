/**
 * MESA — el pedido desde la mesa con QR numerado.
 *
 * Robo del teardown de Maspedidos (6 ago 2026): ellos generan un QR por mesa
 * para que el comensal ordene solo. Nosotros ya teníamos menú QR y pago en
 * línea, pero el menú era a nivel restaurante: cuando llegaba el pedido nadie
 * sabía a QUÉ MESA llevarlo. Esto lo cierra.
 *
 * CÓMO FUNCIONA: el QR de cada mesa apunta a /menu/{restaurantId}?mesa=5.
 * Al abrirlo se guarda la mesa en sessionStorage y todo el flujo (menú →
 * carrito → checkout → orden) la arrastra. La orden sale con
 * `orderType: "dine_in"` y `tableNumber: "5"`, y la cocina y la caja ven a
 * dónde va.
 *
 * POR QUÉ sessionStorage y no la URL todo el camino: el comensal navega,
 * comparte el link, se le cierra la pestaña. La sesión sobrevive esos brincos
 * y muere al cerrar el navegador — que es exactamente lo que quieres: la mesa
 * no debe seguirlo a su casa.
 */

const KEY_PREFIX = "comeleal_mesa_v1_";

/** Parámetros aceptados en el QR. `mesa` es el nuestro; `table` por si acaso. */
export const TABLE_QUERY_PARAMS = ["mesa", "table"] as const;

/** Máximo de caracteres de una mesa. Cabe "Terraza 12" y no cabe un ataque. */
export const TABLE_MAX_LENGTH = 12;

/**
 * Normaliza lo que venga en el QR. Permite letras y números porque en la vida
 * real las mesas se llaman "Barra", "T3" o "Terraza 2" — no siempre son un
 * número. Devuelve "" cuando no hay mesa válida.
 */
export function normalizeTableNumber(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s#-]/gu, "") // fuera todo lo raro; deja letras/números/espacio/#/-
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TABLE_MAX_LENGTH);
  return cleaned;
}

/** Número de comensales. Devuelve null si no es un entero razonable. */
export function normalizeDiners(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1 || i > 50) return null;
  return i;
}

function storageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

/** Lee la mesa guardada de esta sesión (sin tocar la URL). */
export function readStoredTable(restaurantId: string): string {
  if (typeof window === "undefined" || !restaurantId) return "";
  try {
    return normalizeTableNumber(
      window.sessionStorage.getItem(storageKey(restaurantId)),
    );
  } catch {
    return "";
  }
}

export function storeTable(restaurantId: string, table: string): void {
  if (typeof window === "undefined" || !restaurantId) return;
  const value = normalizeTableNumber(table);
  try {
    if (value) {
      window.sessionStorage.setItem(storageKey(restaurantId), value);
    } else {
      window.sessionStorage.removeItem(storageKey(restaurantId));
    }
  } catch {
    /* modo privado / storage lleno — la mesa simplemente no persiste */
  }
}

export function clearTable(restaurantId: string): void {
  storeTable(restaurantId, "");
}

/**
 * Resuelve la mesa de esta visita: primero lo que venga en el QR (?mesa=),
 * y si no, lo que ya estaba guardado. Si viene en el QR, lo persiste.
 *
 * Llamar desde un efecto de cliente (usa window).
 */
export function resolveTableFromLocation(
  restaurantId: string,
  search?: string,
): string {
  if (typeof window === "undefined" || !restaurantId) return "";
  const params = new URLSearchParams(search ?? window.location.search);
  for (const key of TABLE_QUERY_PARAMS) {
    const fromUrl = normalizeTableNumber(params.get(key));
    if (fromUrl) {
      storeTable(restaurantId, fromUrl);
      return fromUrl;
    }
  }
  return readStoredTable(restaurantId);
}

/**
 * "Mesa 5" cuando es numero; "Barra" tal cual cuando trae letras.
 * "Mesa Barra" se lee mal. Lo usan la hoja de QR y Pedidos — una sola regla.
 */
export function tableLabel(mesa: string): string {
  return /^[0-9]+$/.test(mesa) ? `Mesa ${mesa}` : mesa;
}

/** El link que va en el QR impreso de cada mesa. */
export function tableMenuUrl(
  origin: string,
  restaurantId: string,
  table: string,
): string {
  const t = normalizeTableNumber(table);
  const base = `${origin.replace(/\/$/, "")}/menu/${restaurantId}`;
  return t ? `${base}?mesa=${encodeURIComponent(t)}` : base;
}
