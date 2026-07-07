"use client";

import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFirebaseDb } from "@/lib/firebase";
import {
  restaurantAllowsPayAtPickup,
  restaurantSupportsWebCheckout,
} from "@/lib/order/customerWebCheckoutPolicy";

export type WebOrderingContextValue = {
  /** False until restaurant doc has been evaluated. */
  webOrderingReady: boolean;
  webOrderingAvailable: boolean;
};

const WebOrderingContext = createContext<WebOrderingContextValue | null>(null);

export function WebOrderingProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: ReactNode;
}) {
  const [webOrderingReady, setWebOrderingReady] = useState(false);
  const [webOrderingAvailable, setWebOrderingAvailable] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setWebOrderingAvailable(false);
      setWebOrderingReady(true);
      return;
    }

    let cancelled = false;
    setWebOrderingReady(false);

    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId));
        if (cancelled) return;
        const data = snap.exists()
          ? (snap.data() as Record<string, unknown>)
          : undefined;
        // Ordering works with EITHER online payment (MP) or the vendor-enabled
        // "Pagar al recoger" — the checkout page resolves the method.
        setWebOrderingAvailable(
          restaurantSupportsWebCheckout(restaurantId, data) ||
            restaurantAllowsPayAtPickup(data),
        );
      } catch {
        if (!cancelled) setWebOrderingAvailable(false);
      } finally {
        if (!cancelled) setWebOrderingReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const value = useMemo(
    () => ({ webOrderingReady, webOrderingAvailable }),
    [webOrderingReady, webOrderingAvailable],
  );

  return (
    <WebOrderingContext.Provider value={value}>{children}</WebOrderingContext.Provider>
  );
}

export function useWebOrdering(): WebOrderingContextValue {
  const ctx = useContext(WebOrderingContext);
  if (!ctx) {
    throw new Error("useWebOrdering must be used within WebOrderingProvider");
  }
  return ctx;
}

/** Safe when ordering layout is browse-only (no provider). */
export function useWebOrderingOptional(): WebOrderingContextValue | null {
  return useContext(WebOrderingContext);
}
