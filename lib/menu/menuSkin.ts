/**
 * Piel del menú público por restaurante (10-sep-2026).
 *
 * POR QUÉ EXISTE: Café de la Tercera tiene un menú de papel con diseño propio
 * (salmón, rojo, verde pixel, ilustraciones a línea). Ricardo quiso que su
 * menú en Comeleal se viera como SU papel — mismo motor (menú, carrito,
 * pedidos, SEO), otro cuerpo. Es el primer "menú a la medida"; se regala a
 * Tercera para cobrarlo después a otros.
 *
 * El doc del local lo prende: `restaurants/{id}.menuSkin = "tercera"`.
 * Sin el campo (o con basura) → la piel de siempre, byte por byte.
 * Solo web: la app pinta el menú de siempre (paridad-app-web: decisión
 * consciente, el QR abre la web).
 *
 * Pieles vivas:
 *  - "tercera": Café de la Tercera (components/menu/skins/tercera.tsx).
 *  - "pecado": Pecado Escondido, Puerto Escondido — su carta roja con papel
 *    crema e iconos a línea (components/menu/skins/pecado.tsx). Segunda piel;
 *    la regla sigue: piel en código hasta el 3er local, luego "tema" en el doc.
 */
export type MenuSkinId = "tercera" | "pecado";

export const MENU_SKIN_FIELD = "menuSkin";

const KNOWN: readonly string[] = ["tercera", "pecado"];

export function menuSkinFromRestaurant(
  raw: Record<string, unknown> | null | undefined,
): MenuSkinId | null {
  const v = raw?.[MENU_SKIN_FIELD];
  return typeof v === "string" && KNOWN.includes(v) ? (v as MenuSkinId) : null;
}
