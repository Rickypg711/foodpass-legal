"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CartBar } from "@/components/cart/CartBar";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { useCart } from "@/lib/cart/CartProvider";
import { trackWebMenuOpenAppClick, trackWebMenuView } from "@/lib/analytics";
import { getFirebaseDb } from "@/lib/firebase";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";
import {
  WEB_ORDERING_UNAVAILABLE_HINT,
  WEB_ORDERING_UNAVAILABLE_TITLE,
} from "@/lib/order/customerWebCheckoutPolicy";
import { formatPrice } from "@/lib/priceFormat";
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

function PublicMenuPageWithOrdering() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";
  const { addItem } = useCart();
  const { webOrderingAvailable, webOrderingReady } = useWebOrdering();

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

  return (
    <div
      className="min-h-screen text-[#1C2526]"
      style={{ backgroundColor: "#F0E3D2" }}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ backgroundColor: "#F28C38" }}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-white">
            {loading ? "…" : restaurantName || "Menú"}
          </h1>
          {!loading && restaurantName ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/90">
              {webOrderingReady && webOrderingAvailable
                ? "Ordena en línea · Pago con Mercado Pago"
                : "Menú en línea"}
            </p>
          ) : null}
        </div>
      </header>

      <main className="px-4 pt-4 pb-28">
        {loading && (
          <p className="text-center text-sm text-[#1C2526]/80">Cargando menú…</p>
        )}

        {!loading && error && (
          <p className="text-center text-sm text-red-700">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-center text-sm">No hay platillos disponibles</p>
        )}

        {webOrderingReady && !webOrderingAvailable && !loading && !error ? (
          <div
            className="mb-4 rounded-xl border border-amber-700/25 bg-white p-4 text-sm text-[#1C2526]"
            role="status"
          >
            <p className="font-semibold text-red-900">{WEB_ORDERING_UNAVAILABLE_TITLE}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#1C2526]/75">
              {WEB_ORDERING_UNAVAILABLE_HINT}
            </p>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 && (
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => (
              <MenuItemCard
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                imageUrl={item.imageUrl}
                orderingEnabled={webOrderingReady && webOrderingAvailable}
                onAdd={() =>
                  addItem({
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    imageUrl: item.imageUrl,
                  })
                }
              />
            ))}
          </ul>
        )}
      </main>

      <CartBar restaurantId={restaurantId} />

      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 px-4 pb-20 pt-2 text-center"
        style={{ paddingBottom: "max(5rem, env(safe-area-inset-bottom))" }}
      >
        <p className="text-xs text-[#1C2526]/65">
          {webOrderingReady && webOrderingAvailable
            ? "Pago en línea con Mercado Pago · Crea tu cuenta en Comeleal para guardar puntos después del pedido"
            : "Crea tu cuenta en Comeleal para guardar puntos cuando el restaurante active pedidos en línea"}
        </p>
      </div>
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

  const downloadHref =
    restaurantId && `/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`;
  const primaryCtaHref = !menuLinkResolved ? "#" : downloadHref || "#";

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

  return (
    <div
      className="min-h-screen text-[#1C2526]"
      style={{ backgroundColor: "#F0E3D2" }}
    >
      <header
        className="flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ backgroundColor: "#F28C38" }}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-white">
            {loading ? "…" : restaurantName || "Menú"}
          </h1>
        </div>
      </header>

      <main className="px-4 pt-4 pb-[260px] sm:pb-[200px]">
        {loading && (
          <p className="text-center text-sm text-[#1C2526]/80">Cargando menú…</p>
        )}
        {!loading && error && (
          <p className="text-center text-sm text-red-700">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="text-center text-sm">No hay platillos disponibles</p>
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-[14px] bg-white p-4"
                style={{ boxShadow: "0 1px 0 rgba(28, 37, 38, 0.06)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="font-bold" style={{ color: "#F28C38" }}>
                    {formatPrice(item.price)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-black/5 px-4 pt-3"
        style={{
          backgroundColor: "#F0E3D2",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <p className="mb-3 text-center text-sm text-[#1C2526]/75">
          Abre Comeleal para ordenar y ganar puntos
        </p>
        <a
          href={primaryCtaHref || "#"}
          className={
            "mx-auto block w-full max-w-xs rounded-xl py-3 text-center text-sm font-semibold text-white " +
            (!menuLinkResolved ? "pointer-events-none opacity-60 " : "")
          }
          style={{ backgroundColor: "#F28C38" }}
          onClick={() => {
            if (!menuLinkResolved || !restaurantId) return;
            trackWebMenuOpenAppClick({
              restaurantId,
              restaurantName: restaurantName || "Restaurante",
            });
          }}
        >
          Abrir Comeleal
        </a>
      </div>
    </div>
  );
}

export default function PublicMenuPage() {
  if (isWebOrderingEnabled()) {
    return <PublicMenuPageWithOrdering />;
  }
  return <PublicMenuPageBrowseOnly />;
}
