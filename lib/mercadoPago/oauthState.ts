// OAuth `state` de Mercado Pago — MISMO contrato que la app.
//
// La app lo define en FOODPASS `lib/mercado_pago/mercado_pago_oauth_state.dart`:
// base64url(JSON) sin padding, con `r` = restaurantId y `n` = nonce.
//
// La web agrega una tercera llave, `p: "web"`, para que la página de callback
// sepa a dónde mandar el código. El decodificador de Dart lee solo `r` y `n` e
// ignora lo demás, así que agregarla NO rompe el flujo de la app — cosa que
// importa porque Mercado Pago devuelve a UNA sola redirect_uri registrada y las
// dos plataformas tienen que compartirla.

export type MercadoPagoOAuthState = {
  restaurantId: string;
  nonce: string;
  platform: "web" | "app";
};

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** `state` para un connect iniciado desde el panel web. */
export function encodeWebOAuthState(restaurantId: string, nonce: string): string {
  const rid = restaurantId.trim();
  if (!rid) throw new Error("restaurantId required");
  return toBase64Url(JSON.stringify({ r: rid, n: nonce, p: "web" }));
}

/** Devuelve null si falta o viene corrupto — nunca lanza. */
export function decodeOAuthState(raw: string | null | undefined): MercadoPagoOAuthState | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as Record<string, unknown>;
    const restaurantId = typeof parsed.r === "string" ? parsed.r.trim() : "";
    const nonce = typeof parsed.n === "string" ? parsed.n : "";
    if (!restaurantId) return null;
    return {
      restaurantId,
      nonce,
      platform: parsed.p === "web" ? "web" : "app",
    };
  } catch {
    return null;
  }
}
