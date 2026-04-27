"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  trackWebMenuDownloadClick,
  trackWebMenuOpenAppClick,
  trackWebMenuView,
} from "@/lib/analytics";
import { getFirebaseDb } from "@/lib/firebase";
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

export default function PublicMenuPage() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<MenuRow[]>([]);
  /** Branch short URL from app (same as QR/share) when cached in Firestore. */
  const [branchMenuHref, setBranchMenuHref] = useState<string | null>(null);

  const downloadHref =
    restaurantId && `/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`;
  const primaryCtaHref = branchMenuHref && branchMenuHref.trim() ? branchMenuHref.trim() : downloadHref;

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
          setBranchMenuHref(null);
          setLoading(false);
          return;
        }

        const rData = rSnap.data() as Record<string, unknown>;
        const resolvedName =
          typeof rData.name === "string" && rData.name.trim() ? rData.name : "Restaurante";
        setRestaurantName(resolvedName);
        setLogoUrl(getRestaurantImageUrl(rData));

        try {
          const linkSnap = await getDoc(
            doc(db, "restaurants", restaurantId, "settings", "menu_link"),
          );
          if (!cancelled && linkSnap.exists()) {
            const linkData = linkSnap.data() as Record<string, unknown> | undefined;
            const link = linkData?.link;
            if (typeof link === "string" && link.trim()) {
              setBranchMenuHref(link.trim());
            } else {
              setBranchMenuHref(null);
            }
          } else if (!cancelled) {
            setBranchMenuHref(null);
          }
        } catch {
          if (!cancelled) setBranchMenuHref(null);
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
        setBranchMenuHref(null);
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
              🔥 Este lugar tiene recompensas en Comeleal
            </p>
          ) : null}
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
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[10px] bg-neutral-200">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={96}
                      height={96}
                      unoptimized
                      className="h-24 w-24 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center text-2xl text-neutral-400">
                      🍽
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-semibold text-[#1C2526]">
                      {item.name}
                    </p>
                    <p
                      className="shrink-0 text-base font-bold"
                      style={{ color: "#F28C38" }}
                    >
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#1C2526]/75">
                      {item.description}
                    </p>
                  )}
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
        <p className="text-center text-lg font-extrabold leading-snug text-[#1C2526] sm:text-xl">
          🔥 Esta visita ya cuenta para tus recompensas
        </p>
        <p className="mb-3 mt-1 text-center text-sm text-[#1C2526]/75">
          Abre Comeleal antes de ordenar
        </p>
        <div className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row sm:justify-stretch">
          <a
            href={primaryCtaHref || "#"}
            className="block w-full rounded-lg py-3 text-center text-sm font-semibold text-white shadow-sm sm:flex-1"
            style={{ backgroundColor: "#F28C38" }}
            onClick={() => {
              if (!restaurantId) return;
              trackWebMenuOpenAppClick({
                restaurantId,
                restaurantName: restaurantName || "Restaurante",
              });
            }}
          >
            Abrir en Comeleal
          </a>
          <a
            href={downloadHref || "#"}
            className="block w-full rounded-lg border border-[#1C2526]/10 bg-white/90 py-2.5 text-center text-sm font-medium text-[#1C2526]/65 sm:flex-1"
            onClick={() => {
              if (!restaurantId) return;
              trackWebMenuDownloadClick({
                restaurantId,
                restaurantName: restaurantName || "Restaurante",
              });
            }}
          >
            Descargar app
          </a>
        </div>
      </div>
    </div>
  );
}
