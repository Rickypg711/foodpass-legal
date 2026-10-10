// lib/order/checkoutReview.ts
//
// Las reglas del cierre del pedido del comensal (10-oct-2026). Módulo PURO,
// espejo de `lib/orders/checkout_review.dart` en la app (regla de paridad):
// qué se le puede decir del regalo de bienvenida sin mentir, y la cuenta de
// puntos cuando usa un premio.
//
// Nació de una prueba en el simulador: al cerrar un pedido se le prometía el
// regalo de bienvenida a un cliente que ya tenía 63 puntos en ese local.
// Candado: scripts/validate-checkout-review.mjs (mismos casos que
// FOODPASS test/orders/checkout_review_test.dart).

/** ¿Es su primera compra en ESTE local? Misma regla que usa el cobro para
 *  soltar la bienvenida (`isFirstVisit` en phonePoints.ts): sin cartera del
 *  teléfono, o con cartera en cero visitas. */
export type CheckoutStanding = "first" | "returning" | "unknown";

export function checkoutStanding(p: {
  /** La sesión está verificada para ese número (solo así se puede leer su cartera). */
  verified: boolean;
  /** La cartera se leyó (exista o no). */
  walletKnown: boolean;
  walletVisits: number;
}): CheckoutStanding {
  if (!p.verified || !p.walletKnown) return "unknown";
  return p.walletVisits > 0 ? "returning" : "first";
}

/** La frase del regalo de bienvenida que es verdad para este comensal, o null.
 *  A quien ya compró aquí nunca se le promete. */
export function checkoutWelcomeLine(
  welcomeRewardName: string | null | undefined,
  standing: CheckoutStanding,
): string | null {
  const name = (welcomeRewardName ?? "").trim();
  if (!name || standing === "returning") return null;
  return standing === "first"
    ? `Es tu primera compra aquí. Tu ${name} de bienvenida te espera en tu próxima visita`
    : `Si es tu primera compra aquí, tu ${name} de bienvenida te espera en tu próxima visita`;
}

/** La cuenta de puntos de este pedido, igual que al cobrar: primero suma lo
 *  ganado y luego descuenta el premio, solo si alcanza. */
export function checkoutPointsLedger(p: { balance: number; earn: number; spend: number }): {
  spendApplies: boolean;
  /** Lo que le queda cuando el local cobre. */
  after: number;
  /** Lo que le queda hoy si usa el premio, sin contar lo que va a juntar. */
  leftBeforeEarning: number;
} {
  const spendApplies = p.spend > 0 && p.balance + p.earn >= p.spend;
  return {
    spendApplies,
    after: p.balance + p.earn - (spendApplies ? p.spend : 0),
    leftBeforeEarning: Math.max(0, p.balance - p.spend),
  };
}

function pts(n: number): string {
  return n === 1 ? "1 punto" : `${n} puntos`;
}

/** "Mexicana con 50 puntos" — el premio elegido, dicho igual en app y web. */
export function redemptionLine(name: string, points: number): string {
  return `${name} con ${pts(points)}`;
}

/** "Te quedan 13 puntos." */
export function pointsLeftLine(left: number): string {
  return left === 1 ? "Te queda 1 punto." : `Te quedan ${left} puntos.`;
}

/** El 409 del precio en servidor (FOODPASS docs/PRECIO_EN_SERVIDOR_10_OCT.md). */
export const ORDER_NEEDS_REVIEW_CODE = "order_needs_review";

/** Falló pedir el cobro en línea. `code` es lo que contestó el servidor
 *  (`order_needs_review`, `restaurant_not_connected`…) o `network_error`. */
export class CheckoutPaymentError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "CheckoutPaymentError";
    this.code = code;
  }
}

/** Código que se mide en `checkout_error` (sin datos del cliente). */
export function checkoutErrorCode(err: unknown): string {
  if (!(err instanceof CheckoutPaymentError)) return "unknown";
  if (err.code === ORDER_NEEDS_REVIEW_CODE) return ORDER_NEEDS_REVIEW_CODE;
  return err.code === "network_error" ? "offline" : "payment_failed";
}
