"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trackCartItemAdded } from "@/lib/analytics/orderEvents";
import { mpWebDebugClient } from "@/lib/mercadoPago/mpWebDebug";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";
import {
  decrementCartLine,
  incrementCartLine,
  updateCartLineQuantity,
} from "@/lib/cart/cartLineMath";
import { clearCart, loadCart, saveCart } from "./cartStorage";
import type { CartLine } from "./types";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  /** True after client has loaded cart from sessionStorage. */
  cartReady: boolean;
  addItem: (item: Omit<CartLine, "quantity" | "subtotal">) => void;
  incrementLine: (menuItemId: string) => void;
  decrementLine: (menuItemId: string) => void;
  updateLineQuantity: (menuItemId: string, quantity: number) => void;
  removeLine: (menuItemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: ReactNode;
}) {
  const { webOrderingAvailable, webOrderingReady } = useWebOrdering();
  const [lines, setLines] = useState<CartLine[]>([]);
  const cartReady = webOrderingReady;

  useEffect(() => {
    if (!webOrderingReady) return;

    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!webOrderingAvailable) {
        // DO NOT clear sessionStorage here: a transient restaurant-doc fetch
        // failure (offline blip, race on deep-link) used to WIPE the customer's
        // cart. Keep storage intact; just don't surface lines while blocked.
        setLines([]);
        mpWebDebugClient("cart_hidden_mp_unavailable", { restaurantId });
        return;
      }
      const loaded = loadCart(restaurantId);
      setLines(loaded);
      mpWebDebugClient("cart_loaded", {
        restaurantId,
        itemCount: loaded.reduce((s, l) => s + l.quantity, 0),
        lineCount: loaded.length,
      });
      if (loaded.length === 0) {
        mpWebDebugClient("cart_empty_detected", { restaurantId, source: "sessionStorage_load" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, webOrderingReady, webOrderingAvailable]);

  useEffect(() => {
    if (!cartReady) return;
    saveCart(restaurantId, lines);
  }, [restaurantId, lines, cartReady]);

  const addItem = useCallback(
    (item: Omit<CartLine, "quantity" | "subtotal">) => {
      if (!webOrderingAvailable) {
        mpWebDebugClient("cart_add_blocked_mp_unavailable", { restaurantId });
        return;
      }
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.menuItemId === item.menuItemId);
        let next: CartLine[];
        let addedQty = 1;
        if (idx >= 0) {
          const line = prev[idx]!;
          const qty = line.quantity + 1;
          addedQty = qty;
          next = [...prev];
          next[idx] = {
            ...line,
            quantity: qty,
            subtotal: line.price * qty,
          };
        } else {
          next = [
            ...prev,
            {
              ...item,
              quantity: 1,
              subtotal: item.price,
            },
          ];
        }
        void trackCartItemAdded({
          restaurantId,
          menuItemId: item.menuItemId,
          quantity: addedQty,
        });
        return next;
      });
    },
    [restaurantId, webOrderingAvailable],
  );

  const incrementLine = useCallback(
    (menuItemId: string) => {
      if (!webOrderingAvailable) return;
      setLines((prev) => incrementCartLine(prev, menuItemId));
    },
    [webOrderingAvailable],
  );

  const decrementLine = useCallback(
    (menuItemId: string) => {
      if (!webOrderingAvailable) return;
      setLines((prev) => decrementCartLine(prev, menuItemId));
    },
    [webOrderingAvailable],
  );

  const updateLineQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      if (!webOrderingAvailable) return;
      setLines((prev) => updateCartLineQuantity(prev, menuItemId, quantity));
    },
    [webOrderingAvailable],
  );

  const removeLine = useCallback(
    (menuItemId: string) => {
      if (!webOrderingAvailable) return;
      setLines((prev) => prev.filter((l) => l.menuItemId !== menuItemId));
    },
    [webOrderingAvailable],
  );

  const clear = useCallback(() => {
    mpWebDebugClient("cart_clear_called", {
      restaurantId,
      previousItemCount: lines.reduce((s, l) => s + l.quantity, 0),
    });
    clearCart(restaurantId);
    setLines([]);
  }, [restaurantId, lines]);

  const itemCount = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  );
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.subtotal, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      cartReady,
      addItem,
      incrementLine,
      decrementLine,
      updateLineQuantity,
      removeLine,
      clear,
    }),
    [
      lines,
      itemCount,
      subtotal,
      cartReady,
      addItem,
      incrementLine,
      decrementLine,
      updateLineQuantity,
      removeLine,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
