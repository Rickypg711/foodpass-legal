// Tarjeta para tus pedidos de Rappi/DiDi/Uber (app/vendor/bolsa). 8-oct-2026.
// Lo que dice y a dónde lleva el QR, en un solo lugar para que el candado lo lea.
//
// 8-oct tarde (Ricardo: "¿y si no es bolsa, si es una caja?"): se llama "Tarjeta
// para tus pedidos" y viene en dos formatos: tarjeta (a la bolsa) y sticker
// redondo (a la caja de pizza, el vaso o el contenedor). La ruta y el utm siguen
// diciendo "bolsa" a propósito: lo ya impreso se sigue contando igual.

export const BAG_CARD_COUNTS = [8, 16, 24] as const;
/** Stickers: de hoja en hoja (12 por hoja), para no dejar media hoja de papel adhesivo en blanco. */
export const STICKER_COUNTS = [12, 24, 36] as const;
export const BAG_FORMATS = ["tarjeta", "sticker"] as const;
export type BagFormat = (typeof BAG_FORMATS)[number];

/** Cuántas salen por hoja carta en cada formato. */
export const PER_SHEET: Record<BagFormat, number> = { tarjeta: 8, sticker: 12 };

export const BAG_PAGE_TITLE = "Tarjeta para tus pedidos";
export const BAG_PAGE_CAPTION = "Métela en la bolsa, en la caja o pégala en el vaso de cada pedido de Rappi o DiDi";

/** Menú del local por ID (el QR es carta, ver "Dos links: carta y portada") con utm_source=bolsa. */
export function bagCardUrl(siteUrl: string, restaurantId: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/menu/${encodeURIComponent(restaurantId)}?utm_source=bolsa&utm_medium=impreso`;
}

/** Sin premios prendidos la tarjeta no promete puntos (misma regla que las mesas). */
export function bagCardLines(loyaltyLive: boolean): { title: string; cta: string; sticker: string; skinSub: string } {
  return {
    title: "La próxima, pídenos directo",
    cta: loyaltyLive ? "Escanea, pide y junta puntos ⭐" : "Escanea y pide desde tu teléfono",
    sticker: "Pídenos directo",
    // Con piel el botón ya dice "Escanea y pide": la línea de abajo no lo repite.
    skinSub: loyaltyLive ? "Desde tu teléfono, y juntas puntos ⭐" : "Desde tu teléfono",
  };
}

/** "3 escanearon tu tarjeta" / "1 pidió por ella". Cero = se dice tal cual, sin adornos. */
export function bagStatsLine(scans: number, orders: number): string {
  const s = scans === 1 ? "1 persona escaneó tu tarjeta" : `${scans} personas escanearon tu tarjeta`;
  const o = orders === 1 ? "1 pidió por ella" : `${orders} pidieron por ella`;
  return `${s} · ${o} en los últimos 30 días`;
}
