"use client";

/**
 * Piel "LasPic" del menú público — LasPic, Pizza, Pasta & Fun (C. José María Morelos 106, Zona Centro, Chihuahua;
 * IG @laspic_pizzeria). Sexta piel (11-sep-2026).
 *
 * Dos fuentes, las dos SUYAS:
 *  - su fachada (IG): la franja de ajedrez negro y crema sobre la puerta, "PIZZERÍA" en versalitas y "Las Pic" en
 *    serif rojo tomate, las sillas amarillas → la portada;
 *  - su menú de papel (historia destacada "Menus"): hoja blanca editorial, las dos mascotas de fleco con lentes
 *    flanqueando "Pizza, Pasta and Fun / - Encuentra el Match Perfecto -", la franja de maridaje ("Junta las figuras…")
 *    con ▽ ○ □ rayados, dos columnas con raya al centro, títulos serif con punto ("Entradas & Ensaladas."), nombres en
 *    versales espaciadas con "DE / Y / &" más delgados, "MARGHERITA Las Pic" con su serif, "$ 220", y la figura de
 *    maridaje de cada platillo (campo `wine` del platillo: t ▽ · c ○ · s □).
 * En escritorio usa todo el ancho: su hoja a dos columnas, como el papel. La lógica (carrito, opciones, detalle) es
 * la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Instrument_Serif, Jost } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./laspic.css";

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--lp-serif" });
const jost = Jost({ weight: ["300", "400", "500", "600", "700"], subsets: ["latin"], variable: "--lp-sans" });

export const LP_ROOT_CLASS =
  `${serif.variable} ${jost.variable} ` +
  "lp-skin min-h-screen text-[#141414] antialiased [font-family:var(--lp-sans),Jost,Futura,sans-serif]";

export const LP_SERIF = "[font-family:var(--lp-serif),'Times_New_Roman',serif] font-normal";

const INSTAGRAM_URL = "https://www.instagram.com/laspic_pizzeria/";
const TERRUNO_URL = "https://www.instagram.com/barradevinos.terruno/";
/** Su horario (IG dice "11:59 pm"; aquí va igual que la tarjeta de horario del doc, 12:00 am, para no contradecirse).
 *  Si cambian el horario, se cambia aquí (el chip de "abierto" sí es vivo). */
const PAPER_HOURS: [string, string][] = [
  ["Lunes a sábado", "2:00 pm – 12:00 am"],
  ["Domingo", "2:00 – 10:00 pm"],
];

function keyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/* ─────────────────────────── Figuras de maridaje ─────────────────────────── */

/** El rayado de sus figuras (gris con líneas horizontales, como el papel). Vive una vez por página. */
function WineDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <pattern id="lp-hatch" width="4" height="2.6" patternUnits="userSpaceOnUse">
          <rect width="4" height="2.6" fill="#dcdad4" />
          <line x1="0" y1="0.6" x2="4" y2="0.6" stroke="#6d6b66" strokeWidth="0.7" />
        </pattern>
      </defs>
    </svg>
  );
}

type Fig = "t" | "c" | "s";
const FIG_NAME: Record<Fig, string> = { t: "triángulo", c: "círculo", s: "cuadro" };

function Figure({ kind, size = 16 }: { kind: Fig; size?: number }) {
  const common = { fill: "url(#lp-hatch)", stroke: "#3a3936", strokeWidth: 1.3 };
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden className="shrink-0">
      {kind === "t" ? (
        <path d="M2.2 3.2h15.6L10 17.4z" strokeLinejoin="round" {...common} />
      ) : kind === "c" ? (
        <circle cx="10" cy="10" r="7.6" {...common} />
      ) : (
        <rect x="2.8" y="2.8" width="14.4" height="14.4" {...common} />
      )}
    </svg>
  );
}

function Figures({ code, size = 15 }: { code?: string; size?: number }) {
  const ks = [...(code ?? "")].filter((k): k is Fig => k === "t" || k === "c" || k === "s");
  if (!ks.length) return null;
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Marida con ${ks.map((k) => FIG_NAME[k]).join(" y ")}`}>
      {ks.map((k, i) => (
        <Figure key={i} kind={k} size={size} />
      ))}
    </span>
  );
}

/* ─────────────────────────── Portada (su fachada) ─────────────────────────── */

export function LaspicHeader({
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
    <header className="relative">
      {/* La franja de ajedrez de su fachada. */}
      <div className="lp-checker h-4 sm:h-5" aria-hidden />
      <div className="lp-facade">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-4 px-5 pt-5 pb-5 sm:px-8 sm:pt-8 sm:pb-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:pt-10 lg:pb-10">
          <div className="lp-rise text-center lg:text-left">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.46em] text-[#141414]/75 sm:text-[12px]">Pizzería</p>
            <h1 className={`${LP_SERIF} -mt-0.5 text-[64px] leading-[0.92] text-[#d23f2c] sm:text-[88px] lg:text-[112px]`}>
              {loading ? "Las Pic" : restaurantName && keyOf(restaurantName) !== "laspic" ? restaurantName : "Las Pic"}
            </h1>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.38em] text-[#141414] sm:text-[12.5px]">
              Pizza · Pasta <span className="font-normal">and</span> Fun
            </p>
            <p className={`${LP_SERIF} mt-1 text-[17px] italic text-[#141414]/70 sm:text-[19px]`}>Estilo napolitano · pasta hecha en casa</p>
          </div>

          <div className="lp-rise text-center lg:text-left" style={{ animationDelay: "120ms" }}>
            {!loading ? (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  {schedule ? (
                    <p
                      className={
                        "inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] " +
                        (schedule.open ? "border-[#141414] bg-[#141414] text-[#fbf8f2]" : "border-[#141414] text-[#141414]")
                      }
                    >
                      <span className={"h-2 w-2 rounded-full " + (schedule.open ? "bg-[#f2c230]" : "bg-[#d23f2c]")} aria-hidden />
                      {schedule.label}
                    </p>
                  ) : null}
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#d23f2c] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d23f2c] transition-colors hover:bg-[#d23f2c] hover:text-[#fbf8f2]"
                  >
                    @laspic_pizzeria
                  </a>
                </div>
                <dl className="mx-auto mt-3 grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-left text-[13px] sm:text-[14px] lg:mx-0">
                  {PAPER_HOURS.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-semibold uppercase tracking-[0.12em] text-[#141414]/70">{k}</dt>
                      <dd className="tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[13px] text-[#141414]/75 underline decoration-[#141414]/30 underline-offset-4 hover:text-[#141414]"
                  >
                    <span className="min-w-0 truncate">{address}</span>
                    <span aria-hidden className="shrink-0">↗</span>
                  </a>
                ) : null}
                <p className="mt-1.5 hidden text-[12.5px] text-[#141414]/60 sm:block">
                  Vinos en colab con{" "}
                  <a href={TERRUNO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#141414]/80 underline decoration-[#141414]/30 underline-offset-4">
                    @barradevinos.terruno
                  </a>
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="lp-checker h-3 sm:h-4" aria-hidden />
    </header>
  );
}

/** LasPic no usa la portada suelta: su fachada ya es el encabezado. */
export function LaspicCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

/** Su hoja de papel: arriba las mascotas con "Pizza, Pasta and Fun", la franja de maridaje y dos columnas. */
export function LaspicSheet({ children }: { children: ReactNode }) {
  return (
    <section className="lp-sheet lp-rise relative -mx-4 sm:mx-0">
      <WineDefs />
      <div className="flex items-center justify-center gap-3 px-4 pt-5 pb-3 sm:gap-6 sm:px-8 sm:pt-7">
        <Image src="/skins/laspic/mascota_izq.png" alt="" width={96} height={85} unoptimized aria-hidden className="h-11 w-auto sm:h-16" />
        <div className="text-center">
          <p className={`${LP_SERIF} text-[29px] leading-none sm:text-[44px]`}>Pizza, Pasta and Fun</p>
          <p className={`${LP_SERIF} mt-1 text-[15px] sm:text-[20px]`}>- Encuentra el Match Perfecto -</p>
        </div>
        <Image src="/skins/laspic/mascota_der.png" alt="" width={95} height={86} unoptimized aria-hidden className="h-11 w-auto sm:h-16" />
      </div>
      <div className="mx-4 flex items-center gap-3 border-y border-[#141414] py-2.5 sm:mx-8 sm:gap-5">
        <p className="min-w-0 flex-1 text-[12px] leading-snug sm:text-[13.5px]">
          Junta las figuras y relaciona tu comida con los vinos como nuestra recomendación de acompañantes.
          <span className="block italic text-[#141414]/60">( Buscamos similitudes para ofrecerle una variedad más amplia )</span>
        </p>
        <span className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Figure kind="t" size={22} />
          <Figure kind="c" size={22} />
          <Figure kind="s" size={22} />
        </span>
      </div>
      <div className="lp-cols px-4 pt-2 pb-6 sm:px-8 lg:columns-2 lg:gap-x-14 lg:pt-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

/** Como lo escribe su papel. */
function sectionTitle(category: string): string {
  const k = keyOf(category);
  if (k === "pizzas") return "Pizzas / A la leña / Individual";
  if (/^entradas/.test(k) || k === "pastas" || k === "postres") return category.replace(/\.$/, "") + ".";
  return category;
}

// El orden de SU papel dentro de cada sección. Lo que no esté aquí va al final.
const PAPER_ORDER = [
  "Aceitunas", "Ensalada Caprese", "Alcachofas gratinadas", "Ensalada de duraznos", "Ensalada de jamón serrano",
  "Papas al pesto", "Betabeles & queso de cabra", "Brocheta de pulpo",
  "Margherita LasPic", "Pera provolone", "La Española", "Melocotón y tocineta", "Pepperoni", "Pizza de alcachofas",
  "4 Quesos", "Pizza de jamón serrano", "Pizza de pepperoni spicy",
  "Gnocchi carbonara", "Fettuccini de hongos", "Lasagna", "Spaghetti y albóndigas", "Ravioles fritos",
  "Ravioles a la boloñesa", "Gnocchi", "Fettuccini & camarón", "Fettuccini & mejillones", "Risotto & pulpo", "Ravioles dumpling",
  "Cheesecake", "Cheesecake matcha", "Tiramisú", "Affogato & Lotus",
].map(keyOf);

export function laspicSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(keyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

export function LaspicCategorySection({
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
  return (
    <section aria-labelledby={id} className={"pt-6 first:pt-3 " + (closed ? "opacity-60" : "")}>
      <h2 id={id} className={`${LP_SERIF} inline-block border-b border-[#141414] pb-1 pr-2 text-[30px] leading-none [break-after:avoid] sm:text-[36px]`}>
        {sectionTitle(category)}
      </h2>
      {note ? <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d23f2c]">{closed ? "🕒 " : ""}{note}</p> : null}
      {closed && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="mt-2 block rounded-full border-[1.5px] border-[#141414] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-[#141414] hover:text-[#fbf8f2]"
        >
          {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
        </button>
      ) : null}
      {collapsed ? null : <ul className="mt-2">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

const LIGHT_WORDS = new Set(["de", "del", "y", "a", "la", "al", "con", "en"]);

/** Su tipografía de nombre: versales espaciadas y los conectores ("DE", "Y", "&") más delgados; "Las Pic" en su serif. */
function DishName({ name }: { name: string }) {
  const words = name.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => {
        const sep = i < words.length - 1 ? " " : "";
        if (/^laspic$/i.test(w)) {
          return (
            <span key={i} className={`${LP_SERIF} text-[1.22em] normal-case tracking-normal`}>
              Las Pic{sep}
            </span>
          );
        }
        const light = w === "&" || LIGHT_WORDS.has(keyOf(w));
        return (
          <span key={i} className={light ? "font-normal" : "font-semibold"}>
            {w.toUpperCase()}
            {sep}
          </span>
        );
      })}
    </>
  );
}

function paperPrice(price: number): string {
  return formatPrice(price).replace(/^\$\s?/, "$ ");
}

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#141414] bg-[#fffdf8] text-[20px] leading-none text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#fffdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d23f2c] focus-visible:ring-offset-2"
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex items-center rounded-full bg-[#141414] text-[#fffdf8]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-9 w-8 items-center justify-center text-lg font-semibold">
        −
      </button>
      <span className="min-w-[1.2rem] text-center text-[13.5px] font-semibold tabular-nums">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-9 w-8 items-center justify-center text-lg font-semibold">
        +
      </button>
    </div>
  );
}

/** Renglón como su papel: figura de maridaje · NOMBRE · $ precio, y la descripción ligera abajo. */
export function LaspicItemRow({
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
  wine,
}: MenuItemCardProps & { wine?: string }) {
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-x-2 py-2.5 [break-inside:avoid] sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:gap-x-3">
      <span className="flex justify-end pt-[3px]">
        <Figures code={wine} size={15} />
      </span>
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 cursor-pointer text-left">
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 text-[14px] leading-snug tracking-[0.1em] sm:text-[15px]">
            <DishName name={name} />
          </span>
          <span className="shrink-0 text-[14px] font-medium tabular-nums sm:text-[15px]">{paperPrice(price)}</span>
        </span>
        {hint ? <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d23f2c]">{hint}</span> : null}
        {description ? (
          <span className="mt-0.5 block text-[13.5px] leading-snug text-[#141414]/75 sm:text-[14px]">{description}</span>
        ) : null}
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={320} height={200} unoptimized className="mt-2 h-28 w-full max-w-[320px] rounded-[3px] object-cover grayscale-[15%]" />
        ) : null}
      </button>
      <div className="pt-0.5">{control}</div>
    </li>
  );
}

/** Tarjeta de premios como otra hoja de su papel. */
export function LaspicPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lp-sheet lp-rise -mx-4 mt-8 px-5 pt-6 pb-6 sm:mx-0 sm:px-8" aria-label={title}>
      <h2 className={`${LP_SERIF} inline-block border-b border-[#141414] pb-1 text-[30px] leading-none`}>{title}.</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
