"use client";

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { sortMenuRows } from "@/lib/menu/categoryOrder";
import {
  brandThemeFromRestaurant,
  taglineFromRestaurant,
  inkAlpha,
  type BrandTheme,
} from "@/lib/brand/brandColor";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CartBar } from "@/components/cart/CartBar";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { MenuCategoryChips } from "@/components/menu/MenuCategoryChips";
import { MenuPoweredByFooter } from "@/components/menu/MenuPoweredByFooter";
import { TableServiceButtons } from "@/components/menu/TableServiceButtons";
import { ItemOptionsSheet } from "@/components/menu/ItemOptionsSheet";
import { OwnerHoursStrip } from "@/components/menu/OwnerHoursStrip";
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
import { getRestaurantImageUrl, getRestaurantBannerUrl } from "@/lib/restaurantImage";
import { MenuItemDetailSheet } from "@/components/menu/MenuItemDetailSheet";
import { menuPaymentLine } from "@/lib/order/menuPaymentLine";
import { menuSkinFromRestaurant, type MenuSkinId } from "@/lib/menu/menuSkin";
import {
  categoryAvailability,
  categoryAvailabilityLabel,
  categoryWindowsFromRestaurant,
  type CategoryWindows,
} from "@/lib/menu/categoryWindows";
import {
  TERCERA_ROOT_CLASS,
  TerceraCategorySection,
  TerceraCover,
  TerceraHeader,
  TerceraItemRow,
  TerceraPanel,
} from "@/components/menu/skins/tercera";
import {
  PECADO_ROOT_CLASS,
  PecadoCategorySection,
  PecadoCover,
  PecadoHeader,
  PecadoItemRow,
  PecadoPanel,
  PecadoSheet,
  pecadoSheets,
} from "@/components/menu/skins/pecado";
import {
  NB_ROOT_CLASS,
  NegroBlancoCategorySection,
  NegroBlancoCover,
  NegroBlancoHeader,
  NegroBlancoItemRow,
  NegroBlancoPanel,
  nbTone,
} from "@/components/menu/skins/negroblanco";
import {
  BL_ROOT_CLASS,
  BloomsCategorySection,
  BloomsHeader,
  BloomsItemRow,
  BloomsPanel,
} from "@/components/menu/skins/blooms";
import {
  MX_ROOT_CLASS,
  MixtecoCategorySection,
  MixtecoHeader,
  MixtecoItemRow,
  MixtecoPanel,
  MixtecoSheet,
  mixtecoSectionPrice,
  mixtecoSheets,
  mixtecoSortItems,
} from "@/components/menu/skins/mixteco";
import {
  LP_ROOT_CLASS,
  LaspicCategorySection,
  LaspicHeader,
  LaspicItemRow,
  LaspicPanel,
  LaspicSheet,
  laspicSortItems,
} from "@/components/menu/skins/laspic";
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
  /** Maridaje impreso en el papel del local (LasPic, 11-sep): "t" ▽ · "c" ○ · "s" □. Solo lo pinta su piel. */
  wine?: string;
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
    wine: typeof data.wine === "string" && data.wine ? data.wine : undefined,
  };
}

/**
 * Datos que el SERVER component (page.tsx) leyó por Firestore REST y manda
 * como props — el robo #1 a Biomenus: el HTML inicial trae el menú completo
 * (nombres, precios, categorías), así que Google y los crawlers de IA lo leen
 * sin ejecutar JS, y el comensal en el 4G de la taquería ve la carta al
 * instante en vez de "Cargando menú…".
 *
 * null = el fetch server falló → la vista se comporta EXACTO como antes
 * (spinner + fetch client). Con datos: siembran el estado inicial y el fetch
 * client de siempre corre igual por detrás y refresca (misma verdad viva,
 * mismos analytics). El chip abierto/cerrado NUNCA se siembra: se calcula con
 * la hora LOCAL del visitante, y el server vive en UTC.
 */
export type MenuInitialData = {
  raw: Record<string, unknown>;
  menu: { id: string; data: Record<string, unknown> }[];
};

function seedName(raw: Record<string, unknown>): string {
  return typeof raw.name === "string" && raw.name.trim() ? raw.name : "Restaurante";
}

function seedAddress(raw: Record<string, unknown>): string | null {
  return typeof raw.address === "string" && raw.address.trim() ? raw.address.trim() : null;
}

/** Mismo mapeo + filtro + orden que aplica el fetch client (paridad exacta).
 *  El orden de categorías lo decide lib/menu/categoryOrder.ts (10-sep): el del
 *  papel si el doc lo trae, si no la regla "como se lee un menú". */
function seedItems(menu: MenuInitialData["menu"], raw: Record<string, unknown> | null): MenuRow[] {
  return sortMenuRows(
    menu.map((d) => mapMenuDoc(d.id, d.data)).filter((r) => r.isAvailable),
    raw,
  );
}

/** Robo #8: pista de elección en la cara de la tarjeta. Con un grupo
 * llamado "salsa/aderezo" la pista es específica ("🌶️ Elige tu salsa");
 * con cualquier otro grupo, genérica. Sin grupos → sin chip (cero ruido). */
function optionsHintFor(item: MenuRow): string | null {
  const groups = resolveOptionGroups(item);
  if (!groups.length) return null;
  const salsa = groups.find((g) => /salsa|aderezo|picante/i.test(g.name || ""));
  if (salsa) return "🌶️ Elige tu salsa";
  const required = groups.find((g) => g.required);
  if (required && required.name) {
    const n = required.name.trim().toLowerCase();
    return `Elige ${n.length > 18 ? "tu opción" : n}`;
  }
  return "Se arma a tu gusto";
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

/** Piel por restaurante (lib/menu/menuSkin.ts): sin `menuSkin` en el doc, la de siempre. */
function pageClassFor(skin: MenuSkinId | null): string {
  if (skin === "tercera") return TERCERA_ROOT_CLASS;
  if (skin === "pecado") return PECADO_ROOT_CLASS;
  if (skin === "negroblanco") return NB_ROOT_CLASS;
  if (skin === "blooms") return BL_ROOT_CLASS;
  if (skin === "mixteco") return MX_ROOT_CLASS;
  if (skin === "laspic") return LP_ROOT_CLASS;
  return MENU_PAGE_BG;
}

/** Ancho del menú. Mixteco y LasPic usan todo el escritorio: su papel va a dos columnas (11-sep). */
function mainWidthFor(skin: MenuSkinId | null): string {
  return skin === "mixteco" || skin === "laspic" ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl lg:max-w-4xl";
}

function MenuRestaurantHeader({
  loading,
  restaurantName,
  logoUrl,
  secondarySubtitle,
  schedule,
  address,
  loyaltyLive,
  brand,
  tagline,
  skin = null,
}: {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  /** Piel del local (10-sep): "tercera" pinta su papel; null = de siempre. */
  skin?: MenuSkinId | null;
  /**
   * Color de marca del local (8-sep): el fondo del logo que el demo recortó
   * de su foto. Sin color propio → el gris de siempre. La tinta se decide
   * por luminancia (lib/brand/brandColor.ts, espejo de la app).
   */
  brand: BrandTheme;
  /** Lema IMPRESO en el menú ("Desde 1960"), bajo el nombre. */
  tagline?: string | null;
  secondarySubtitle?: string | null;
  /** Horario de hoy ("Abierto · cierra 8:00 pm" / "Cerrado · abre mañana…"). */
  schedule?: ScheduleStatus | null;
  /** Dirección del negocio — con link directo a Google Maps. */
  address?: string | null;
  /**
   * Regla del 5-sep: nadie promete puntos al comensal sin premios. El
   * chip "Recompensas en Comeleal" era el único texto de la página que
   * no leía `restaurantPromisesPoints` (cazado 8-sep montando Los Pesados,
   * local recién nacido sin premio y con el chip prendido).
   */
  loyaltyLive?: boolean;
}) {
  if (skin === "tercera") {
    return (
      <TerceraHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  if (skin === "laspic") {
    return (
      <LaspicHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  if (skin === "mixteco") {
    return (
      <MixtecoHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  if (skin === "blooms") {
    return (
      <BloomsHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  if (skin === "negroblanco") {
    return (
      <NegroBlancoHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  if (skin === "pecado") {
    return (
      <PecadoHeader
        phoneCompact
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        tagline={tagline}
        schedule={schedule}
        address={address}
        secondarySubtitle={secondarySubtitle}
      />
    );
  }
  return (
    <header className="relative overflow-hidden shadow-md" style={{ background: brand.bg }}>
      {brand.custom ? null : (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(242,140,56,0.22),transparent_55%)]"
          aria-hidden
        />
      )}
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
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl" style={{ color: brand.ink }}>
              {loading ? "…" : restaurantName || "Menú"}
            </h1>
            {!loading && tagline ? (
              <p className="mt-0.5 text-sm font-semibold italic" style={{ color: inkAlpha(brand.ink, 0.75) }}>
                {tagline}
              </p>
            ) : null}
            {!loading && restaurantName ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {loyaltyLive !== false ? (
                    <p className="inline-flex max-w-full items-center rounded-full border border-[#F28C38]/35 bg-[#F28C38]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB366]">
                      🔥 Recompensas en Comeleal
                    </p>
                  ) : null}
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
                    className="inline-flex max-w-full items-center gap-1 text-xs leading-snug underline-offset-2 hover:underline"
                    style={{ color: inkAlpha(brand.ink, 0.6) }}
                  >
                    📍 <span className="truncate">{address}</span>
                  </a>
                ) : null}
                {secondarySubtitle ? (
                  <p className="text-xs leading-snug" style={{ color: inkAlpha(brand.ink, 0.6) }}>{secondarySubtitle}</p>
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

/** La portada del local en /menu (9-sep): la app y /r ya la pintaban; el
 *  QR abre /menu y ahí no salía. Solo cuando el doc trae coverImageUrl. */
function MenuCoverBanner({ url, name, skin = null }: { url: string; name: string; skin?: MenuSkinId | null }) {
  if (skin === "tercera") return <TerceraCover url={url} name={name} />;
  if (skin === "pecado") return <PecadoCover url={url} name={name} />;
  if (skin === "negroblanco") return <NegroBlancoCover url={url} name={name} />;
  // Blooms: su arte (logo sobre acuarela) ya vive en el encabezado.
  if (skin === "blooms") return null;
  // Mixteco: su portada (frase + logo) ya vive en el encabezado.
  if (skin === "mixteco") return null;
  // LasPic: su fachada ya es el encabezado.
  if (skin === "laspic") return null;
  return (
    <div className="mb-5 overflow-hidden rounded-2xl bg-[#1C2526]/5 shadow-sm">
      <Image
        src={url}
        alt={`Portada de ${name}`}
        width={1600}
        height={900}
        unoptimized
        priority
        className="h-40 w-full object-cover sm:h-56"
      />
    </div>
  );
}

function MenuCategoryList({
  groups,
  orderingEnabled,
  onAddItem,
  getItemQuantity,
  onIncrementItem,
  onDecrementItem,
  onOpenItem,
  skin = null,
  windows = {},
  now,
}: {
  groups: { category: string; items: MenuRow[] }[];
  orderingEnabled: boolean;
  /** Piel del local (10-sep). */
  skin?: MenuSkinId | null;
  /** Ventanas por categoría (lib/menu/categoryWindows.ts): fuera de hora la
   *  sección se ve apagada con su horario y no se agrega nada. */
  windows?: CategoryWindows;
  /** null = todavía sin hora local (server / antes de montar): todo abierto. */
  now?: Date | null;
  onAddItem: (item: MenuRow) => void;
  getItemQuantity?: (itemId: string) => number;
  onIncrementItem?: (item: MenuRow) => void;
  onDecrementItem?: (item: MenuRow) => void;
  /** Tocar la tarjeta/foto → hoja de detalle (9-sep, paridad app). */
  onOpenItem?: (item: MenuRow) => void;
}) {
  const availabilityOf = (category: string) => {
    if (!now) return { closed: false, note: null as string | null };
    const a = categoryAvailability(category, windows, now);
    return { closed: !a.always && !a.openNow, note: categoryAvailabilityLabel(a) };
  };
  // Fuera de hora la sección nace PLEGADA (título + horario + "Ver los
  // platillos"); abrirla la muestra apagada. Así sabes que existe y cuándo, sin
  // tragarte la pared gris (Ricardo, 10-sep).
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const toggle = (category: string) =>
    setOpened((prev) => ({ ...prev, [category]: !prev[category] }));
  if (skin === "pecado") {
    // Las hojas del papel: PLATILLOS y BEBIDAS, cada categoría con su píldora.
    // El índice de cada sección es el GLOBAL (los chips saltan por menu-cat-{i}).
    const sheets = pecadoSheets(groups.map((g, index) => ({ ...g, index })));
    return (
      <div>
        {sheets.map((sheet, sheetIndex) => (
          <PecadoSheet key={`${sheet.title}-${sheetIndex}`} title={sheet.title} tone={sheet.tone} index={sheetIndex}>
            {sheet.groups.map((group) => {
              const index = group.index;
              const { closed, note } = availabilityOf(group.category);
              return (
                <PecadoCategorySection
                  key={`${group.category}-${index}`}
                  category={group.category}
                  index={index}
                  note={note}
                  closed={closed}
                  collapsed={closed && !opened[group.category]}
                  itemCount={group.items.length}
                  onToggle={() => toggle(group.category)}
                >
                  {(!closed || opened[group.category]) && group.items.map((item) => (
                    <PecadoItemRow
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      price={item.price}
                      imageUrl={item.imageUrl}
                      orderingEnabled={orderingEnabled && !closed}
                      optionsHint={optionsHintFor(item)}
                      quantity={getItemQuantity?.(item.id) ?? 0}
                      onAdd={() => onAddItem(item)}
                      onIncrement={() => onIncrementItem?.(item)}
                      onDecrement={() => onDecrementItem?.(item)}
                      onOpen={() => onOpenItem?.(item)}
                    />
                  ))}
                </PecadoCategorySection>
              );
            })}
          </PecadoSheet>
        ))}
      </div>
    );
  }
  if (skin === "laspic") {
    // Su hoja de papel (components/menu/skins/laspic.tsx): mascotas + franja de maridaje + dos columnas; dentro
    // de cada sección el orden de su papel y la figura de maridaje de cada platillo.
    return (
      <LaspicSheet>
        {groups.map((group, index) => {
          const { closed, note } = availabilityOf(group.category);
          return (
            <LaspicCategorySection
              key={`${group.category}-${index}`}
              category={group.category}
              index={index}
              note={note}
              closed={closed}
              collapsed={closed && !opened[group.category]}
              itemCount={group.items.length}
              onToggle={() => toggle(group.category)}
            >
              {(!closed || opened[group.category]) && laspicSortItems(group.items).map((item) => (
                <LaspicItemRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  imageUrl={item.imageUrl}
                  orderingEnabled={orderingEnabled && !closed}
                  optionsHint={optionsHintFor(item)}
                  quantity={getItemQuantity?.(item.id) ?? 0}
                  onAdd={() => onAddItem(item)}
                  onIncrement={() => onIncrementItem?.(item)}
                  onDecrement={() => onDecrementItem?.(item)}
                  onOpen={() => onOpenItem?.(item)}
                  wine={item.wine}
                />
              ))}
            </LaspicCategorySection>
          );
        })}
      </LaspicSheet>
    );
  }
  if (skin === "mixteco") {
    // Sus 4 hojas (components/menu/skins/mixteco.tsx): desayunos · caldos/chilaquiles/tortas · tacos/quesadillas/
    // de la casa · bebidas con salsas y guisos. Dentro de cada sección, el orden de su papel. El índice de cada
    // sección es el GLOBAL (los chips saltan por menu-cat-{i}).
    const sheets = mixtecoSheets(groups.map((g, index) => ({ ...g, index })));
    return (
      <div className="space-y-6 sm:space-y-8">
        {sheets.map((sheet) => (
          <MixtecoSheet key={sheet.n} n={sheet.n}>
            {sheet.groups.map((group) => {
              const index = group.index;
              const { closed, note } = availabilityOf(group.category);
              const drinks = sheet.n === 3;
              const rows = mixtecoSortItems(group.items);
              const sectionPrice = drinks ? mixtecoSectionPrice(rows) : null;
              return (
                <MixtecoCategorySection
                  key={`${group.category}-${index}`}
                  category={group.category}
                  index={index}
                  drinks={drinks}
                  note={note}
                  closed={closed}
                  collapsed={closed && !opened[group.category]}
                  itemCount={group.items.length}
                  onToggle={() => toggle(group.category)}
                  sectionPrice={sectionPrice}
                >
                  {(!closed || opened[group.category]) && rows.map((item) => (
                    <MixtecoItemRow
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      price={item.price}
                      imageUrl={item.imageUrl}
                      orderingEnabled={orderingEnabled && !closed}
                      optionsHint={optionsHintFor(item)}
                      quantity={getItemQuantity?.(item.id) ?? 0}
                      onAdd={() => onAddItem(item)}
                      onIncrement={() => onIncrementItem?.(item)}
                      onDecrement={() => onDecrementItem?.(item)}
                      onOpen={() => onOpenItem?.(item)}
                      category={group.category}
                      drinks={drinks}
                      hidePrice={sectionPrice != null && item.price === sectionPrice}
                    />
                  ))}
                </MixtecoCategorySection>
              );
            })}
          </MixtecoSheet>
        ))}
      </div>
    );
  }
  if (skin === "blooms") {
    // Cada sección copia la composición de su página (components/menu/skins/blooms.tsx):
    // tabla CALIENTE | EN LAS ROCAS cuando los platillos traen ese tamaño, precio común junto al título,
    // y dos columnas en listas cortas sin descripción.
    return (
      <div>
        {groups.map((group, index) => {
          const { closed, note } = availabilityOf(group.category);
          const rocks = new Map<string, number | null>();
          for (const it of group.items) {
            const size = resolveOptionGroups(it).find((g) => /tama/i.test(g.name));
            const r = size?.options.find((o) => /rocas/i.test(o.name));
            rocks.set(it.id, r ? it.price + r.priceDelta : size ? null : null);
          }
          const tableItems = group.items.filter((it) => resolveOptionGroups(it).some((g) => /tama/i.test(g.name) && g.options.some((o) => /rocas/i.test(o.name))));
          const isTable = tableItems.length >= Math.max(2, Math.ceil(group.items.length / 2));
          const counts = new Map<number, number>();
          for (const it of group.items) counts.set(it.price, (counts.get(it.price) ?? 0) + 1);
          const [modePrice, modeCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
          const sectionPrice = !isTable && group.items.length >= 4 && modeCount / group.items.length >= 0.6 ? modePrice : null;
          const twoCol = !isTable && group.items.length >= 4 && group.items.every((it) => !it.description);
          return (
            <BloomsCategorySection
              key={`${group.category}-${index}`}
              category={group.category}
              index={index}
              note={note}
              closed={closed}
              collapsed={closed && !opened[group.category]}
              itemCount={group.items.length}
              onToggle={() => toggle(group.category)}
              sectionPrice={sectionPrice}
              priceColumns={isTable ? ["CALIENTE", "12oz", "EN LAS ROCAS", "16oz"] : null}
              twoCol={twoCol}
            >
              {(!closed || opened[group.category]) && group.items.map((item) => (
                <BloomsItemRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  imageUrl={item.imageUrl}
                  orderingEnabled={orderingEnabled && !closed}
                  optionsHint={optionsHintFor(item)}
                  quantity={getItemQuantity?.(item.id) ?? 0}
                  onAdd={() => onAddItem(item)}
                  onIncrement={() => onIncrementItem?.(item)}
                  onDecrement={() => onDecrementItem?.(item)}
                  onOpen={() => onOpenItem?.(item)}
                  priceColumns={isTable}
                  altPrice={rocks.get(item.id) ?? null}
                  hidePrice={sectionPrice != null && item.price === sectionPrice}
                />
              ))}
            </BloomsCategorySection>
          );
        })}
      </div>
    );
  }
  if (skin === "negroblanco") {
    // Negro y blanco: cada sección alterna panel negro / panel blanco y sus
    // renglones heredan el tono (el "+" se invierte).
    return (
      <div>
        {groups.map((group, index) => {
          const { closed, note } = availabilityOf(group.category);
          const tone = nbTone(index);
          return (
            <NegroBlancoCategorySection
              key={`${group.category}-${index}`}
              category={group.category}
              index={index}
              note={note}
              closed={closed}
              collapsed={closed && !opened[group.category]}
              itemCount={group.items.length}
              onToggle={() => toggle(group.category)}
            >
              {(!closed || opened[group.category]) && group.items.map((item) => (
                <NegroBlancoItemRow
                  key={item.id}
                  id={item.id}
                  tone={tone}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  imageUrl={item.imageUrl}
                  orderingEnabled={orderingEnabled && !closed}
                  optionsHint={optionsHintFor(item)}
                  quantity={getItemQuantity?.(item.id) ?? 0}
                  onAdd={() => onAddItem(item)}
                  onIncrement={() => onIncrementItem?.(item)}
                  onDecrement={() => onDecrementItem?.(item)}
                  onOpen={() => onOpenItem?.(item)}
                />
              ))}
            </NegroBlancoCategorySection>
          );
        })}
      </div>
    );
  }
  if (skin === "tercera") {
    return (
      <div>
        {groups.map((group, index) => {
          const { closed, note } = availabilityOf(group.category);
          return (
          <TerceraCategorySection
            key={`${group.category}-${index}`}
            category={group.category}
            index={index}
            note={note}
            closed={closed}
            collapsed={closed && !opened[group.category]}
            itemCount={group.items.length}
            onToggle={() => toggle(group.category)}
          >
            {(!closed || opened[group.category]) && group.items.map((item) => (
              <TerceraItemRow
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                imageUrl={item.imageUrl}
                orderingEnabled={orderingEnabled && !closed}
                optionsHint={optionsHintFor(item)}
                quantity={getItemQuantity?.(item.id) ?? 0}
                onAdd={() => onAddItem(item)}
                onIncrement={() => onIncrementItem?.(item)}
                onDecrement={() => onDecrementItem?.(item)}
                onOpen={() => onOpenItem?.(item)}
              />
            ))}
          </TerceraCategorySection>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {groups.map((group, index) => {
        const { closed, note } = availabilityOf(group.category);
        return (
        <section
          key={`${group.category}-${index}`}
          aria-labelledby={`menu-cat-${index}`}
          className={closed ? "opacity-60" : undefined}
        >
          <h2
            id={`menu-cat-${index}`}
            className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-lg font-bold capitalize tracking-tight text-[#1C2526]"
          >
            <span className="h-5 w-1 self-center rounded-full bg-[#F28C38]" aria-hidden />
            {group.category.toLowerCase()}
            {note ? (
              <span className="text-xs font-semibold normal-case tracking-normal text-[#1C2526]/55">
                {closed ? "🕒 " : ""}{note}
              </span>
            ) : null}
          </h2>
          {closed ? (
            <button
              type="button"
              onClick={() => toggle(group.category)}
              aria-expanded={!!opened[group.category]}
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#1C2526]/15 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#1C2526]/80 hover:border-[#F28C38]/50"
            >
              {opened[group.category] ? "Ocultar" : `Ver los ${group.items.length} platillos`}
              <span aria-hidden>{opened[group.category] ? "▴" : "▾"}</span>
            </button>
          ) : null}
          <ul className={(closed && !opened[group.category] ? "hidden " : "") + "grid grid-cols-1 gap-3 lg:grid-cols-2"}>
            {group.items.map((item) => (
              <MenuItemCard
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                imageUrl={item.imageUrl}
                orderingEnabled={orderingEnabled && !closed}
                optionsHint={optionsHintFor(item)}
                quantity={getItemQuantity?.(item.id) ?? 0}
                onAdd={() => onAddItem(item)}
                onIncrement={() => onIncrementItem?.(item)}
                onDecrement={() => onDecrementItem?.(item)}
                onOpen={() => onOpenItem?.(item)}
              />
            ))}
          </ul>
        </section>
        );
      })}
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
  skin = null,
}: {
  restaurantId: string;
  rdata: Record<string, unknown>;
  items: MenuRow[];
  skin?: MenuSkinId | null;
}) {
  if (!hasRewardLadder(rdata)) return null;
  if (skin === "pecado") {
    return (
      <PecadoPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-bold text-[#a61c21] underline decoration-[#a61c21]/40 underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </PecadoPanel>
    );
  }
  if (skin === "laspic") {
    return (
      <LaspicPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-semibold text-[#d23f2c] underline decoration-[#d23f2c]/35 underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </LaspicPanel>
    );
  }
  if (skin === "mixteco") {
    return (
      <MixtecoPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-semibold text-[#2f7a50] underline decoration-[#2f7a50]/35 underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </MixtecoPanel>
    );
  }
  if (skin === "blooms") {
    return (
      <BloomsPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-extrabold uppercase tracking-[0.1em] text-[#e8407f] underline underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </BloomsPanel>
    );
  }
  if (skin === "negroblanco") {
    return (
      <NegroBlancoPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-semibold underline decoration-[#0b0b0b]/30 underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </NegroBlancoPanel>
    );
  }
  if (skin === "tercera") {
    return (
      <TerceraPanel title="Premios por regresar">
        <RewardLadder
          restaurantData={rdata}
          menuItems={items.map((i) => ({ name: i.name, imageUrl: i.imageUrl }))}
        />
        {restaurantPromisesPoints(rdata) ? (
          <a href={`/menu/${encodeURIComponent(restaurantId)}/puntos`} className="mt-3 inline-block text-sm font-bold underline decoration-dotted underline-offset-4">
            ¿Ya has comprado aquí? Ver mis puntos →
          </a>
        ) : null}
      </TerceraPanel>
    );
  }
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
      {restaurantPromisesPoints(rdata) ? (
        <a
          href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
          className="mt-3 inline-block text-sm font-semibold text-[#F28C38] underline-offset-2 hover:underline"
        >
          ¿Ya has comprado aquí? Ver mis puntos →
        </a>
      ) : null}
    </section>
  );
}

function MenuBottomDock({ children, skin = null }: { children: ReactNode; skin?: MenuSkinId | null }) {
  return (
    <div
      className={
        "fixed bottom-0 left-0 right-0 z-40 border-t px-4 py-2.5 backdrop-blur-md " +
        (skin === "pecado"
          ? "border-[#a61c21]/20 bg-[#ffeecf]/95 shadow-[0_-8px_32px_rgba(60,10,5,0.25)]"
          : skin === "negroblanco"
            ? "border-[#0b0b0b]/10 bg-[#f4f3ef]/95 shadow-[0_-12px_36px_-16px_rgba(0,0,0,0.3)]"
            : skin === "blooms"
              ? "border-[#ff5c9a]/20 bg-[#fff6f4]/95 shadow-[0_-12px_36px_-16px_rgba(232,64,127,0.35)]"
              : skin === "mixteco"
                ? "border-[#234933]/15 bg-[#f6f5e0]/95 shadow-[0_-12px_36px_-16px_rgba(20,50,35,0.55)]"
              : skin === "laspic"
                ? "border-[#141414]/15 bg-[#fbf8f2]/95 shadow-[0_-12px_36px_-16px_rgba(0,0,0,0.35)]"
              : "border-[#1C2526]/10 bg-[#FAF7F2]/95 shadow-[0_-8px_32px_rgba(28,37,38,0.08)]")
      }
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl">{children}</div>
    </div>
  );
}

function PublicMenuPageWithOrdering({
  restaurantId,
  initial,
  preview = false,
}: {
  restaurantId: string;
  initial: MenuInitialData | null;
  /** Solo /dev/piel: pinta el sembrado sin leer Firestore (vista previa de una piel). */
  preview?: boolean;
}) {
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
    // 250ms y no 700: el debounce solo protege contra taps consecutivos al
    // carrito; cada 100ms de espera aquí es 100ms de tarjeta en blanco en el
    // checkout (la función con IA ya tarda lo suyo en frío).
    const t = setTimeout(
      () => warmUpsellSuggestion(restaurantId, upsellIds.split(",")),
      250,
    );
    return () => clearTimeout(t);
  }, [restaurantId, upsellIds]);

  // Con `initial` (SSR) el primer paint ya trae el menú; sin él, el flujo
  // clásico de spinner. El fetch client corre IGUAL en los dos casos.
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>(
    initial ? seedName(initial.raw) : "",
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    initial ? getRestaurantImageUrl(initial.raw) : null,
  );
  /** Portada (coverImageUrl) — la misma que la app y /r (9-sep). */
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initial ? getRestaurantBannerUrl(initial.raw) : null,
  );
  /** Platillo abierto en la hoja de detalle (tocar tarjeta/foto). */
  const [detailItem, setDetailItem] = useState<MenuRow | null>(null);
  /** Color de marca y lema impreso (8-sep) — lib/brand/brandColor.ts. */
  const [brand, setBrand] = useState<BrandTheme>(brandThemeFromRestaurant(initial?.raw));
  /** Piel del local (10-sep): el papel de Tercera o la de siempre. */
  const [skin, setSkin] = useState<MenuSkinId | null>(menuSkinFromRestaurant(initial?.raw));
  const [tagline, setTagline] = useState<string | null>(taglineFromRestaurant(initial?.raw));
  const [firstVisitReward, setFirstVisitReward] = useState<string | null>(
    initial ? firstVisitRewardLabelFromRestaurant(initial.raw) : null,
  );
  /** Premios apagados (5-sep): sin nada que ganar, el menú no vende puntos. */
  const [loyaltyLive, setLoyaltyLive] = useState<boolean>(
    initial ? restaurantPromisesPoints(initial.raw) : true,
  );
  const [items, setItems] = useState<MenuRow[]>(
    initial ? seedItems(initial.menu, initial.raw) : [],
  );
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [address, setAddress] = useState<string | null>(
    initial ? seedAddress(initial.raw) : null,
  );
  /** Doc completo del restaurante (para la escalera de premios fantasma). */
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(
    initial?.raw ?? null,
  );
  /** Ventanas por categoría (AM/PM) y un reloj por minuto para que la
   *  sección se apague sola a las 12:00 sin recargar. */
  const windows = useMemo(() => categoryWindowsFromRestaurant(rdata), [rdata]);
  // null en el server (vive en UTC): el HTML sale con TODO el menú y Google lo
  // lee; en el navegador se pone la hora local y ahí se apaga/pliega.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const categoryClosedNow = (category: string) => {
    if (!now) return false;
    const a = categoryAvailability(category, windows, now);
    return !a.always && !a.openNow;
  };
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

    // Vista previa local de una piel (/dev/piel): sin Firestore, solo el sembrado.
    if (preview) {
      if (initial) setSchedule(scheduleStatus(initial.raw));
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // Sembrado desde el server: no se regresa al spinner — el refresh
      // entra en silencio sobre el menú ya pintado.
      if (initial === null) setLoading(true);
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
        setBannerUrl(getRestaurantBannerUrl(rData));
        setBrand(brandThemeFromRestaurant(rData));
        setSkin(menuSkinFromRestaurant(rData));
        setTagline(taglineFromRestaurant(rData));
        setFirstVisitReward(firstVisitRewardLabelFromRestaurant(rData));
        setLoyaltyLive(restaurantPromisesPoints(rData));
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
        const available = sortMenuRows(rows.filter((r) => r.isAvailable), rData);
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
  }, [restaurantId, initial, preview]);

  // Dice solo lo que el local ofrece de verdad (Mercado Pago, al recoger,
  // o nada) — lib/order/menuPaymentLine.ts, con candado.
  const headerSecondary = menuPaymentLine({
    restaurantId,
    rdata,
    closedNow,
    webOrderingReady,
    webOrderingAvailable,
  });

  const showMpUnavailableDock =
    webOrderingReady && !webOrderingAvailable && !loading && !error;

  /** El "+" de la tarjeta y el "Agregar" de la hoja de detalle: con opciones
   *  abre la hoja de opciones; sin opciones agrega directo. */
  const handleAddItem = (item: MenuRow) => {
    if (categoryClosedNow(item.category)) return; // fuera de su hora: se ve, no se pide
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
  };

  const categoryGroups = groupMenuByCategory(items);
  // Cerrado (positivo) = el menú se VE, pero no se puede ordenar.
  const orderingEnabled = webOrderingReady && webOrderingAvailable && !closedNow;

  return (
    <div className={pageClassFor(skin)}>
      <MenuRestaurantHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        secondarySubtitle={headerSecondary}
        schedule={schedule}
        address={address}
        loyaltyLive={loyaltyLive}
        brand={brand}
        tagline={tagline}
        skin={skin}
      />

      {/* §6.10: si quien mira es EL DUEÑO y no hay horario, la ausencia se
          le señala en su propia vitrina. Invisible para clientes. */}
      <OwnerHoursStrip rdata={rdata} />

      {/* Llegó por el QR de su mesa: se le dice de una, para que sepa que el
          pedido va a su mesa y no tiene que ir por él. */}
      {tableNumber ? (
        <div
          className="px-4 pt-3 sm:px-6"
          role="status"
        >
          <div
            className="mx-auto max-w-3xl rounded-2xl px-4 py-2.5 lg:max-w-4xl"
            style={{
              background: "rgba(242,140,56,0.1)",
              border: "1px solid rgba(242,140,56,0.3)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[18px]">🍽️</span>
              <p className="text-[13px] font-semibold text-[#1C2526]">
                Estás en la mesa{" "}
                <span className="text-[#F28C38]">{tableNumber}</span> — pide
                desde aquí y te lo llevamos.
              </p>
            </div>
            {/* Robo #5: mesero y cuenta a un tap, cooldown 30s. */}
            <TableServiceButtons
              restaurantId={restaurantId}
              tableNumber={tableNumber}
            />
          </div>
        </div>
      ) : null}

      <main
        className={
          "mx-auto w-full " + mainWidthFor(skin) + " px-4 pt-5 sm:px-6 sm:pt-6 " +
          (webOrderingReady ? "pb-[220px] sm:pb-[200px]" : "pb-28")
        }
      >
        {!loading && bannerUrl ? <MenuCoverBanner url={bannerUrl} name={restaurantName} skin={skin} /> : null}
        {loading && <MenuStatusMessage>Cargando menú…</MenuStatusMessage>}

        {!loading && error && <MenuStatusMessage tone="error">{error}</MenuStatusMessage>}

        {!loading && !error && items.length === 0 && (
          <MenuStatusMessage>No hay platillos disponibles</MenuStatusMessage>
        )}

        {/* El premio de bienvenida, en el FLUJO y no pegado abajo.
            Aquí empuja el contenido en vez de taparlo, se lee al entrar —
            que es cuando todavía puede cambiar lo que pides — y se va con el
            scroll. Una barra fija es para ACCIONES; esto es información, y la
            información se lee una vez. */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-5">
            <MenuAppRewardsCta
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              variant="banner"
              firstVisitRewardLabel={firstVisitReward}
              loyaltyLive={loyaltyLive}
              skin={skin}
            />
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <MenuCategoryChips
            skin={skin}
            chips={categoryGroups.map((g, index) => {
              const a = now ? categoryAvailability(g.category, windows, now) : null;
              return { category: g.category, index, closed: a ? !a.always && !a.openNow : false };
            })}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <MenuCategoryList
            groups={categoryGroups}
            skin={skin}
            windows={windows}
            now={now}
            orderingEnabled={orderingEnabled}
            getItemQuantity={(itemId) => quantityByItemId.get(itemId) ?? 0}
            onOpenItem={(item) => setDetailItem(item)}
            onAddItem={handleAddItem}
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
            skin={skin}
          />
        ) : null}

        {!loading && !error ? <MenuPoweredByFooter skin={skin} restaurantId={restaurantId} /> : null}
      </main>

      <MenuItemDetailSheet
        skin={skin}
        open={detailItem !== null}
        name={detailItem?.name ?? ""}
        description={detailItem?.description ?? null}
        price={detailItem?.price ?? 0}
        imageUrl={detailItem?.imageUrl ?? null}
        optionsHint={detailItem ? optionsHintFor(detailItem) : null}
        orderingEnabled={orderingEnabled && !(detailItem && categoryClosedNow(detailItem.category))}
        onClose={() => setDetailItem(null)}
        onAdd={() => {
          if (!detailItem) return;
          const it = detailItem;
          setDetailItem(null);
          handleAddItem(it);
        }}
      />

      <ItemOptionsSheet
          skin={skin}
          open={pendingItem !== null}
          itemName={pendingItem?.name ?? ""}
          basePrice={pendingItem?.price ?? 0}
          groups={pendingItem?.groups ?? []}
          onCancel={() => setPendingItem(null)}
          onConfirm={(selected: SelectedOptionGroup[], quantity: number) => {
            if (!pendingItem) return;
            addItem(
              {
                menuItemId: pendingItem.id,
                name: pendingItem.name,
                price: pendingItem.price,
                imageUrl: pendingItem.imageUrl,
                selectedOptions: selected,
              },
              quantity,
            );
            setPendingItem(null);
          }}
      />


      {!closedNow && (
        <CartBar
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          firstVisitRewardLabel={firstVisitReward}
              loyaltyLive={loyaltyLive}
              skin={skin}
        />
      )}

      {closedNow && !loading && !error ? (
        <MenuBottomDock skin={skin}>
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
              loyaltyLive={loyaltyLive}
              skin={skin}
          />
        </MenuBottomDock>
      ) : showMpUnavailableDock ? (
        <MenuBottomDock skin={skin}>
          <MenuAppRewardsCta
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            variant="banner"
            firstVisitRewardLabel={firstVisitReward}
              loyaltyLive={loyaltyLive}
              skin={skin}
          />
        </MenuBottomDock>
      ) : null}
    </div>
  );
}

function PublicMenuPageBrowseOnly({
  restaurantId,
  initial,
  preview = false,
}: {
  restaurantId: string;
  initial: MenuInitialData | null;
  /** Solo /dev/piel: pinta el sembrado sin leer Firestore (vista previa de una piel). */
  preview?: boolean;
}) {
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>(
    initial ? seedName(initial.raw) : "",
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    initial ? getRestaurantImageUrl(initial.raw) : null,
  );
  /** Portada (coverImageUrl) — la misma que la app y /r (9-sep). */
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initial ? getRestaurantBannerUrl(initial.raw) : null,
  );
  /** Platillo abierto en la hoja de detalle (tocar tarjeta/foto). */
  const [detailItem, setDetailItem] = useState<MenuRow | null>(null);
  /** Color de marca y lema impreso (8-sep) — lib/brand/brandColor.ts. */
  const [brand, setBrand] = useState<BrandTheme>(brandThemeFromRestaurant(initial?.raw));
  /** Piel del local (10-sep): el papel de Tercera o la de siempre. */
  const [skin, setSkin] = useState<MenuSkinId | null>(menuSkinFromRestaurant(initial?.raw));
  const [tagline, setTagline] = useState<string | null>(taglineFromRestaurant(initial?.raw));
  const [firstVisitReward, setFirstVisitReward] = useState<string | null>(
    initial ? firstVisitRewardLabelFromRestaurant(initial.raw) : null,
  );
  /** Premios apagados (5-sep): sin nada que ganar, el menú no vende puntos. */
  const [loyaltyLive, setLoyaltyLive] = useState<boolean>(
    initial ? restaurantPromisesPoints(initial.raw) : true,
  );
  const [items, setItems] = useState<MenuRow[]>(
    initial ? seedItems(initial.menu, initial.raw) : [],
  );
  const [menuLinkResolved, setMenuLinkResolved] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [address, setAddress] = useState<string | null>(
    initial ? seedAddress(initial.raw) : null,
  );
  /** Doc completo del restaurante (para la escalera de premios fantasma). */
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(
    initial?.raw ?? null,
  );
  /** Ventanas por categoría (AM/PM) y un reloj por minuto para que la
   *  sección se apague sola a las 12:00 sin recargar. */
  const windows = useMemo(() => categoryWindowsFromRestaurant(rdata), [rdata]);
  // null en el server (vive en UTC): el HTML sale con TODO el menú y Google lo
  // lee; en el navegador se pone la hora local y ahí se apaga/pliega.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  // (solo-ver: sin carrito, no hace falta el guardia por categoría)

  useEffect(() => {
    if (!restaurantId) {
      setError("Falta el id del restaurante");
      setLoading(false);
      setMenuLinkResolved(true);
      return;
    }

    // Vista previa local de una piel (/dev/piel): sin Firestore, solo el sembrado.
    if (preview) {
      if (initial) setSchedule(scheduleStatus(initial.raw));
      setLoading(false);
      setMenuLinkResolved(true);
      return;
    }

    let cancelled = false;

    (async () => {
      // Sembrado desde el server: sin regreso al spinner (ver WithOrdering).
      if (initial === null) setLoading(true);
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
        setBannerUrl(getRestaurantBannerUrl(rData));
        setBrand(brandThemeFromRestaurant(rData));
        setSkin(menuSkinFromRestaurant(rData));
        setTagline(taglineFromRestaurant(rData));
        setFirstVisitReward(firstVisitRewardLabelFromRestaurant(rData));
        setLoyaltyLive(restaurantPromisesPoints(rData));
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
        const available = sortMenuRows(rows.filter((r) => r.isAvailable), rData);
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
  }, [restaurantId, initial, preview]);

  const categoryGroups = groupMenuByCategory(items);

  return (
    <div className={pageClassFor(skin)}>
      <MenuRestaurantHeader
        loading={loading}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        schedule={schedule}
        address={address}
        loyaltyLive={loyaltyLive}
        brand={brand}
        tagline={tagline}
        skin={skin}
      />

      <main className={"mx-auto w-full " + mainWidthFor(skin) + " px-4 pt-5 pb-[200px] sm:px-6 sm:pt-6 sm:pb-[180px]"}>
        {!loading && bannerUrl ? <MenuCoverBanner url={bannerUrl} name={restaurantName} skin={skin} /> : null}
        {loading && <MenuStatusMessage>Cargando menú…</MenuStatusMessage>}
        {!loading && error && <MenuStatusMessage tone="error">{error}</MenuStatusMessage>}
        {!loading && !error && items.length === 0 && (
          <MenuStatusMessage>No hay platillos disponibles</MenuStatusMessage>
        )}
        {!loading && !error && items.length > 0 && (
          <MenuCategoryChips
            skin={skin}
            chips={categoryGroups.map((g, index) => {
              const a = now ? categoryAvailability(g.category, windows, now) : null;
              return { category: g.category, index, closed: a ? !a.always && !a.openNow : false };
            })}
          />
        )}
        {!loading && !error && items.length > 0 && (
          <MenuCategoryList
            groups={categoryGroups}
            skin={skin}
            windows={windows}
            now={now}
            orderingEnabled={false}
            onAddItem={() => {}}
            onOpenItem={(item) => setDetailItem(item)}
          />
        )}

        {!loading && !error && rdata ? (
          <MenuRewardsLadderSection
            restaurantId={restaurantId}
            rdata={rdata}
            items={items}
            skin={skin}
          />
        ) : null}

        {!loading && !error ? <MenuPoweredByFooter skin={skin} restaurantId={restaurantId} /> : null}
      </main>

      <MenuItemDetailSheet
        skin={skin}
        open={detailItem !== null}
        name={detailItem?.name ?? ""}
        description={detailItem?.description ?? null}
        price={detailItem?.price ?? 0}
        imageUrl={detailItem?.imageUrl ?? null}
        optionsHint={detailItem ? optionsHintFor(detailItem) : null}
        orderingEnabled={false}
        onClose={() => setDetailItem(null)}
        onAdd={() => setDetailItem(null)}
      />

      <MenuBottomDock skin={skin}>
        <MenuAppRewardsCta
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          variant="browse"
          disabled={!menuLinkResolved}
          firstVisitRewardLabel={firstVisitReward}
              loyaltyLive={loyaltyLive}
              skin={skin}
        />
      </MenuBottomDock>
    </div>
  );
}

export default function MenuView({
  restaurantId,
  initial,
  preview = false,
}: {
  restaurantId: string;
  initial: MenuInitialData | null;
  /** Solo /dev/piel: pinta el sembrado sin leer Firestore (vista previa de una piel). */
  preview?: boolean;
}) {
  if (isWebOrderingEnabled()) {
    return (
      <PublicMenuPageWithOrdering restaurantId={restaurantId} initial={initial} preview={preview} />
    );
  }
  return <PublicMenuPageBrowseOnly restaurantId={restaurantId} initial={initial} preview={preview} />;
}
