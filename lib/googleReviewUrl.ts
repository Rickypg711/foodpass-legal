// lib/googleReviewUrl.ts
//
// El "momento reseña" en la web: el recibo con puntos acreditados ofrece dejar
// reseña de Google. Solo aceptamos ligas que de verdad van a Google — el dueño
// captura restaurants/{id}.googleReviewUrl a mano y un typo mandaría al
// cliente a cualquier lado.
//
// ESPEJO de la validación en `lib/services/google_review_ask_service.dart`
// (app Flutter). Si tocas uno, toca el otro.

export function isGoogleReviewUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const v = url.trim();
  if (!v) return false;
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return (
    host === "g.page" ||
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "search.google.com" ||
    host === "g.co" ||
    host === "maps.google.com" ||
    host === "www.google.com" ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host.endsWith(".google.com.mx")
  );
}
