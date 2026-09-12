"use client";

/**
 * Piel "IGO" del menú público — IGO Pizzeria (Río Tapachula 2705, Lomas de San Pedro, Guadalajara;
 * IG @igopizza.local, FB 106K). Octava piel (12-sep-2026).
 *
 * Fuente única: SUS 4 HOJAS de menú (portada + Pizzas/Calzone + Snacks/Bebidas + Ensalada/Pastas/Extras/Aderezos/
 * Postres), recortadas en public/skins/igo:
 *  - portada: marco verde doble, el higo grabado con "IGO / — PIZZERIA —" (logo.png), "MENU" de canto y la franja
 *    verde del pie con @igopizza.local y su CEL;
 *  - hojas: título de sección en letra gorda con las letras bailando, su ilustración grabada al lado (ico_*.png),
 *    el NOMBRE en versales verdes, la ETIQUETA verde del precio seguida de la barra gris hasta la orilla, y la
 *    descripción en cursiva entre paréntesis;
 *  - el higo gigante y tenue de marca de agua al fondo (higo.png) y su monito "¡Tomen agüita!" (mascota.png).
 * Su verde es #0b652a, sacado del propio PDF. En escritorio la hoja se parte en dos columnas.
 * La lógica (carrito, opciones, detalle) es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Lilita_One, Oswald, Jost } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./igo.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--igo-display" });
const oswald = Oswald({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--igo-name" });
const jost = Jost({ weight: ["300", "400", "500"], style: ["normal", "italic"], subsets: ["latin"], variable: "--igo-sans" });

export const IGO_ROOT_CLASS =
  `${lilita.variable} ${oswald.variable} ${jost.variable} ` +
  "igo-skin min-h-screen text-[#2b2b2b] antialiased [font-family:var(--igo-sans),Jost,system-ui,sans-serif]";

export const IGO_DISPLAY = "[font-family:var(--igo-display),Impact,sans-serif] font-normal";
export const IGO_NAME = "[font-family:var(--igo-name),'Arial_Narrow',sans-serif]";

const INSTAGRAM_URL = "https://www.instagram.com/igopizza.local/";
const CEL = "33-21-54-99-26";
/** Su video de FB: "de lunes a viernes de 6 pm a 11 pm, sábado de 2 pm a 11 pm" (domingo, de Rappi). */
const PAPER_HOURS = "Lun a vie 6–11 pm · Sáb 2–11 pm · Dom 2–9 pm";

function keyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono y se cortaba a media palabra. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/* ─────────────────────────── Piezas de su papel ─────────────────────────── */

/** Sus títulos traen las letras a distinta altura, como sellos puestos a mano. */
function Bouncy({ text }: { text: string }) {
  const offsets = [0, -3, 2, -2, 3, -1, 1, -3, 2, -2, 0, 3, -1, 2, -3];
  const tilts = [-2, 1, -1, 2, 0, -2, 1, 2, -1, 0, 1, -2, 2, -1, 1];
  return (
    <span className="igo-bounce" aria-label={text}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          aria-hidden
          style={{ transform: `translateY(${offsets[i % offsets.length]}px) rotate(${tilts[i % tilts.length]}deg)` }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

/** Su ilustración grabada por sección (recortada de sus propias hojas). */
const SECTION_ICON: Record<string, { src: string; w: number; h: number }> = {
  pizzas: { src: "/skins/igo/ico_pizza.png", w: 281, h: 220 },
  calzone: { src: "/skins/igo/ico_calzone.png", w: 284, h: 220 },
  snacks: { src: "/skins/igo/ico_snacks.png", w: 293, h: 220 },
  bebidas: { src: "/skins/igo/ico_bebidas.png", w: 158, h: 220 },
  pastas: { src: "/skins/igo/ico_pastas.png", w: 323, h: 220 },
  aderezos: { src: "/skins/igo/ico_aderezos.png", w: 276, h: 220 },
  postres: { src: "/skins/igo/ico_postres.png", w: 275, h: 220 },
};

/** La franja verde que cierra todas sus hojas. */
function GreenStrip({ className = "" }: { className?: string }) {
  return (
    <div className={"flex items-center justify-between bg-[#0b652a] px-4 py-2 text-[#f7f8f8] sm:px-6 " + className}>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold tracking-[0.04em] hover:underline sm:text-[13px]"
      >
        @igopizza.local
      </a>
      <span className="text-[11px] font-bold tracking-[0.04em] sm:text-[13px]">CEL: {CEL}</span>
    </div>
  );
}

/* ─────────────────────────── Portada (su hoja 1) ─────────────────────────── */

export function IGOHeader({
  loading,
  restaurantName,
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
  return (
    <header className="px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="igo-sheet igo-frame igo-marca igo-rise mx-auto max-w-6xl overflow-hidden">
        <div className="px-5 pb-5 pt-6 text-center sm:px-8 sm:pb-7 sm:pt-8">
          <Image
            src="/skins/igo/logo.png"
            alt={loading ? "IGO Pizzeria" : restaurantName || "IGO Pizzeria"}
            width={772}
            height={900}
            priority
            unoptimized
            className="mx-auto h-24 w-auto sm:h-32 lg:h-40"
          />
          {!loading ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {schedule ? (
                  <span
                    className={
                      "inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#0b652a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] " +
                      (schedule.open ? "bg-[#0b652a] text-[#f7f8f8]" : "text-[#0b652a]")
                    }
                  >
                    <span className={"h-1.5 w-1.5 rounded-full " + (schedule.open ? "bg-[#f7f8f8]" : "bg-[#0b652a]")} aria-hidden />
                    {schedule.label}
                  </span>
                ) : null}
                <span className="rounded-full border-[1.5px] border-[#0b652a]/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0b652a]">
                  Nuestra pasión hecha pizza
                </span>
              </div>
              <p className="text-[11.5px] text-[#2b2b2b]/70 sm:text-[13px]">{PAPER_HOURS}</p>
              {address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 text-[11.5px] text-[#0b652a] underline decoration-[#0b652a]/30 underline-offset-4 hover:decoration-[#0b652a] sm:text-[13px]"
                >
                  <span className="min-w-0 truncate">{shortAddress(address)}</span>
                  <span aria-hidden className="shrink-0">↗</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <GreenStrip />
      </div>
    </header>
  );
}

/** IGO no usa portada suelta: su hoja 1 ya es el encabezado. */
export function IGOCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

export function IGOSheet({ children }: { children: ReactNode }) {
  return (
    <section className="igo-sheet igo-frame igo-marca igo-rise relative overflow-hidden">
      <div className="igo-cols px-4 pb-7 pt-5 sm:px-8 lg:columns-2 lg:gap-x-12">{children}</div>
      <GreenStrip />
    </section>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

/** El orden de SU papel dentro de cada sección. Lo que no esté aquí va al final. */
const PAPER_ORDER = [
  "Pizza pepperoni", "Pizza hawaiana", "Pizza de salami con cebolla", "Pizza de champiñón", "Pizza margarita", "Pizza de jamón serrano",
  "Calzone de pepperoni", "Calzone hawaiano", "Calzone de salami con cebolla", "Calzone de champiñón", "Calzone margarita", "Calzone de jamón serrano",
  "Alitas ahumadas", "Boneless", "Dedos de queso", "Papas gajo",
  "Refresco", "Agua de horchata", "Capuchino", "Frappé de mango", "Frappé de café", "Agua mineral con esencia",
  "Clericot", "Strongbow", "Copa de vino tinto", "Botella de vino tinto", "Bohemia",
  "Hojas verdes", "Lasaña",
  "Proteína y verduras", "Jamón serrano", "Queso",
  "Yahualica con tomate verde", "Chipotle", "Ranch",
  "Brownie marmoleado", "Brownie marmoleado con helado", "Pan de elote", "Pan de elote con helado",
  "Helado de mamey", "Helado de crema de mango",
].map(keyOf);

export function igoSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(keyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

export function IGOCategorySection({
  category,
  index,
  children,
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
}: {
  category: string;
  index: number;
  children: ReactNode;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const id = `menu-cat-${index}`;
  const icon = SECTION_ICON[keyOf(category)];
  return (
    <section aria-labelledby={id} className={"pt-7 first:pt-1 " + (closed ? "opacity-60" : "")}>
      <div className="[break-after:avoid] flex items-center justify-center gap-2 sm:gap-3">
        <h2 id={id} className={`${IGO_DISPLAY} text-[26px] uppercase leading-none tracking-[0.02em] text-[#0b652a] sm:text-[32px]`}>
          <Bouncy text={category} />
        </h2>
        {icon ? (
          <Image src={icon.src} alt="" width={icon.w} height={icon.h} unoptimized aria-hidden className="h-9 w-auto sm:h-12" />
        ) : null}
      </div>
      {note ? (
        <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b652a]">
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
            className="rounded-full border-[1.5px] border-[#0b652a] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b652a] hover:bg-[#0b652a] hover:text-[#f7f8f8]"
          >
            {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
          </button>
        </div>
      ) : null}
      {collapsed ? null : <ul className="mt-4">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/**
 * En su papel la sección ya dice "PIZZAS", así que el renglón solo dice "PEPPERONI". En Firestore el nombre va
 * completo ("Pizza pepperoni") porque el carrito y el WhatsApp del pedido solo llevan el nombre y si no, no se
 * sabe si es pizza o calzone. Aquí se quita la palabra de la sección SOLO para pintar.
 */
function shortName(name: string, category: string): string {
  const cat = keyOf(category);
  const head = cat === "pizzas" ? "pizza" : cat === "calzone" ? "calzone" : null;
  if (!head) return name;
  const re = new RegExp(`^${head}\\s+(?:de\\s+|del\\s+)?`, "i");
  const out = name.replace(re, "");
  return out.length >= 3 ? out : name;
}

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#0b652a] bg-transparent text-[20px] leading-none text-[#0b652a] transition-colors hover:bg-[#0b652a] hover:text-[#f7f8f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b652a] focus-visible:ring-offset-2"
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex shrink-0 items-center rounded-full bg-[#0b652a] text-[#f7f8f8]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-9 w-8 items-center justify-center text-lg font-semibold">
        −
      </button>
      <span className="min-w-[1.2rem] text-center text-[13.5px] font-bold tabular-nums">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-9 w-8 items-center justify-center text-lg font-semibold">
        +
      </button>
    </div>
  );
}

/** Renglón como su papel: NOMBRE · etiqueta verde con el precio · barra gris hasta la orilla · descripción en cursiva. */
export function IGOItemRow({
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
  category = "",
}: MenuItemCardProps & { category?: string }) {
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  return (
    <li className="flex items-start gap-2 pb-4 [break-inside:avoid] sm:gap-3">
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-center gap-2">
          <span className={`${IGO_NAME} shrink-0 text-[14px] font-medium uppercase leading-tight tracking-[0.02em] text-[#0b652a] sm:text-[15.5px]`}>
            {shortName(name, category)}
          </span>
          <span className="flex min-w-0 flex-1 items-center">
            <span className="igo-chip shrink-0 px-2.5 py-[3px] text-[12.5px] font-semibold tabular-nums sm:text-[13.5px]">
              $ {formatPrice(price).replace(/^\$\s?/, "")}
            </span>
            <span className="igo-bar h-[15px] min-w-0 flex-1" aria-hidden />
          </span>
        </span>
        <span className="mt-1 block border-t border-[#2b2b2b]/15" aria-hidden />
        {hint ? <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#0b652a]/75">{hint}</span> : null}
        {description ? (
          <span className="mt-1 block text-[13px] italic leading-snug text-[#2b2b2b]/75 sm:text-[13.5px]">({description})</span>
        ) : null}
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={320} height={200} unoptimized className="mt-2 h-28 w-full max-w-[320px] rounded-[3px] object-cover" />
        ) : null}
      </button>
      <div className="pt-0.5">{control}</div>
    </li>
  );
}

/** Tarjeta de premios como otra hoja de su papel, con su monito. */
export function IGOPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="igo-sheet igo-frame igo-rise mt-8 overflow-hidden" aria-label={title}>
      <div className="px-5 pb-6 pt-6 sm:px-8">
        <div className="flex items-center justify-center gap-3">
          <h2 className={`${IGO_DISPLAY} text-[24px] uppercase leading-none text-[#0b652a] sm:text-[28px]`}>
            <Bouncy text={title} />
          </h2>
          <Image src="/skins/igo/mascota.png" alt="" width={741} height={800} unoptimized aria-hidden className="h-12 w-auto sm:h-16" />
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}
