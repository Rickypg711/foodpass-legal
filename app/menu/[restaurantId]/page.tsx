"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CartBar } from "@/components/cart/CartBar";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { ItemOptionsSheet } from "@/components/menu/ItemOptionsSheet";
import { resolveOptionGroups, type MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import type { SelectedOptionGroup } from "@/lib/cart/types";
import { RewardLadder, hasRewardLadder } from "@/components/loyalty/RewardLadder";
import { useCart } from "@/lib/cart/CartProvider";
import { trackWebMenuView } from "@/lib/analytics";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantSnapOnce } from "@/lib/restaurantDocCache";
import { warmUpsellSuggestion } from "@/lib/upsellSuggestionCache";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { resolveTableFromLocation } from "@/lib/order/tableSession";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";
import {
  isPositivelyClosedNow,
  scheduleStatus,
  type ScheduleStatus,
} from "@/lib/schedule";

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  /** Opciones definidas por el vendor. Si vienen, mandan sobre la descripción. */
  optionGroups?: MenuItemOptionGroup[];
};

/**
 * First-visit reward label from the restaurant doc (firstPurchaseReward map,
 * same shape the Flutter app reads). Null when missing/disabled → CTAs fall
 * back to generic copy.
 */
function firstVisitRewardLabelFromRestaurant(
  data: Record<string, unknown>,
): string | null {
  const fpr = data.firstPurchaseReward;
  if (!fpr || typeof fpr !== "object") return null;
  const m = fpr as Record<string, unknown>;
  if (m.enabled !== true) return null;
  const name =
    typeof m.menuItemName === "string" && m.menuItemName.trim()
      ? m.menuItemName.trim()
      : typeof m.description === "string" && m.description.trim()
        ? m.description.trim()
        : null;
  return name;
}

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
    optionGroups: Array.isArray(data.optionGroups)
      ? (data.optionGroups as MenuItemOptionGroup[])
      : undefined,
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
  schedule,
  address,
}: {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  secondarySubtitle?: string | null;
  /** Horario de hoy ("Abierto · cierra 8:00 pm" / "Cerrado · abre mañana…"). */
  schedule?: ScheduleStatus | null;
  /** Dirección del negocio — con link directo a Google Maps. */
  address?: string | null;
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="inline-flex max-w-full items-center rounded-full border border-[#F28C38]/35 bg-[#F28C38]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB366]">
                    🔥 Recompensas en Comeleal
                  </p>
                  {schedule ? (
                    <p
                      className={
                        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold " +
                        (schedule.open
                          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                          : "border-red-400/40 bg-red-400/15 text-red-300")
                      }
                    >
                      {schedule.open ? "🟢" : "🔴"} {schedule.label}
                    </p>
                  ) : null}
                </div>
                {address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-xs leading-snug text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
                  >
                    📍 <span className="truncate">{address}</span>
                  </a>
                ) : null}
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

/** Premios fantasma al final del menú (robo de la app de Owner): la escalera
 *  completa en gris con candado — el comensal ve la comida gratis que se
 *  pierde justo donde ya está viendo comida. */
function MenuRewardsLadderSection({
  restaurantId,
  rdata,
  items,
}: {
  restaurantId: string;
  rdata: Record<string, unknown>;
  items: MenuRow[];
}) {
  if (!hasRewardLadder(rdata)) return null;
  return (
    <section className="mt-10" aria-label="Premios por regresar">
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#1C2526]">
        <span className="h-5 w-1 rounded-full bg-[#F28C38]" aria-hidden />
        Premios por regresar ⭐
      </h2>
      <RewardLadder
        restaurantData={rdata}
        menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
      />
      <a
        href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
        className="mt-3 inline-block text-sm font-semibold text-[#F28C38] underline-offset-2 hover:underline"
      >
        ¿Ya has comprado aquí? Ver mis puntos →
      </a>
    </section>
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

  // Platillo esperando que el cliente elija sus opciones.
  const [pendingItem, setPendingItem] = useState<
    { id: string; name: string; price: number; imageUrl: string | null; groups: MenuItemOptionGroup[] } | null
  >(null);

  const quantityByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      // Un platillo puede estar varias veces con opciones distintas: se suman.
      map.set(line.menuItemId, (map.get(line.menuItemId) ?? 0) + line.quantity);
    }
    return map;
  }, [lines]);

  // Precalienta la sugerencia de upsell (Cloud Function con IA) mientras el
  // cliente sigue escogiendo — al llegar al checkout ya está resuelta y la
  // tarjeta pinta al instante. Debounce: una llamada por carrito estable.
  const upsellIds = useMemo(
    () => lines.map((l) => l.menuItemId).sort().join(","),
    [lines],
  );
  useEffect(() => {
    if (!restaurantId || !upsellIds) return;
    const t = setTimeout(
      () => warmUpsellSuggestion(restaurantId, upsellIds.split(",")),
      700,
    );
    return () => clearTimeout(t);
  }, [restaurantId, upsellIds]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [firstVisitReward, setFirstVisitReward] = useState<string | null>(null);
  const [items, setItems] = useState<MenuRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  /** Doc completo del restaurante (para la escalera de premios fantasma). */
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(null);
  /** true SOLO si el horario configurado dice cerrado (lib/schedule). */
  const [closedNow, setClosedNow] = useState(false);
  /** Mesa del QR (?mesa=5). Vacío = menú normal para llevar/recoger. */
  const [tableNumber, setTableNumber] = useState("");

  // ESTE es el punto donde la mesa se captura. El QR de la mesa aterriza aquí
  // con ?mesa=5; de aquí en adelante el comensal navega y el parámetro se
  // pierde de la URL, así que se persiste en sessionStorage y el checkout lo
  // recoge de ahí. Si esto no corre, el pedido sale como "para recoger" y la
  // cocina no sabe a qué mesa llevarlo.
  useEffect(() => {
    if (!restaurantId) return;
    setTableNumber(resolveTableFromLocation(restaurantId));
  }, [restaurantId]);

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
        // Cache compartido: el WebOrderingProvider ya pidió este mismo doc —
        // un solo viaje para los dos (la barra del carrito aparece de una vez).
        const rSnap = await getRestaurantSnapOnce(restaurantId);
        if (cancelled) return;
        if (!rSnap.exists()) {
          const allSnap = await getDocs(collection(db, "restaurants"));
          const wanted = restaurantId.toLowerCase();
          // id case-insensitive O slug bonito (comeleal.com/menu/luzz-pizza)
          const match = allSnap.docs.find((d) => {
            if (d.id.toLowerCase() === wanted) return true;
            const s = (d.data() as Record<string, unknown>).slug;
            return typeof s === "string" && s.trim().toLowerCase() === wanted;
          });
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
        setFirstVisitReward(firstVisitRewardLabelFromRestaurant(rData));
        setSchedule(scheduleStatus(rData));
        setAddress(
          typeof rData.address === "string" && rData.address.trim() ? rData.address.trim() : null,
        );
        setRdata(rData);
        setClosedNow(isPositivelyClosedNow(rData));

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

  const headerSecondary = closedNow
    ? "Menú en línea"
    : webOrderingReady && webOrderingAvailable
      ? "Ordena en línea · Pago seguro con Mercado Pago"
      : webOrderingReady
        ? "Menú en línea"
        : null;

  const showMpUnavailableDock =
    webOrderingReady && !webOrderingAvailable && !loading && !error;

  const categoryGroups = groupMenuByCategory(items);
  // Cerrado (positivo) = el menú se VE, pero no se puede ordenar.
  const orderingEnabled = webOrderingReady && webOrderingAvailable && !closedNow;

  return (
    <div className={MENU_PAGE_BG}>
      <MenuRestaurantHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        secondarySubtitle={headerSecondary}
        schedule={schedule}
        address={address}
      />

      {/* Llegó por el QR de su mesa: se le dice de una, para que sepa que el
          pedido va a su mesa y no tiene que ir por él. */}
      {tableNumber ? (
        <div
          className="px-4 pt-3 sm:px-6"
          role="status"
        >
          <div
            className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl px-4 py-2.5 lg:max-w-4xl"
            style={{
              background: "rgba(242,140,56,0.1)",
              border: "1px solid rgba(242,140,56,0.3)",
            }}
          >
            <span className="text-[18px]">🍽️</span>
            <p className="text-[13px] font-semibold text-[#1C2526]">
              Estás en la mesa{" "}
              <span className="text-[#F28C38]">{tableNumber}</span> — pide desde
              aquí y te lo llevamos.
            </p>
          </div>
        </div>
      ) : null}

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
            onAddItem={(item) => {
              const groups = resolveOptionGroups(item);
              if (groups.length > 0) {
                setPendingItem({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  imageUrl: item.imageUrl,
                  groups,
                });
                return;
              }
              addItem({
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
              });
            }}
            onIncrementItem={(item) => {
              // Con opciones, "+" vuelve a preguntar: cada unidad puede
              // llevar salsa distinta. Sin opciones, sube la línea de siempre.
              const groups = resolveOptionGroups(item);
              if (groups.length > 0) {
                setPendingItem({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  imageUrl: item.imageUrl,
                  groups,
                });
                return;
              }
              incrementLine(item.id);
            }}
            onDecrementItem={(item) => {
              const last = [...lines].reverse().find((l) => l.menuItemId === item.id);
              if (last) decrementLine(last.lineId);
            }}
          />
        )}

        {!loading && !error && rdata ? (
          <MenuRewardsLadderSection
            restaurantId={restaurantId}
            rdata={rdata}
            items={items}
          />
        ) : null}
      </main>

      <ItemOptionsSheet
          open={pendingItem !== null}
          itemName={pendingItem?.name ?? ""}
          basePrice={pendingItem?.price ?? 0}
          groups={pendingItem?.groups ?? []}
          onCancel={() => setPendingItem(null)}
          onConfirm={(selected: SelectedOptionGroup[]) => {
            if (!pendingItem) return;
            addItem({
              menuItemId: pendingItem.id,
              name: pendingItem.name,
              price: pendingItem.price,
              imageUrl: pendingItem.imageUrl,
              selectedOptions: selected,
            });
            setPendingItem(null);
          }}
      />


      {!closedNow && (
        <CartBar
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          firstVisitRewardLabel={firstVisitReward}
        />
      )}

      {closedNow && !loading && !error ? (
        <MenuBottomDock>
          {/* COMPACTO a propósito: la variante banner hacía el dock tan alto
              que tapaba el final del menú (el scroll "rebotaba" sin dejar ver
              los últimos platillos). El upsell queda en una línea. */}
          <p className="pt-1 text-center text-sm font-semibold text-[#1C2526]/75">
            😴 {schedule?.label ?? "Cerrado por ahora"} — puedes ordenar cuando abra.
          </p>
          <MenuAppRewardsCta
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            variant="compact"
            firstVisitRewardLabel={firstVisitReward}
          />
        </MenuBottomDock>
      ) : showMpUnavailableDock ? (
        <MenuBottomDock>
          <MenuAppRewardsCta
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            variant="banner"
            firstVisitRewardLabel={firstVisitReward}
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
  const [firstVisitReward, setFirstVisitReward] = useState<string | null>(null);
  const [items, setItems] = useState<MenuRow[]>([]);
  const [menuLinkResolved, setMenuLinkResolved] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  /** Doc completo del restaurante (para la escalera de premios fantasma). */
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(null);

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
        // Cache compartido: el WebOrderingProvider ya pidió este mismo doc —
        // un solo viaje para los dos (la barra del carrito aparece de una vez).
        const rSnap = await getRestaurantSnapOnce(restaurantId);
        if (cancelled) return;
        if (!rSnap.exists()) {
          const allSnap = await getDocs(collection(db, "restaurants"));
          const wanted = restaurantId.toLowerCase();
          // id case-insensitive O slug bonito (comeleal.com/menu/luzz-pizza)
          const match = allSnap.docs.find((d) => {
            if (d.id.toLowerCase() === wanted) return true;
            const s = (d.data() as Record<string, unknown>).slug;
            return typeof s === "string" && s.trim().toLowerCase() === wanted;
          });
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
        setFirstVisitReward(firstVisitRewardLabelFromRestaurant(rData));
        setSchedule(scheduleStatus(rData));
        setAddress(
          typeof rData.address === "string" && rData.address.trim() ? rData.address.trim() : null,
        );
        setRdata(rData);

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
        schedule={schedule}
        address={address}
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

        {!loading && !error && rdata ? (
          <MenuRewardsLadderSection
            restaurantId={restaurantId}
            rdata={rdata}
            items={items}
          />
        ) : null}
      </main>

      <MenuBottomDock>
        <MenuAppRewardsCta
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          variant="browse"
          disabled={!menuLinkResolved}
          firstVisitRewardLabel={firstVisitReward}
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
