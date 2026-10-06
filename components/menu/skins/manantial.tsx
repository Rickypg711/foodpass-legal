"use client";

/**
 * Piel "Manantial" del menú público — Paletería y Heladería "El Manantial", La Original
 * (Av. Paseo del Real 1701, Villas del Real, Chihuahua). Decimotercera piel (6-oct-2026).
 *
 * Fuente: no hay carta impresa. Hay una cosa suya y de ahí sale todo: SU FACHADA, como se ve en Street View
 * (jul-2024, `outreach/2026-10-06-el-manantial/fachada-streetview-jul-2024.jpg` en FOODPASS):
 *  - La pared MORADA (#7b3fa6) de arriba a abajo, con el marco blanco de la vitrina y la puerta.
 *  - El letrero: "Paletería y Heladería" en azul sobre un listón blanco en arco; "El Manantial" en letras
 *    blancas de bomba con contorno y sombra AZUL REY (#1d4ed8); una bola de helado de chocolate con su crema
 *    encima de la "a"; "La Original" abajo; y la crema escurriendo del letrero sobre la pared.
 *  - Adentro: blanco de nevería (azulejo, mostrador). Por eso cada sección es una "vitrina" blanca con el marco
 *    blanco grueso, y su título va en el morado, en letras de bomba con la crema escurriendo, como el letrero.
 *  - Los tamaños (sencilla · doble · triple, chico · mediano · grande) se juntan en un renglón, como en la
 *    cartulina de precios de cualquier nevería.
 *
 * Cuando Ricardo consiga la foto de la CARTULINA de precios, la composición de las familias y los precios se
 * copia de ahí. La lógica (carrito, opciones, detalle) es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Baloo_2, Nunito } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./manantial.css";

const baloo = Baloo_2({ weight: ["700", "800"], subsets: ["latin"], variable: "--mn-display" });
const nunito = Nunito({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--mn-sans" });

export const MN_ROOT_CLASS =
  `${baloo.variable} ${nunito.variable} ` +
  "mn-skin min-h-screen text-[#2a1740] antialiased [font-family:var(--mn-sans),Nunito,system-ui,sans-serif]";

/** Letras de bomba del letrero: títulos y botones grandes. */
export const MN_TITLE = "[font-family:var(--mn-display),'Baloo_2',Nunito,sans-serif] font-extrabold";
/** Nombres de cosa: la misma bomba, un poco más seria. */
export const MN_NAME = "[font-family:var(--mn-display),'Baloo_2',Nunito,sans-serif] font-bold";

export const MANANTIAL = {
  purple: "#7b3fa6",
  purpleDark: "#5b2a80",
  purpleLight: "#a86fd0",
  blue: "#1d4ed8",
  blueDark: "#163a9e",
  white: "#ffffff",
  cream: "#f7ecd4",
  choco: "#5a3222",
  ink: "#2a1740",
};

export function mnKeyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Si todos los platillos de la sección dicen lo mismo, va una vez bajo el título. */
export function mnSharedDescription(items: { description: string | null }[]): string | null {
  if (items.length < 2) return null;
  const first = items[0]?.description?.trim();
  if (!first) return null;
  return items.every((i) => i.description?.trim() === first) ? first : null;
}

/* ─────────────── Tamaños: "Nieve sencilla / doble / triple" → un renglón con sus pastillas ─────────────── */

const SIZE_RE =
  /^(.+?)\s+(sencill[oa]s?|dobles?|triples?|chic[oa]s?|median[oa]s?|grandes?|charola|troles|especial(?:es)?|(?:½|1\/2|medio)\s*(?:litro|lt|l)|1\s*(?:litro|lt|l)|litro)$/i;

const SIZE_ORDER: [RegExp, number][] = [
  [/^(chic|sencill|troles)/i, 0],
  [/^(median|doble)/i, 1],
  [/^(grande|triple|especial)/i, 2],
  [/^(½|1\/2|medio)/i, 3],
  [/^(1|litro)/i, 4],
  [/^charola/i, 5],
];
function sizeRank(label: string, price: number): number {
  for (const [re, n] of SIZE_ORDER) if (re.test(label)) return n * 10000 + price;
  return 90000 + price;
}
function sizeLabel(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (/^(½|1\/2|medio)\s*(litro|lt|l)$/i.test(s)) return "½ L";
  if (/^1\s*(litro|lt|l)$/i.test(s) || /^litro$/i.test(s)) return "1 L";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export type MnRow<T> = { kind: "single"; item: T } | { kind: "sizes"; base: string; sizes: { label: string; item: T }[] };

export function mnRowsOf<T extends { name: string; price: number }>(items: T[]): MnRow<T>[] {
  const count = new Map<string, number>();
  for (const it of items) {
    const m = SIZE_RE.exec(it.name.trim());
    if (m) count.set(mnKeyOf(m[1]!), (count.get(mnKeyOf(m[1]!)) ?? 0) + 1);
  }
  const rows: MnRow<T>[] = [];
  const byBase = new Map<string, Extract<MnRow<T>, { kind: "sizes" }>>();
  for (const it of items) {
    const m = SIZE_RE.exec(it.name.trim());
    const key = m ? mnKeyOf(m[1]!) : null;
    if (!m || !key || (count.get(key) ?? 0) < 2) {
      rows.push({ kind: "single", item: it });
      continue;
    }
    let row = byBase.get(key);
    if (!row) {
      row = { kind: "sizes", base: m[1]!.trim(), sizes: [] };
      byBase.set(key, row);
      rows.push(row);
    }
    row.sizes.push({ label: sizeLabel(m[2]!), item: it });
  }
  for (const r of rows) if (r.kind === "sizes") r.sizes.sort((a, b) => sizeRank(a.label, a.item.price) - sizeRank(b.label, b.item.price));
  return rows;
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address.replace(/\s+\d{5}\s*$/, "");
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/** El precio: "$" chiquito y el número en bomba, en el azul del letrero. */
function Price({ value, className = "" }: { value: number; className?: string }) {
  const whole = Number.isInteger(value);
  return (
    <span className={`${MN_NAME} shrink-0 tabular-nums leading-none text-[#1d4ed8] ${className}`}>
      {whole ? (
        <>
          <span className="mr-[1px] text-[0.7em] opacity-75">$</span>
          {value}
        </>
      ) : (
        formatPrice(value)
      )}
    </span>
  );
}

/** La bola de helado de chocolate del letrero, con su crema. */
export function MnScoop({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <ellipse cx="32" cy="50" rx="22" ry="7" fill="#f7ecd4" />
      <circle cx="32" cy="30" r="21" fill="#5a3222" />
      <path d="M14 30c4-8 10-12 18-12s14 4 18 12c-2-10-9-17-18-17S16 20 14 30z" fill="#7a4a33" />
      <path d="M22 44c3 4 7 6 10 6s7-2 10-6c-2 2-5 3-10 3s-8-1-10-3z" fill="#3e2015" />
      <circle cx="24" cy="22" r="3" fill="#8f6049" opacity="0.8" />
    </svg>
  );
}

/** La crema escurriendo del letrero (borde de abajo del morado). */
function Drip({ className = "", fill = "#f7ecd4" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden className={className}>
      <path
        d="M0 0h400v9c-10 0-14 10-22 10s-8-8-18-8-10 14-20 14-9-12-18-12-10 6-20 6-9-14-20-14-10 10-22 10-8-6-18-6-12 12-22 12-8-10-20-10-9 7-18 7-11-10-22-10-10 8-20 8-11-12-22-12-8 6-18 6-11-8-22-8-9 12-20 12-9-9-18-9-10 8-20 8-11-6-21-6V0z"
        fill={fill}
      />
    </svg>
  );
}

/** Título en letras de bomba blancas con el contorno y la sombra azul del letrero. */
function Bubble({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`${MN_TITLE} mn-bubble text-center text-[26px] leading-none tracking-[0.01em] text-white sm:text-[30px] ${className}`}>
      {children}
    </h2>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function ManantialHeader({
  loading,
  restaurantName,
  tagline,
  schedule,
  address,
}: {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  tagline?: string | null;
  schedule?: ScheduleStatus | null;
  address?: string | null;
  secondarySubtitle?: string | null;
}) {
  const name = loading ? "El Manantial" : restaurantName || "El Manantial";
  return (
    <header className="mn-wall mn-rise -mx-4 -mt-4 overflow-hidden px-4 pb-0 pt-6 sm:-mx-6 sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-3xl text-center">
        {/* El listón blanco en arco: "Paletería y Heladería" en azul. */}
        <svg viewBox="0 0 320 76" className="mx-auto block h-[62px] w-[262px] sm:h-[70px] sm:w-[296px]" aria-hidden>
          <defs>
            <path id="mn-arc" d="M28 64 Q160 -6 292 64" />
          </defs>
          {/* El listón: una banda blanca con filo azul, en arco, y el texto azul montado en ella. */}
          <path d="M28 64 Q160 -6 292 64" fill="none" stroke="#1d4ed8" strokeWidth="32" strokeLinecap="round" />
          <path d="M28 64 Q160 -6 292 64" fill="none" stroke="#fff" strokeWidth="27" strokeLinecap="round" />
          <text fontSize="16.5" fontWeight="800" fill="#1d4ed8" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--mn-display), 'Baloo 2', Nunito, sans-serif" letterSpacing="0.3">
            <textPath href="#mn-arc" startOffset="50%">
              Paletería y Heladería
            </textPath>
          </text>
        </svg>
        <div className="relative -mt-1 inline-block">
          <MnScoop className="mn-scoop absolute -top-6 right-[6%] h-11 w-11 sm:-top-7 sm:h-12 sm:w-12" />
          <h1 className={`${MN_TITLE} mn-bubble mn-bubble--big px-4 text-[44px] leading-[0.95] text-white sm:text-[58px]`}>{name}</h1>
        </div>
        <p className={`${MN_NAME} mn-bubble mt-1 text-[15px] leading-none tracking-[0.04em] text-white sm:text-[17px]`}>
          {!loading && tagline?.trim() ? tagline.trim() : "La Original"}
        </p>
        {!loading ? (
          <div className="mt-5 flex flex-col items-center gap-2 pb-7">
            {schedule ? (
              <span
                className={
                  `${MN_NAME} inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-[6px] text-[12.5px] uppercase tracking-[0.06em] ` +
                  (schedule.open ? "border-white bg-white text-[#5b2a80]" : "border-white/60 bg-transparent text-white")
                }
              >
                <span className={"h-2 w-2 rounded-full " + (schedule.open ? "mn-live bg-[#1d4ed8]" : "bg-white/70")} aria-hidden />
                {schedule.label}
              </span>
            ) : null}
            {address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-bold text-white/90 underline decoration-white/40 underline-offset-4 hover:text-white"
              >
                <span className="min-w-0 truncate">{shortAddress(address)}</span>
                <span aria-hidden className="shrink-0">↗</span>
              </a>
            ) : null}
          </div>
        ) : (
          <div className="pb-7" />
        )}
      </div>
      <Drip className="-mx-4 block h-6 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]" />
    </header>
  );
}

/* ─────────────────────────── Hoja ─────────────────────────── */

export function ManantialSheet({ children }: { children: ReactNode }) {
  return <div className="mn-sheet pb-6">{children}</div>;
}

function AddButton({ name, onAdd, small = false }: { name: string; onAdd: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "mn-add flex shrink-0 items-center justify-center rounded-full font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
        (small ? "h-8 w-8 text-[20px]" : "h-10 w-10 text-[24px]")
      }
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement, small = false }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void; small?: boolean }) {
  const h = small ? "h-8 w-7 text-lg" : "h-10 w-9 text-xl";
  return (
    <div className="mn-stepper flex shrink-0 items-center rounded-full">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className={`flex items-center justify-center font-bold ${h}`}>
        −
      </button>
      <span className={`${MN_NAME} min-w-[1.2rem] text-center text-[15px] tabular-nums`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className={`flex items-center justify-center font-bold ${h}`}>
        +
      </button>
    </div>
  );
}

/* ─────────────────────────── Sección: una vitrina por familia ─────────────────────────── */

export function ManantialCategorySection({
  category,
  index,
  children,
  description = null,
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
}: {
  category: string;
  index: number;
  children: ReactNode;
  description?: string | null;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const id = `menu-cat-${index}`;
  return (
    <section
      aria-labelledby={id}
      data-mn={mnKeyOf(category)}
      className={"mn-vitrina mn-rise " + (closed ? "opacity-60" : "")}
      style={{ animationDelay: `${Math.min(index, 6) * 70 + 160}ms` } as CSSProperties}
    >
      {/* El letrero de la vitrina: morado, letras de bomba y la crema escurriendo. */}
      <div className="mn-vitrina__head px-4 pb-1 pt-4 sm:px-6">
        <Bubble id={id}>{category}</Bubble>
        {description ? <p className="mx-auto mt-2 max-w-md text-center text-[13.5px] font-semibold leading-snug text-white/85 [text-wrap:balance]">{description}</p> : null}
        {note ? (
          <p className="mt-2 text-center text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#f7ecd4]">
            {closed ? "🕒 " : ""}
            {note}
          </p>
        ) : null}
        {closed && onToggle ? (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              className={`${MN_NAME} rounded-full border-2 border-white/70 px-3.5 py-1.5 text-[12px] uppercase tracking-[0.08em] text-white hover:bg-white/10`}
            >
              {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
            </button>
          </div>
        ) : null}
      </div>
      <Drip className="block h-5 w-full" fill="#7b3fa6" />
      {collapsed ? null : <ul className="mn-vitrina__body divide-y divide-[#7b3fa6]/12 px-4 pb-3 pt-1 sm:px-6">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglones ─────────────────────────── */

/** Una cosa: su foto a la izquierda, NOMBRE ····· $precio, "Elige sabor" y la descripción. */
export function ManantialItemRow({
  name,
  description,
  price,
  imageUrl,
  onAdd,
  quantity = 0,
  onIncrement,
  onDecrement,
  orderingEnabled = true,
  optionsHint = null,
  onOpen,
  hideDescription = false,
}: MenuItemCardProps & { index?: number; hideDescription?: boolean }) {
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  const desc = hideDescription ? null : description?.trim() || null;
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const text = (
    <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="block w-full min-w-0 cursor-pointer text-left">
      <span className="flex items-end gap-2">
        <span className={`${MN_NAME} min-w-0 text-[17px] leading-[1.15] text-[#2a1740] sm:text-[18px]`}>{name}</span>
        <span className="mn-dots" aria-hidden />
        <Price value={price} className="text-[18px] sm:text-[19px]" />
      </span>
      {hint ? (
        <span className={`${MN_NAME} mt-1.5 inline-flex items-center rounded-full border-[1.5px] border-[#7b3fa6]/50 bg-[#7b3fa6]/8 px-2.5 py-[3px] text-[10.5px] uppercase tracking-[0.08em] text-[#5b2a80]`}>
          {hint}
        </span>
      ) : null}
      {desc ? <span className="mt-1 block pr-1 text-[13.5px] leading-snug text-[#2a1740]/70">{desc}</span> : null}
    </button>
  );
  if (imageUrl) {
    return (
      <li className={"mn-row -mx-2 flex items-start gap-3 px-2 py-3 " + (quantity > 0 ? "mn-row--on" : "")}>
        <button type="button" onClick={onOpen} aria-label={`Ver foto de ${name}`} className="mn-photo mt-0.5 h-[84px] w-[84px] shrink-0 cursor-zoom-in sm:h-24 sm:w-24">
          <Image src={imageUrl} alt="" width={192} height={192} unoptimized className="h-full w-full object-cover" />
        </button>
        <div className="min-w-0 flex-1">
          {text}
          {control ? <div className="mt-2 flex justify-end">{control}</div> : null}
        </div>
      </li>
    );
  }
  return (
    <li className={"mn-row -mx-2 flex items-center gap-3 px-2 py-3 " + (quantity > 0 ? "mn-row--on" : "")}>
      <div className="min-w-0 flex-1">{text}</div>
      {control}
    </li>
  );
}

export type MnSizeCell = {
  id: string;
  label: string;
  fullName: string;
  price: number;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onOpen: () => void;
};

/** Una cosa con tamaños: NIEVE y sus pastillas "Sencilla $22 · Doble $32 · Triple $37", como la cartulina. */
export function ManantialSizeRow({
  name,
  description = null,
  sizes,
  orderingEnabled = true,
  optionsHint = null,
}: {
  name: string;
  description?: string | null;
  sizes: MnSizeCell[];
  orderingEnabled?: boolean;
  optionsHint?: string | null;
}) {
  const any = sizes.some((s) => s.quantity > 0);
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  return (
    <li className={"mn-row -mx-2 px-2 py-3 " + (any ? "mn-row--on" : "")}>
      <button type="button" onClick={sizes[0]?.onOpen} aria-label={`Ver ${name}`} className="block w-full cursor-pointer text-left">
        <span className={`${MN_NAME} text-[17px] leading-[1.15] text-[#2a1740] sm:text-[18px]`}>{name}</span>
        {hint ? (
          <span className={`${MN_NAME} ml-2 inline-flex items-center rounded-full border-[1.5px] border-[#7b3fa6]/50 bg-[#7b3fa6]/8 px-2.5 py-[3px] text-[10.5px] uppercase tracking-[0.08em] text-[#5b2a80]`}>
            {hint}
          </span>
        ) : null}
        {description ? <span className="mt-1 block text-[13.5px] leading-snug text-[#2a1740]/70">{description}</span> : null}
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
        {sizes.map((s) => (
          <div key={s.id} className={"mn-size flex items-center gap-1.5 py-[3px] pl-3 pr-[3px] " + (s.quantity > 0 ? "mn-size--on" : "")}>
            <span className={`${MN_NAME} text-[12.5px] leading-none text-[#5b2a80]`}>{s.label}</span>
            <Price value={s.price} className="text-[15.5px]" />
            {!orderingEnabled ? (
              <span className="w-1.5" aria-hidden />
            ) : s.quantity > 0 ? (
              <Stepper name={s.fullName} quantity={s.quantity} onIncrement={s.onIncrement} onDecrement={s.onDecrement} small />
            ) : (
              <AddButton name={s.fullName} onAdd={s.onAdd} small />
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

/** Tarjeta de premios: otra vitrina con su letrero. */
export function ManantialPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mn-vitrina mn-rise mt-10" aria-label={title}>
      <div className="mn-vitrina__head px-4 pb-1 pt-4 sm:px-6">
        <Bubble>{title}</Bubble>
      </div>
      <Drip className="block h-5 w-full" fill="#7b3fa6" />
      <div className="mn-vitrina__body px-4 pb-5 pt-2 text-[#2a1740] sm:px-6">{children}</div>
    </section>
  );
}
