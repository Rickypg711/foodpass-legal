// lib/slug.ts
//
// Slugs públicos de restaurante: comeleal.com/r/luzz-pizza (canónico) y
// comeleal.com/luzz-pizza (alias raíz que redirige). El ID de Firestore
// sigue funcionando PARA SIEMPRE — los QR impresos jamás se rompen; el slug
// es la cara bonita para statuses, bios y decirlo en voz alta.
//
// Reglas (aprendidas del bug de Facebook que minusculaba URLs):
// - slugs SIEMPRE en minúsculas, sin acentos, con guiones
// - se comparan case-insensitive
// - nunca chocan con rutas propias del sitio (RESERVED_SLUGS)

/** Rutas raíz del sitio + palabras que jamás puede reclamar un restaurante.
 *  Cubre páginas actuales Y nombres que probablemente usemos en el futuro. */
export const RESERVED_SLUGS = new Set([
  // rutas actuales
  "menu", "vendor", "activar", "descargar", "precios", "puntos", "api", "r",
  "para-restaurantes", "clientes-que-regresan", "como-vender-mas-en-mi-restaurante",
  "inteligencia-artificial-para-restaurantes", "lealtad-restaurantes-chihuahua",
  "menu-qr-gratis-restaurantes", "pedidos-en-linea-restaurantes",
  "pedidos-whatsapp-restaurantes", "programa-de-lealtad-para-restaurantes",
  "punto-de-venta-gratis-restaurantes", "tarjeta-de-lealtad-digital",
  // archivos/técnicos
  "sitemap.xml", "robots.txt", "favicon.ico", "download.html", "_next",
  // futuro probable
  "blog", "ayuda", "soporte", "app", "admin", "login", "signup", "registro",
  "restaurantes", "restaurante", "terminos", "privacidad", "contacto",
  "nosotros", "docs", "static", "assets", "img", "images",
]);

/** "Pecado Escondido" → "pecado-escondido". "" si no queda nada usable. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos fuera (ñ→n incluida vía NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** ¿Es un slug válido y no reservado? (para validar antes de guardar) */
export function isUsableSlug(slug: string): boolean {
  if (!slug || slug.length < 3) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

/** Lee el slug del doc del restaurante (null si no tiene o es inválido). */
export function slugFromRestaurantData(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const s = data.slug;
  if (typeof s !== "string") return null;
  const clean = s.trim().toLowerCase();
  return isUsableSlug(clean) ? clean : null;
}
