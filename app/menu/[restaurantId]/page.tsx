"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CartBar } from "@/components/cart/CartBar";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { useCart } from "@/lib/cart/CartProvider";
import { trackWebMenuView } from "@/lib/analytics";
import { getFirebaseDb } from "@/lib/firebase";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

function mapMenuDoc(id: string, data: Record<string, unknown>): MenuRow {
  const priceRaw = data.price;
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string"
        ? parseFloat(priceRaw)
        : NaN;
  return {
    id,
    name: typeof data.name === "string" ? data.name : "—",
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : null,
    price: Number.isFinite(price) ? price : 0,
    category: typeof data.category === "string" && data.category.trim() ? data.category : "Otros",
    imageUrl:
      typeof data.imageUrl === "string" && data.imageUrl.trim() ? data.imageUrl.trim() : null,
    isAvailable: typeof data.isAvailable === "boolean" ? data.isAvailable : true,
  };
}

/** Items must already be sorted by category then name. */
function groupMenuByCategory(items: MenuRow[]): { category: string; items: MenuRow[] }[] {
  const groups: { category: string; items: MenuRow[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (!last || last.category !== item.category) {
      groups.push({ category: item.category, items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return groups;
}

const MENU_PAGE_BG =
  "min-h-screen bg-gradient-to-b from-[#FAF7F2] via-[#F5EDE2] to-[#F0E3D2] text-[#1C2526]";

function MenuRestaurantHeader({
  loading,
  restaurantName,
  logoUrl,
  secondarySubtitle,
}: {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  secondarySubtitle?: string | null;
}) {
  return (
    <header className="relative overflow-hidden bg-[#141414] shadow-md">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(242,140,56,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl lg:max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-lg ring-2 ring-white/15"
            />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F28C38]/15 text-2xl ring-2 ring-white/10"
              aria-hidden
            >
              🍽
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
              {loading ? "…" : restaurantName || "Menú"}
            </h1>
            {!loading && restaurantName ? (
              <div className="mt-2 space-y-1.5">
                <p className="inline-flex max-w-full items-center rounded-full border border-[#F28C38]/35 bg-[#F28C38]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB366]">
                  🔥 Recompensas en Comeleal
                </p>
                {secondarySubtitle ? (
                  <p className="text-xs leading-snug text-white/55">{secondarySubtitle}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="h-px bg-gradient-to-r from-transparent via-[#F28C38]/50 to-transparent"
        aria-hidden
      />
    </header>
  );
}

function MenuStatusMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <p
      className={
        "rounded-2xl border px-4 py-6 text-center text-sm " +
        (tone === "error"
          ? "border-red-200/80 bg-red-50 text-red-800"
          : "border-[#1C2526]/8 bg-white/80 text-[#1C2526]/70")
      }
    >
      {children}
    </p>
  );
}

function MenuCategoryList({
  groups,
  orderingEnabled,
  onAddItem,
  getItemQuantity,
  onIncrementItem,
  onDecrementItem,
}: {
  groups: { category: string; items: MenuRow[] }[];
  orderingEnabled: boolean;
  onAddItem: (item: MenuRow) => void;
  getItemQuantity?: (itemId: string) => number;
  onIncrementItem?: (item: MenuRow) => void;
  onDecrementItem?: (item: MenuRow) => void;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group, index) => (
        <section key={`${group.category}-${index}`} aria-labelledby={`menu-cat-${index}`}>
          <h2
            id={`menu-cat-${index}`}
            className="mb-3 flex items-center gap-2.5 text-lg font-bold capitalize tracking-tight text-[#1C2526]"
          >
            <span className="h-5 w-1 rounded-full bg-[#F28C38]" aria-hidden />
            {group.category.toLowerCase()}
          </h2>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {group.items.map((item) => (
              <MenuItemCard
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                imageUrl={item.imageUrl}
                orderingEnabled={orderingEnabled}
                quantity={getItemQuantity?.(item.id) ?? 0}
                onAdd={() => onAddItem(item)}
                onIncrement={() => onIncrementItem?.(item)}
                onDecrement={() => onDecrementItem?.(item)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MenuBottomDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#1C2526]/10 bg-[#FAF7F2]/95 px-4 py-2.5 shadow-[0_-8px_32px_rgba(28,37,38,0.08)] backdrop-blur-md"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl">{children}</div>
    </div>
  );
}

function PublicMenuPageWithOrdering() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const { addItem, lines, incrementLine, decrementLine } = useCart();
  const { webOrderingAvailable, webOrderingReady } = useWebOrdering();

  const quantityByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(line.menuItemId, line.quantity);
    }
    return map;
  }, [lines]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<MenuRow[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      setError("Falta el id del restaurante");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirebaseDb();
        const rRef = doc(db, "restaurants", restaurantId);
        const rSnap = await getDoc(rRef);
        if (cancelled) return;
        if (!rSnap.exists()) {
          const allSnap = await getDocs(collection(db, "restaurants"));
          const match = allSnap.docs.find((d) => d.id.toLowerCase() === restaurantId.toLowerCase());
          if (match) {
            window.location.replace(`/menu/${match.id}`);
            return;
          }

          setError("No encontramos este menú");
          setRestaurantName("");
          setItems([]);
          setLoading(false);
          return;
        }

        const rData = rSnap.data() as Record<string, unknown>;
        const resolvedName =
          typeof rData.name === "string" && rData.name.trim() ? rData.name : "Restaurante";
        setRestaurantName(resolvedName);
        setLogoUrl(getRestaurantImageUrl(rData));

        const menuSnap = await getDocs(collection(db, "restaurants", restaurantId, "menu"));
        if (cancelled) return;
        const rows: MenuRow[] = [];
        menuSnap.forEach((d) => {
          rows.push(mapMenuDoc(d.id, d.data() as Record<string, unknown>));
        });
        const available = rows
          .filter((r) => r.isAvailable)
          .sort((a, b) => {
            const c = a.category.localeCompare(b.category, "es");
            return c !== 0 ? c : a.name.localeCompare(b.name, "es");
          });
        setItems(available);
        if (!cancelled) {
          trackWebMenuView({
            restaurantId,
            restaurantName: resolvedName,
            itemCount: available.length,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar el menú");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const headerSecondary =
    webOrderingReady && webOrderingAvailable
      ? "Ordena en línea · Pago seguro con Mercado Pago"
      : webOrderingReady
        ? "Menú en línea"
        : null;

  const showMpUnavailableDock =
    webOrderingReady && !webOrderingAvailable && !loading && !error;

  const categoryGroups = groupMenuByCategory(items);
  const orderingEnabled = webOrderingReady && webOrderingAvailable;

  return (
    <div className={MENU_PAGE_BG}>
      <MenuRestaurantHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        secondarySubtitle={headerSecondary}
      />

      <main
        className={
          "mx-auto w-full max-w-3xl lg:max-w-4xl px-4 pt-5 sm:px-6 sm:pt-6 " +
          (webOrderingReady ? "pb-[220px] sm:pb-[200px]" : "pb-28")
        }
      >
        {loading && <MenuStatusMessage>Cargando menú…</MenuStatusMessage>}

        {!loading && error && <MenuStatusMessage tone="error">{error}</MenuStatusMessage>}

        {!loading && !error && items.length === 0 && (
          <MenuStatusMessage>No hay platillos disponibles</MenuStatusMessage>
        )}

        {!loading && !error && items.length > 0 && (
          <MenuCategoryList
            groups={categoryGroups}
            orderingEnabled={orderingEnabled}
            getItemQuantity={(itemId) => quantityByItemId.get(itemId) ?? 0}
            onAddItem={(item) =>
              addItem({
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
              })
            }
            onIncrementItem={(item) => incrementLine(item.id)}
            onDecrementItem={(item) => decrementLine(item.id)}
          />
        )}
      </main>

      <CartBar restaurantId={restaurantId} restaurantName={restaurantName} />

      {showMpUnavailableDock ? (
        <MenuBottomDock>
          <MenuAppRewardsCta
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            variant="banner"
          />
        </MenuBottomDock>
      ) : null}
    </div>
  );
}

function PublicMenuPageBrowseOnly() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<MenuRow[]>([]);
  const [menuLinkResolved, setMenuLinkResolved] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setError("Falta el id del restaurante");
      setLoading(false);
      setMenuLinkResolved(true);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setMenuLinkResolved(false);
      try {
        const db = getFirebaseDb();
        const rRef = doc(db, "restaurants", restaurantId);
        const rSnap = await getDoc(rRef);
        if (cancelled) return;
        if (!rSnap.exists()) {
          const allSnap = await getDocs(collection(db, "restaurants"));
          const match = allSnap.docs.find((d) => d.id.toLowerCase() === restaurantId.toLowerCase());
          if (match) {
            window.location.replace(`/menu/${match.id}`);
            return;
          }

          setError("No encontramos este menú");
          setRestaurantName("");
          setItems([]);
          setMenuLinkResolved(true);
          setLoading(false);
          return;
        }

        const rData = rSnap.data() as Record<string, unknown>;
        const resolvedName =
          typeof rData.name === "string" && rData.name.trim() ? rData.name : "Restaurante";
        setRestaurantName(resolvedName);
        setLogoUrl(getRestaurantImageUrl(rData));

        try {
          await getDoc(doc(db, "restaurants", restaurantId, "settings", "menu_link"));
        } catch {
          /* optional */
        } finally {
          if (!cancelled) setMenuLinkResolved(true);
        }

        const menuSnap = await getDocs(collection(db, "restaurants", restaurantId, "menu"));
        if (cancelled) return;
        const rows: MenuRow[] = [];
        menuSnap.forEach((d) => {
          rows.push(mapMenuDoc(d.id, d.data() as Record<string, unknown>));
        });
        const available = rows
          .filter((r) => r.isAvailable)
          .sort((a, b) => {
            const c = a.category.localeCompare(b.category, "es");
            return c !== 0 ? c : a.name.localeCompare(b.name, "es");
          });
        setItems(available);
        if (!cancelled) {
          trackWebMenuView({
            restaurantId,
            restaurantName: resolvedName,
            itemCount: available.length,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar el menú");
        setItems([]);
        setMenuLinkResolved(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const categoryGroups = groupMenuByCategory(items);

  return (
    <div className={MENU_PAGE_BG}>
      <MenuRestaurantHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
      />

      <main className="mx-auto w-full max-w-3xl lg:max-w-4xl px-4 pt-5 pb-[200px] sm:px-6 sm:pt-6 sm:pb-[180px]">
        {loading && <MenuStatusMessage>Cargando menú…</MenuStatusMessage>}
        {!loading && error && <MenuStatusMessage tone="error">{error}</MenuStatusMessage>}
        {!loading && !error && items.length === 0 && (
          <MenuStatusMessage>No hay platillos disponibles</MenuStatusMessage>
        )}
        {!loading && !error && items.length > 0 && (
          <MenuCategoryList
            groups={categoryGroups}
            orderingEnabled={false}
            onAddItem={() => {}}
          />
        )}
      </main>

      <MenuBottomDock>
        <MenuAppRewardsCta
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          variant="browse"
          disabled={!menuLinkResolved}
        />
      </MenuBottomDock>
    </div>
  );
}

export default function PublicMenuPage() {
  if (isWebOrderingEnabled()) {
    return <PublicMenuPageWithOrdering />;
  }
  return <PublicMenuPageBrowseOnly />;
}
