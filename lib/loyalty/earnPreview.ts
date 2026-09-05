// lib/loyalty/earnPreview.ts
//
// Lo que el comensal va a GANAR con este pedido, dicho ANTES de que suelte su
// teléfono — no después de pagar. Módulo PURO (sin Firebase) — espejo de
// `lib/loyalty/purchase_earn_preview.dart` en la app (regla de paridad).
//
// Robo del 5-sep-2026: Fluxsales enseña "Acumulas 37 Boras con este pedido"
// en su checkout. Aquí es la razón para dar el número — el dato muerto de
// Comeleal es la captura de teléfono (Pecado Escondido: 1 en 184 ventas).
//
// Reglas:
//  * Sin nada que ganar (restaurantPromisesPoints false) NO se promete nada.
//  * Los puntos salen de la MISMA fórmula que los acredita (earnPolicy.ts),
//    nunca de un número a mano.
//  * La bienvenida se enseña como razón para VOLVER ("se gana hoy, se cobra
//    la próxima"), y solo mientras el teléfono no está completo: con el
//    número tecleado manda el lookup real (CheckoutRedemption).

import { earnPolicyFromRestaurant } from "./earnPolicy";
import { parseFirstVisitReward } from "./rewardCatalog";
import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";

export type EarnPreview = {
  /** Puntos que sumará este pedido, o null si no hay promesa que hacer. */
  points: number | null;
  /** Nombre del regalo de bienvenida prendido, o null si está apagado. */
  welcomeRewardName: string | null;
};

export const NO_EARN_PREVIEW: EarnPreview = { points: null, welcomeRewardName: null };

/** `orderTotal` es el neto que se cobra (mismo monto que acredita puntos). */
export function buildEarnPreview(
  restaurantData: Record<string, unknown> | null | undefined,
  orderTotal: number,
): EarnPreview {
  if (!restaurantPromisesPoints(restaurantData)) return NO_EARN_PREVIEW;
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return NO_EARN_PREVIEW;
  const policy = earnPolicyFromRestaurant(restaurantData ?? {});
  const points = policy.base + Math.floor(orderTotal / policy.step);
  const welcome = parseFirstVisitReward(restaurantData?.firstPurchaseReward);
  return { points, welcomeRewardName: welcome ? welcome.name : null };
}

function pts(n: number): string {
  return n === 1 ? "1 punto" : `${n} puntos`;
}

/** "Con este pedido juntas 7 puntos" — null cuando no hay promesa. */
export function earnPreviewLine(p: EarnPreview): string | null {
  return p.points && p.points > 0 ? `Con este pedido juntas ${pts(p.points)}` : null;
}

/** La razón para soltar el número — null cuando la bienvenida está apagada. */
export function welcomePreviewLine(p: EarnPreview): string | null {
  return p.welcomeRewardName
    ? `Deja tu número y tu ${p.welcomeRewardName} de bienvenida te espera en tu próxima visita`
    : null;
}

/** Caja: el cajero le habla al cliente — "Con esta compra junta 7 puntos". */
export function cashierEarnLine(p: EarnPreview): string | null {
  return p.points && p.points > 0 ? `Con esta compra junta ${pts(p.points)}` : null;
}

/** Caja: por qué pedir el número aunque sea su primera vez. */
export function cashierWelcomeLine(p: EarnPreview): string | null {
  return p.welcomeRewardName
    ? `Y si es su primera vez, su ${p.welcomeRewardName} de bienvenida le espera en su próxima visita`
    : null;
}
