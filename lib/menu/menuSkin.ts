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
 *  - "negroblanco": Negro Blanco Café, Chihuahua — negro y blanco, sus tres
 *    puntos, su pegboard y su arte a línea (components/menu/skins/negroblanco.tsx).
 *    Tercera piel = la última en código; la siguiente ya es "tema" en el doc.
 *  - "blooms": Blooms Coffee & Mocktails, Chihuahua — rubor de acuarela, su franja rosa, títulos mitad rosa y
 *    sus acuarelas de platillos (components/menu/skins/blooms.tsx). Cuarta piel en código por pedido de Ricardo
 *    (10-sep): la regla del "tema" en el doc queda pendiente para la quinta.
 */
export type MenuSkinId = "tercera" | "pecado" | "negroblanco" | "blooms";

export const MENU_SKIN_FIELD = "menuSkin";

const KNOWN: readonly string[] = ["tercera", "pecado", "negroblanco", "blooms"];

export function menuSkinFromRestaurant(
  raw: Record<string, unknown> | null | undefined,
): MenuSkinId | null {
  const v = raw?.[MENU_SKIN_FIELD];
  return typeof v === "string" && KNOWN.includes(v) ? (v as MenuSkinId) : null;
}
