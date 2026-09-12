"use client";

/**
 * Piel "Pinches Tortas Perras" del menú público — Pinches Tortas Perras (Herrera y Cairo 1425, Santa Teresita,
 * Guadalajara; IG @pinchestortasperras). Séptima piel (12-sep-2026).
 *
 * Fuente única: SUS TRES HOJAS de la historia destacada "MENÚ".
 *  - Hoja 1 (portada): rojo con fibras, "@PINCHESTORTASPERRAS" en versales espaciadas hasta arriba, el óvalo de línea
 *    con "Nuestro Menú" en cursiva, "PÁSELE JOVEN" en condensada pesada, "¿Que va a Querer?" en cursiva y su dirección
 *    en versales espaciadas hasta abajo → el encabezado.
 *  - Hojas 2 y 3: papel hueso moteado, la rayita, el óvalo de línea con TORTAS / TACOS, y la lista: NOMBRE en rojo
 *    versales y su descripción en gris. "EXTRA CHICHARRÓN" viene tras una raya al pie de la hoja de tortas → su
 *    propia sección "Extras".
 * En escritorio su hoja se parte en dos columnas para no dejar el papel vacío. La lógica (carrito, opciones, detalle)
 * es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Anton, Poppins, Yellowtail } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./tortasperras.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--tp-display" });
const script = Yellowtail({ weight: "400", subsets: ["latin"], variable: "--tp-script" });
const poppins = Poppins({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--tp-sans" });

export const TP_ROOT_CLASS =
  `${anton.variable} ${script.variable} ${poppins.variable} ` +
  "tp-skin min-h-screen text-[#2b2a28] antialiased [font-family:var(--tp-sans),Poppins,system-ui,sans-serif]";

export const TP_DISPLAY = "[font-family:var(--tp-display),'Arial_Narrow',Impact,sans-serif] font-normal";
export const TP_SCRIPT = "[font-family:var(--tp-script),'Brush_Script_MT',cursive] font-normal";

const INSTAGRAM_URL = "https://www.instagram.com/pinchestortasperras/";
/** Su horario (historia "SUCURSALES" de Santa Tere). El chip de "abierto" sí es vivo; esto es el letrero del papel. */
const PAPER_HOURS = "Martes a domingo · 9:00 am – 4:00 pm";

function keyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Su portada dice "AV HERRERA Y CAIRO #1425, SANTA TERE, GDL.": calle y colonia, sin CP ni estado (se cortaba). */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/* ─────────────────────────── Portada (su hoja roja) ─────────────────────────── */

/** La rayita que va sobre sus óvalos. */
function Dash({ tone = "#cf1225" }: { tone?: string }) {
  return <span aria-hidden className="mx-auto block h-[3px] w-6 rounded-full" style={{ backgroundColor: tone }} />;
}

export function TortasHeader({
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
  // "Pinches Tortas Perras — Santa Tere" → el nombre grande y la sucursal en chico, como su rótulo.
  const full = loading ? "Pinches Tortas Perras" : restaurantName || "Pinches Tortas Perras";
  const [main, branch] = full.split(/\s+—\s+/, 2);
  return (
    <header className="tp-cover relative text-[#f4f1ea]">
      <div className="mx-auto max-w-6xl px-5 pt-5 pb-6 text-center sm:px-8 sm:pt-7 sm:pb-8">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#f4f1ea]/95 transition-opacity hover:opacity-75 sm:text-[12px] sm:tracking-[0.42em]"
        >
          @pinchestortasperras
        </a>

        <div className="tp-rise mt-4 sm:mt-6">
          <span className="mx-auto inline-block rounded-[50%] border-[2px] border-[#f4f1ea] px-6 py-1 sm:px-9 sm:py-1.5" style={{ transform: "rotate(-1.2deg)" }}>
            <span className={`${TP_SCRIPT} block text-[19px] leading-[1.5] sm:text-[26px]`}>Nuestro Menú</span>
          </span>
          <h1 className={`${TP_DISPLAY} mt-2 text-[40px] uppercase leading-[0.92] tracking-[0.005em] sm:mt-3 sm:text-[68px] lg:text-[84px]`}>
            {main}
          </h1>
          <p className={`${TP_SCRIPT} -mt-0.5 text-[24px] leading-tight text-[#f4f1ea]/95 sm:text-[36px]`}>¿Que va a querer?</p>
        </div>

        {!loading ? (
          <div className="tp-rise mt-4 flex flex-col items-center gap-2" style={{ animationDelay: "120ms" }}>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {branch ? (
                <span className="rounded-full bg-[#f4f1ea] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#b3121a]">
                  {branch}
                </span>
              ) : null}
              {schedule ? (
                <span
                  className={
                    "inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#f4f1ea] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] " +
                    (schedule.open ? "bg-[#f4f1ea] text-[#b3121a]" : "text-[#f4f1ea]")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (schedule.open ? "bg-[#b3121a]" : "bg-[#f4f1ea]")} aria-hidden />
                  {schedule.label}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#f4f1ea]/85">{PAPER_HOURS}</p>
            {address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea]/90 underline decoration-[#f4f1ea]/40 underline-offset-4 hover:text-[#f4f1ea] sm:text-[12px] sm:tracking-[0.2em]"
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

/** No usa portada suelta: su hoja roja ya es el encabezado. */
export function TortasCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

export function TortasSheet({ children }: { children: ReactNode }) {
  return (
    <section className="tp-sheet tp-rise relative -mx-4 sm:mx-0">
      <div className="tp-cols px-4 pt-2 pb-7 sm:px-9 lg:columns-2 lg:gap-x-12 lg:pt-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

/** El orden de SU papel dentro de cada sección. Lo que no esté aquí va al final. */
const PAPER_ORDER = [
  "Torta perra", "Torta perrita", "Torta ahogada", "Torta mini", "Torta de chicharrón", "Perrita embarazada",
  "Extra chicharrón",
  "Perrón", "Chicharrón", "Dorado", "Dorado con carne", "Embarazado", "Blando",
].map(keyOf);

export function tortasSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(keyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

export function TortasCategorySection({
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
    <section aria-labelledby={id} className={"pt-7 first:pt-5 " + (closed ? "opacity-60" : "")}>
      <div className="[break-after:avoid] text-center">
        <Dash />
        <h2 id={id} className="mt-2.5 inline-block">
          <span className={`${TP_DISPLAY} tp-oval inline-block px-7 py-1.5 text-[26px] uppercase leading-[1.15] tracking-[0.03em] text-[#cf1225] sm:px-9 sm:text-[32px]`}>
            {category}
          </span>
        </h2>
        {note ? (
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#cf1225]">
            {closed ? "🕒 " : ""}
            {note}
          </p>
        ) : null}
        {closed && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="mt-2 rounded-full border-[1.5px] border-[#2b2a28] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-[#2b2a28] hover:text-[#e9e7e2]"
          >
            {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
          </button>
        ) : null}
      </div>
      {collapsed ? null : <ul className="mt-5">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/** Su papel todavía no trae precios (12-sep): mientras el dueño los manda, una raya en vez de "$0". */
function paperPrice(price: number): string | null {
  return price > 0 ? formatPrice(price).replace(/^\$\s?/, "$ ") : null;
}

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#cf1225] bg-transparent text-[20px] leading-none text-[#cf1225] transition-colors hover:bg-[#cf1225] hover:text-[#e9e7e2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cf1225] focus-visible:ring-offset-2"
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex items-center rounded-full bg-[#cf1225] text-[#f4f1ea]">
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

/** Renglón como su papel: NOMBRE en rojo versales, la descripción en gris debajo, el precio a la derecha. */
export function TortasItemRow({
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
}: MenuItemCardProps) {
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const money = paperPrice(price);
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 pb-5 [break-inside:avoid]">
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 cursor-pointer text-left">
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 text-[15px] font-bold uppercase leading-tight tracking-[0.035em] text-[#cf1225] sm:text-[16px]">
            {name}
          </span>
          {money ? <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#2b2a28] sm:text-[16px]">{money}</span> : null}
        </span>
        {hint ? <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#cf1225]/75">{hint}</span> : null}
        {description ? (
          <span className="mt-1 block text-[14px] leading-snug text-[#2b2a28]/85 sm:text-[14.5px]">{description}</span>
        ) : null}
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={320} height={200} unoptimized className="mt-2 h-28 w-full max-w-[320px] rounded-[3px] object-cover" />
        ) : null}
      </button>
      <div className="pt-0.5">{control}</div>
    </li>
  );
}

/** Tarjeta de premios como otra hoja de su papel. */
export function TortasPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tp-sheet tp-rise -mx-4 mt-8 px-5 pt-6 pb-6 sm:mx-0 sm:px-9" aria-label={title}>
      <div className="text-center">
        <Dash />
        <h2 className={`${TP_DISPLAY} tp-oval mt-2.5 inline-block px-7 py-1.5 text-[24px] uppercase leading-[1.15] tracking-[0.03em] text-[#cf1225] sm:text-[28px]`}>
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
