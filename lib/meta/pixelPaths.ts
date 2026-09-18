/**
 * ¿Esta ruta debe hablar con Meta? (17-sep-2026)
 * El panel del dueño (/vendor/…) es uso diario: Caja, pedidos, reportes. Cada
 * PageView de ahí es un dueño YA convertido usando la herramienta, no un
 * prospecto — ensucia audiencias y "visitantes del sitio". El wizard de alta
 * (/vendor/setup/…) sí es embudo y ahí se queda.
 */
export function pixelAllowedOnPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/vendor/setup")) return true;
  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) return false;
  return true;
}

