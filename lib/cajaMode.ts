// lib/cajaMode.ts
//
// Modo Caja (kiosk lock, estilo Square restricted mode): la tablet compartida
// queda BLOQUEADA a las páginas de operación (caja, pedidos, escanear).
// Salir del modo requiere el PIN de un Gerente del equipo de la caja.
//
// HONESTIDAD DEL MODELO: esto es una CORTINA, no un muro — el candado vive en
// localStorage del navegador (borrar datos del sitio lo quita, y la sesión
// del dueño sigue abierta detrás). Detiene curiosidad y dedazos — el caso
// real del mostrador. Para staff sin confianza, la respuesta correcta es
// loguear la tablet con una CUENTA de empleado (ahí el servidor manda).
// FAIL-OPEN: si el roster no carga o no hay gerentes, se permite salir —
// jamás dejamos al dueño fuera de su propio panel.

const KEY_PREFIX = "cajaMode:";

/** Rutas permitidas mientras el modo caja está activo. */
const CAJA_MODE_PREFIXES = ["/vendor/pos", "/vendor/pedidos", "/vendor/scanner"];

export function isPathAllowedInCajaMode(pathname: string): boolean {
  if (!pathname.startsWith("/vendor")) return true; // fuera del panel no opinamos
  return CAJA_MODE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isCajaModeLocked(restaurantId: string): boolean {
  try {
    return window.localStorage.getItem(KEY_PREFIX + restaurantId) === "1";
  } catch {
    return false;
  }
}

export function setCajaModeLocked(restaurantId: string, locked: boolean): void {
  try {
    if (locked) window.localStorage.setItem(KEY_PREFIX + restaurantId, "1");
    else window.localStorage.removeItem(KEY_PREFIX + restaurantId);
  } catch {
    /* storage bloqueado — el modo simplemente no persiste */
  }
  try {
    window.dispatchEvent(new Event("cajaModeChanged"));
  } catch {
    /* SSR/edge — sin listeners */
  }
}
