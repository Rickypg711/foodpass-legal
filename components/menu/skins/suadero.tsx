"use client";

/**
 * Piel "Suadero" del menú público — Tacos de Suadero La Familia (Mineral Pinos Altos 1529, Chihuahua; David).
 * Duodécima piel (6-oct-2026). Es el local que MÁS pedidos web recibe y traía la piel genérica.
 *
 * Fuente: no hay PDF ni hoja. Hay dos cosas suyas y de ahí sale todo:
 *  - SU LOGO (Canva): el charrito con sombrero y delantal sobre tablones de madera, "TACOS DE SUADERO" y
 *    "LA FAMILIA" en letras western crema. De ahí la madera (#612f18 / #9f4c24 / #d99c69), la crema (#f0e9d3) y
 *    el rojo-naranja del sombrero (#c6361c / #d5984c), sacados del propio archivo con el histograma.
 *  - SU PUESTO, como se ve en su Facebook y como Ricardo lo fijó el 9-sep: plato de unicel blanco, mostrador
 *    blanco, mantel rosa de cuadritos en la orilla, luz de tubo. Por eso el fondo es el mantel de cuadritos y
 *    cada sección es un "plato" blanco.
 *  - Los títulos van en letreros de madera (tabla oscura con letras crema y sus dos clavos), como el letrero del
 *    puesto. Las 14 fotos son las de David (vienen en cada platillo desde Firestore), la portada es su comal.
 *
 * Cuando Ricardo consiga la foto de la LONA, la composición de las familias y los precios se copia de ahí.
 * La lógica (carrito, opciones, detalle) es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Rye, Alfa_Slab_One, Nunito } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./suadero.css";
import "./skinTokens.generated.css";

const rye = Rye({ weight: "400", subsets: ["latin"], variable: "--sd-display" });
const alfa = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--sd-name" });
const nunito = Nunito({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--sd-sans" });

export const SD_ROOT_CLASS =
  `${rye.variable} ${alfa.variable} ${nunito.variable} ` +
  "sd-skin min-h-screen text-[#3a2314] antialiased [font-family:var(--sd-sans),Nunito,system-ui,sans-serif]";

/** Letras western del logo: títulos de sección y botones grandes. */
export const SD_TITLE = "[font-family:var(--sd-display),Rye,'Playbill',serif] font-normal uppercase";
/** Nombres de platillo: slab gorda, de letrero de puesto. */
export const SD_NAME = "[font-family:var(--sd-name),'Alfa_Slab_One',Rockwell,serif] font-normal";

export const SUADERO = {
  wood: "#612f18",
  woodMid: "#9f4c24",
  woodLight: "#d99c69",
  cream: "#f0e9d3",
  red: "#c6361c",
  orange: "#d5984c",
  pink: "#f3b6c6",
  ink: "#3a2314",
};

export function sdKeyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Si todos los platillos de la sección dicen lo mismo, va una vez bajo el letrero. */
export function sdSharedDescription(items: { description: string | null }[]): string | null {
  if (items.length < 2) return null;
  const first = items[0]?.description?.trim();
  if (!first) return null;
  return items.every((i) => i.description?.trim() === first) ? first : null;
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address.replace(/\s+\d{5}\s*$/, "");
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/** El precio: "$" chiquito y el número en la slab, en rojo sombrero. */
function Price({ value, className = "" }: { value: number; className?: string }) {
  const whole = Number.isInteger(value);
  return (
    <span className={`${SD_NAME} shrink-0 tabular-nums leading-none text-[#c6361c] ${className}`}>
      {whole ? (
        <>
          <span className="mr-[1px] text-[0.7em] opacity-80">$</span>
          {value}
        </>
      ) : (
        formatPrice(value)
      )}
    </span>
  );
}

/** Letrero de madera: tabla oscura, letras crema y sus dos clavos. */
function Sign({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`${SD_TITLE} sd-sign relative mx-auto block w-fit max-w-full px-7 pb-[9px] pt-[11px] text-center text-[20px] leading-none tracking-[0.04em] text-[#f0e9d3] sm:text-[23px] ${className}`}>
      <span className="sd-nail left-2.5" aria-hidden />
      {children}
      <span className="sd-nail right-2.5" aria-hidden />
    </h2>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function SuaderoHeader({
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
  const name = loading ? "Tacos de Suadero La Familia" : restaurantName || "Tacos de Suadero La Familia";
  return (
    <header className="px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="sd-wood sd-rise mx-auto max-w-3xl overflow-hidden px-4 pb-5 pt-5 text-center sm:px-8 sm:pb-7 sm:pt-7">
        {/* Su logo: el charrito sobre tablones. Va como una tabla colgada, con marco crema. */}
        <div className="sd-board mx-auto h-[150px] w-[150px] sm:h-[190px] sm:w-[190px]">
          <Image src="/skins/suadero/logo.jpg" alt={name} width={900} height={900} priority unoptimized className="h-full w-full object-cover" />
        </div>
        <h1 className="sr-only">{name}</h1>
        {!loading && tagline?.trim() ? (
          <p className={`${SD_TITLE} mt-3 text-[13px] tracking-[0.12em] text-[#f0e9d3]/85`}>{tagline.trim()}</p>
        ) : null}
        {!loading ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            {schedule ? (
              <span
                className={
                  `${SD_NAME} inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-[6px] text-[12px] uppercase tracking-[0.06em] ` +
                  (schedule.open ? "border-[#f0e9d3] bg-[#b32e16] text-[#f0e9d3]" : "border-[#f0e9d3]/60 bg-transparent text-[#f0e9d3]")
                }
              >
                <span className={"h-2 w-2 rounded-full " + (schedule.open ? "sd-live bg-[#f0e9d3]" : "bg-[#f0e9d3]/70")} aria-hidden />
                {schedule.label}
              </span>
            ) : null}
            {address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-semibold text-[#f0e9d3]/85 underline decoration-[#f0e9d3]/35 underline-offset-4 hover:text-[#f0e9d3]"
              >
                <span className="min-w-0 truncate">{shortAddress(address)}</span>
                <span aria-hidden className="shrink-0">↗</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** La portada del comal: su foto en una impresión blanca, un poco ladeada sobre el mantel. */
export function SuaderoCover({ url, name }: { url: string; name: string }) {
  return (
    <div className="sd-rise mx-auto mb-6 mt-5 max-w-3xl px-1" style={{ animationDelay: "120ms" }}>
      <div className="sd-print -rotate-1">
        <Image src={url} alt={`El comal de ${name}`} width={1200} height={760} unoptimized priority className="h-44 w-full object-cover sm:h-64" />
      </div>
    </div>
  );
}

/* ─────────────────────────── Hoja ─────────────────────────── */

export function SuaderoSheet({ children }: { children: ReactNode }) {
  return <div className="sd-sheet pb-6">{children}</div>;
}

function AddButton({ name, onAdd, small = false }: { name: string; onAdd: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "sd-add flex shrink-0 items-center justify-center rounded-full font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6361c] focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
        (small ? "h-8 w-8 text-[20px]" : "h-10 w-10 text-[24px]")
      }
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="sd-stepper flex shrink-0 items-center rounded-full">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className={`${SD_NAME} min-w-[1.2rem] text-center text-[15px] tabular-nums`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

/* ─────────────────────────── Sección: un plato por familia ─────────────────────────── */

export function SuaderoCategorySection({
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
  /** La descripción que comparten todos los platillos de la sección (va una vez, bajo el letrero). */
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
      data-sd={sdKeyOf(category)}
      className={"sd-plate sd-rise px-4 pb-4 pt-0 sm:px-6 sm:pb-5 " + (closed ? "opacity-60" : "")}
      style={{ animationDelay: `${Math.min(index, 6) * 70 + 160}ms` } as CSSProperties}
    >
      <div className="-mt-4 text-center">
        <Sign id={id}>{category}</Sign>
      </div>
      {description ? <p className="mx-auto mt-3 max-w-md text-center text-[14px] leading-snug text-[#3a2314]/75 [text-wrap:balance]">{description}</p> : null}
      {note ? (
        <p className="mt-2 text-center text-[12px] font-bold uppercase tracking-[0.1em] text-[#c6361c]">
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
            className={`${SD_NAME} rounded-full border-2 border-[#9f4c24]/50 px-3.5 py-1.5 text-[12px] uppercase tracking-[0.08em] text-[#612f18] hover:bg-[#9f4c24]/10`}
          >
            {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
          </button>
        </div>
      ) : null}
      {collapsed ? null : <ul className="mt-3 divide-y divide-[#612f18]/10">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/** Un platillo: su foto a la izquierda, NOMBRE ····· $precio, "Elige carne" y la descripción. */
export function SuaderoItemRow({
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
  topSeller = false,
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
      {topSeller ? (
        // Misma pastilla que su "Elige tu salsa", pero rellena con el café de su tabla.
        <span className={`${SD_NAME} mb-1 inline-flex items-center rounded-full bg-[#612f18] px-2.5 py-[3px] text-[10.5px] uppercase tracking-[0.08em] text-[#f6e7cf]`}>
          🔥 Más pedido
        </span>
      ) : null}
      <span className="flex items-end gap-2">
        <span className={`${SD_NAME} min-w-0 text-[17px] leading-[1.15] text-[#3a2314] sm:text-[18px]`}>{name}</span>
        <span className="sd-dots" aria-hidden />
        <Price value={price} className="text-[18px] sm:text-[19px]" />
      </span>
      {hint ? (
        <span className={`${SD_NAME} mt-1.5 inline-flex items-center rounded-full border-[1.5px] border-[#d5984c] bg-[#d5984c]/12 px-2.5 py-[3px] text-[10.5px] uppercase tracking-[0.08em] text-[#8a4b12]`}>
          {hint}
        </span>
      ) : null}
      {desc ? <span className="mt-1 block pr-1 text-[13.5px] leading-snug text-[#3a2314]/72">{desc}</span> : null}
    </button>
  );
  /* Con foto: la foto a la izquierda, el texto a lo ancho y el botón abajo a la derecha (así el nombre no se
     parte en tres renglones cuando el contador está abierto). Sin foto: nombre y botón en la misma línea. */
  if (imageUrl) {
    return (
      <li className={"sd-row -mx-2 flex items-start gap-3 px-2 py-3 " + (quantity > 0 ? "sd-row--on" : "")}>
        <button type="button" onClick={onOpen} aria-label={`Ver foto de ${name}`} className="sd-photo mt-0.5 h-[84px] w-[84px] shrink-0 cursor-zoom-in sm:h-24 sm:w-24">
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
    <li className={"sd-row -mx-2 flex items-center gap-3 px-2 py-3 " + (quantity > 0 ? "sd-row--on" : "")}>
      <div className="min-w-0 flex-1">{text}</div>
      {control}
    </li>
  );
}

/** Tarjeta de premios: otro plato blanco con su letrero. */
export function SuaderoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sd-plate sd-rise mt-10 px-4 pb-5 pt-0 sm:px-6" aria-label={title}>
      <div className="-mt-4 text-center">
        <Sign>{title}</Sign>
      </div>
      <div className="mt-4 text-[#3a2314]">{children}</div>
    </section>
  );
}
