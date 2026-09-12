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
 *  - "mixteco": Mixteco, cocina mexicana, Chihuahua — su verde bosque y su crema, su frase partida en molde y
 *    cursiva, su jaguar, secciones verticales a dos columnas, sus fotos, salsas y guisos con sus iconos
 *    (components/menu/skins/mixteco.tsx). Quinta piel en código por pedido de Ricardo (11-sep); primera que usa
 *    todo el ancho en escritorio.
 *  - "laspic": LasPic, Pizza, Pasta & Fun, Chihuahua — su fachada (ajedrez negro/crema, "Las Pic" en serif rojo) y su
 *    menú de papel editorial (mascotas, franja de maridaje ▽ ○ □, dos columnas) (components/menu/skins/laspic.tsx).
 *    Sexta piel en código por pedido de Ricardo (11-sep).
 *  - "tortasperras": Pinches Tortas Perras, Guadalajara — sus tres hojas de Instagram: la portada roja con fibras
 *    ("Pásele joven / ¿Que va a Querer?") y el papel hueso moteado con los óvalos TORTAS y TACOS
 *    (components/menu/skins/tortasperras.tsx). Séptima piel en código por pedido de Ricardo (12-sep).
 *  - "igo": IGO Pizzeria, Guadalajara — sus hojas blancas con marco verde, el higo grabado, los títulos con las
 *    letras bailando, su ilustración por sección y la etiqueta verde del precio con la barra gris
 *    (components/menu/skins/igo.tsx). Octava piel en código por pedido de Ricardo (12-sep).
 */
export type MenuSkinId = "tercera" | "pecado" | "negroblanco" | "blooms" | "mixteco" | "laspic" | "tortasperras" | "igo";

export const MENU_SKIN_FIELD = "menuSkin";

const KNOWN: readonly string[] = ["tercera", "pecado", "negroblanco", "blooms", "mixteco", "laspic", "tortasperras", "igo"];

export function menuSkinFromRestaurant(
  raw: Record<string, unknown> | null | undefined,
): MenuSkinId | null {
  const v = raw?.[MENU_SKIN_FIELD];
  return typeof v === "string" && KNOWN.includes(v) ? (v as MenuSkinId) : null;
}
