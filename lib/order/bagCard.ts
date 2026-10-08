// Tarjeta para la bolsa de Rappi/DiDi/Uber (app/vendor/bolsa). 8-oct-2026.
// Lo que dice y a dónde lleva el QR, en un solo lugar para que el candado lo lea.

export const BAG_CARD_COUNTS = [8, 16, 24] as const;

/** Menú del local por ID (el QR es carta, ver "Dos links: carta y portada") con utm_source=bolsa. */
export function bagCardUrl(siteUrl: string, restaurantId: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/menu/${encodeURIComponent(restaurantId)}?utm_source=bolsa&utm_medium=impreso`;
}

/** Sin premios prendidos la tarjeta no promete puntos (misma regla que las mesas). */
export function bagCardLines(loyaltyLive: boolean): { title: string; cta: string } {
  return {
    title: "La próxima, pídenos directo",
    cta: loyaltyLive ? "Escanea, pide y junta puntos ⭐" : "Escanea y pide desde tu teléfono",
  };
}
