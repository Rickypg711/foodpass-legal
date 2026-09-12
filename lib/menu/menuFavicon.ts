/**
 * Ícono de la pestaña (favicon) del menú y la portada de cada local (12-sep-2026, pedido de Ricardo).
 *
 * POR QUÉ: con la flama de Comeleal en todas las pestañas, el menú de IGO se sentía "de Comeleal", no suyo. Con su
 * ícono, la pestaña, los marcadores y el acceso directo que el comensal guarda en su pantalla de inicio llevan SU
 * marca. (Google sigue enseñando el ícono del dominio en sus resultados: eso es uno por sitio y no se toca.)
 *
 * Reglas, en orden:
 *  1. Local con piel → el ícono cuadrado que se armó de SU logo (public/skins/{piel}/icon.png).
 *  2. Sin piel → SOLO `logoUrl` subido a Storage (restaurant_pictures/). No `imageUrl`/`photoUrl` (suelen ser fotos
 *     de comida) ni el recorte que hace el demo de la foto del menú (menu_demos/): a 16 px se ven peor que la flama.
 *  3. Nada de eso → null = la flama de Comeleal de siempre.
 */
import { menuSkinFromRestaurant, type MenuSkinId } from "@/lib/menu/menuSkin";

const SKIN_ICON: Partial<Record<MenuSkinId, string>> = {
  igo: "/skins/igo/icon.png",
  mixteco: "/skins/mixteco/icon.png",
  blooms: "/skins/blooms/icon.png",
  laspic: "/skins/laspic/icon.png",
  pecado: "/skins/pecado/icon.png",
};

export function restaurantFaviconUrl(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const skin = menuSkinFromRestaurant(data);
  const skinIcon = skin ? SKIN_ICON[skin] : undefined;
  if (skinIcon) return skinIcon;
  const logo = typeof data.logoUrl === "string" ? data.logoUrl.trim() : "";
  if (!logo) return null;
  let path = logo;
  try {
    path = decodeURIComponent(logo);
  } catch {
    /* URL rara: se revisa tal cual */
  }
  return path.includes("/o/restaurant_pictures/") ? logo : null;
}
