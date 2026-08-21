// lib/loyalty/tabDiscountRecalc.ts
//
// Recálculo del descuento especial AL CERRAR una cuenta (5.1.4).
// Espejo EXACTO del módulo Dart foodpass lib/loyalty/tab_discount_recalc.dart.
// Paridad de dinero app↔web: misma matemática, mismo redondeo, mismos campos.
// Cualquier cambio se hace en los dos lados o en ninguno.
//
// POR QUÉ EXISTE
// Hasta 5.1.3 el descuento se resolvía SOLO al abrir la cuenta. Tres fallas:
//   1. Al abrir, el cliente apenas está pidiendo: nadie teclea su teléfono,
//      así que no hay lookup y la cuenta nace a precio completo.
//   2. Aunque sí lo teclee, el descuento cubría el carrito de ESE instante;
//      lo que se agregara después iba a precio completo.
//   3. Peor: addItemsToTabTransaction escribía `total` con el bruto de TODOS
//      los items y BORRABA el descuento que la cuenta ya traía (pizza $100 con
//      15% = $85; pides una cerveza de $50 y el total salta a $150 en vez de
//      $127.50), dejando `discountApplied` en el doc como registro falso.
//
// LA REGLA: el CIERRE es la única fuente de verdad. El descuento se recalcula
// siempre desde las líneas originales (precio × cantidad), NUNCA desde un total
// ya descontado. Eso lo hace idempotente por construcción — volver a entrar da
// el mismo neto — y hace imposible apilar descuento sobre descuento.

import {
  computeDiscount,
  type DiscountCartLine,
  type DiscountProfile,
} from "./discountProfiles.ts";

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Una línea de la cuenta, aplanada desde `order.items`.
 *
 * `categoryName` puede faltar en órdenes creadas antes de 5.1.4 (los items no
 * persistían la categoría). Para esas, `recalcTabDiscount` la resuelve con
 * `categoryByMenuItemId` leyendo el menú. Sin categoría, un perfil
 * `per_category` trataría todo como alimento — por eso el fallback importa.
 */
export type TabLine = {
  menuItemId: string;
  price: number;
  quantity: number;
  categoryName?: string | null;
};

export type TabDiscountRecalc = {
  /** Bruto: suma de precio × cantidad de TODAS las líneas acumuladas. */
  gross: number;
  /** Descuento sobre el bruto. 0 cuando no hay perfil. */
  discount: number;
  /** Lo que se cobra: gross - discount. */
  net: number;
  /** Perfil aplicado (null = ninguno). */
  profile: DiscountProfile | null;
  /** Mapa para `order.discountApplied` — null cuando no hay nada que registrar. */
  discountApplied: {
    profileId: string;
    profileName: string;
    amount: number;
    breakdown?: { bebidas: number; alimentos: number };
  } | null;
  hasDiscount: boolean;
};

/** Aplana `order.items` (crudo de Firestore) a líneas del motor de descuentos. */
export function tabLinesFromItems(items: unknown): TabLine[] {
  if (!Array.isArray(items)) return [];
  const out: TabLine[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const i = raw as Record<string, unknown>;
    const price = Number(i.price);
    const quantity = Number(i.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    out.push({
      menuItemId: typeof i.menuItemId === "string" ? i.menuItemId : "",
      price,
      quantity,
      categoryName:
        typeof i.categoryName === "string" && i.categoryName
          ? i.categoryName
          : null,
    });
  }
  return out;
}

/**
 * Recalcula el descuento de una cuenta sobre TODAS sus líneas.
 *
 * Idempotente: depende solo de `lines` y `profile`, nunca de un total ya
 * calculado. Llamarla dos veces da exactamente el mismo resultado.
 */
export function recalcTabDiscount({
  lines,
  profile,
  categoryByMenuItemId = {},
}: {
  lines: TabLine[];
  profile?: DiscountProfile | null;
  categoryByMenuItemId?: Record<string, string>;
}): TabDiscountRecalc {
  const rawGross = lines.reduce(
    (s, l) => s + (Number.isFinite(l.price) ? l.price : 0) * l.quantity,
    0,
  );
  const gross = round2(rawGross < 0 ? 0 : rawGross);

  if (!profile || gross <= 0) {
    return {
      gross,
      discount: 0,
      net: gross,
      profile: null,
      discountApplied: null,
      hasDiscount: false,
    };
  }

  const cartLines: DiscountCartLine[] = lines.map((l) => ({
    price: l.price,
    quantity: l.quantity,
    categoryName:
      l.categoryName && l.categoryName.length > 0
        ? l.categoryName
        : categoryByMenuItemId[l.menuItemId],
  }));

  const res = computeDiscount(cartLines, profile);
  const discount = round2(Math.min(Math.max(res.amount, 0), gross));
  const net = round2(Math.max(0, gross - discount));

  return {
    gross,
    discount,
    net,
    profile,
    discountApplied:
      discount > 0
        ? {
            profileId: profile.id,
            profileName: profile.name,
            amount: discount,
            ...(res.breakdown ? { breakdown: res.breakdown } : {}),
          }
        : null,
    hasDiscount: discount > 0,
  };
}
