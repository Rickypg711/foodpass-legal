"use client";

/**
 * Piel "Tercera" del menú público — el papel de Café de la Tercera en la web.
 *
 * Todo lo visual sale de sus dos menús de papel (outreach/2026-09-10-cafe-de-
 * la-tercera/menu_*.jpg): salmón #f9b699 de fondo, paneles durazno y salvia,
 * títulos rojo chunky (AM/PM), verde pixel (CON PAN, SIN CAFE), naranja bubble
 * (SANDOS, POSTRES), la mano, el muñeco con cabeza de disco, las tacitas y el
 * vinilo. Las ilustraciones son recortes de su propio menú (public/skins/
 * tercera), nada inventado. La lógica (carrito, opciones, detalle) es la de
 * MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import {
  Archivo_Black,
  Archivo_Narrow,
  Barlow_Condensed,
  Bowlby_One,
  Gochi_Hand,
  Silkscreen,
} from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";

const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--tz-chunky" });
const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--tz-pixel" });
const bowlby = Bowlby_One({ weight: "400", subsets: ["latin"], variable: "--tz-bubble" });
const gochi = Gochi_Hand({ weight: "400", subsets: ["latin"], variable: "--tz-hand" });
const barlow = Barlow_Condensed({ weight: ["700", "800"], subsets: ["latin"], variable: "--tz-name" });
const narrow = Archivo_Narrow({ weight: ["400", "700"], subsets: ["latin"], variable: "--tz-body" });

/** Clase raíz: fuentes + fondo salmón + tinta. */
export const TERCERA_ROOT_CLASS =
  `${archivoBlack.variable} ${silkscreen.variable} ${bowlby.variable} ${gochi.variable} ${barlow.variable} ${narrow.variable} ` +
  "min-h-screen bg-[#f9b699] text-[#1a1a1a] [font-family:var(--tz-body),Arial_Narrow,sans-serif] tercera-skin";

export const TERCERA = {
  salmon: "#f9b699",
  peach: "#fbddd5",
  sage: "#ddd9c0",
  mauve: "#e9d3d3",
  coral: "#fbb2a3",
  blush: "#fac6b8",
  red: "#e74b34",
  wordmark: "#f2472d",
  orange: "#ee892f",
  orangeDeep: "#e26320",
  green: "#00b044",
  olive: "#315233",
  teal: "#1f7a8c",
  ink: "#1a1a1a",
};

type Font = "chunky" | "pixel" | "bubble" | "hand";
const FONT_CLASS: Record<Font, string> = {
  chunky: "[font-family:var(--tz-chunky),Impact,sans-serif] tracking-wide",
  pixel: "[font-family:var(--tz-pixel),monospace] tracking-tight",
  bubble: "[font-family:var(--tz-bubble),Impact,sans-serif] tracking-wide",
  hand: "[font-family:var(--tz-hand),cursive]",
};

type Art = "disco_guy" | "mano" | "tacitas_calcetin" | "tacitas_caminando" | "vinilo_mano";
/** box = dónde se para la ilustración; section = el hueco que la sección deja
 *  arriba/abajo para que NO tape el primer renglón (los pies pisan el borde). */
const ART: Record<Art, { w: number; h: number; box: string; section: string; bob?: boolean }> = {
  disco_guy: { w: 454, h: 800, box: "-top-[120px] right-1 h-36 sm:-top-[168px] sm:h-48", section: "mt-32 sm:mt-44", bob: true },
  mano: { w: 240, h: 340, box: "-top-16 right-2 h-24 sm:-top-20 sm:h-28", section: "mt-20 sm:mt-24" },
  tacitas_calcetin: { w: 320, h: 240, box: "-top-12 right-2 h-20 sm:-top-14 sm:h-24", section: "mt-16 sm:mt-20" },
  tacitas_caminando: { w: 710, h: 160, box: "-bottom-3 right-3 h-12 sm:h-14", section: "mt-8 pb-12 sm:pb-14" },
  vinilo_mano: { w: 680, h: 560, box: "-top-20 right-0 h-28 sm:-top-28 sm:h-36", section: "mt-24 sm:mt-32" },
};

type CategoryStyle = {
  font: Font;
  color: string;
  panel: string | "transparent";
  dashed?: string;
  art?: Art;
};

/** Cada sección del papel, con su tipografía, su color y su ilustración. */
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  desayunos: { font: "chunky", color: TERCERA.red, panel: TERCERA.peach, art: "disco_guy" },
  "con pan": { font: "pixel", color: TERCERA.olive, panel: TERCERA.sage, art: "mano" },
  ensaladas: { font: "bubble", color: TERCERA.green, panel: "transparent" },
  entradas: { font: "bubble", color: TERCERA.olive, panel: "transparent", dashed: TERCERA.olive },
  "pa papear": { font: "pixel", color: "#e85c1e", panel: "transparent", dashed: TERCERA.olive },
  sandos: { font: "bubble", color: TERCERA.orange, panel: TERCERA.peach },
  fuertes: { font: "chunky", color: TERCERA.red, panel: TERCERA.peach },
  "con cafe": { font: "chunky", color: TERCERA.olive, panel: TERCERA.coral, art: "tacitas_calcetin" },
  "latte especialidades": { font: "bubble", color: TERCERA.orangeDeep, panel: TERCERA.peach, art: "tacitas_caminando" },
  "de temporada": { font: "pixel", color: TERCERA.wordmark, panel: "#fbe9de", dashed: TERCERA.wordmark },
  "sin cafe": { font: "pixel", color: TERCERA.red, panel: TERCERA.sage },
  mocktails: { font: "bubble", color: TERCERA.red, panel: TERCERA.mauve },
  "matcha bar": { font: "pixel", color: TERCERA.green, panel: "transparent", dashed: TERCERA.wordmark },
  postres: { font: "bubble", color: TERCERA.orangeDeep, panel: TERCERA.peach, art: "vinilo_mano" },
  smoothies: { font: "bubble", color: TERCERA.teal, panel: TERCERA.blush },
};

const FALLBACK_STYLES: CategoryStyle[] = [
  { font: "chunky", color: TERCERA.red, panel: TERCERA.peach },
  { font: "pixel", color: TERCERA.olive, panel: TERCERA.sage },
  { font: "bubble", color: TERCERA.orange, panel: "transparent" },
];

function keyOf(category: string): string {
  return category
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function terceraCategoryStyle(category: string, index: number): CategoryStyle {
  return CATEGORY_STYLES[keyOf(category)] ?? FALLBACK_STYLES[index % FALLBACK_STYLES.length]!;
}

/* ─────────────────────────── Encabezado ─────────────────────────── */

export function TerceraHeader({
  loading,
  restaurantName,
  logoUrl,
  tagline,
  schedule,
  address,
  secondarySubtitle,
}: {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  tagline?: string | null;
  schedule?: ScheduleStatus | null;
  address?: string | null;
  secondarySubtitle?: string | null;
}) {
  const name = (loading ? "" : restaurantName || "Menú").toUpperCase();
  return (
    <header className="relative overflow-hidden bg-[#f9b699]">
      <div className="relative mx-auto max-w-3xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8 lg:max-w-4xl">
        {/* El arco del papel: CAFÉ DE LA TERCERA sobre las tres caritas. */}
        <div className="tercera-rise mx-auto max-w-[520px]" style={{ animationDelay: "40ms" }}>
          <svg viewBox="0 0 600 200" className="w-full" role="img" aria-label={restaurantName}>
            <defs>
              {/* Cuerda 540, flecha 120: el vértice queda en y=70 y las letras no se salen. */}
              <path id="tz-arc" d="M 30 190 A 364 364 0 0 1 570 190" fill="none" />
            </defs>
            <text
              fill={TERCERA.wordmark}
              fontSize={name.length > 18 ? 40 : 52}
              style={{ fontFamily: "var(--tz-bubble), Impact, sans-serif", letterSpacing: "0.04em" }}
              textAnchor="middle"
            >
              <textPath href="#tz-arc" startOffset="50%">
                {name}
              </textPath>
            </text>
          </svg>
          <div className="-mt-3 flex items-center justify-center gap-3 sm:-mt-4">
            <span className={`${FONT_CLASS.pixel} text-sm text-[#f2472d] sm:text-base`}>CUU</span>
            <Image
              src="/skins/tercera/caritas.png"
              alt=""
              width={780}
              height={340}
              unoptimized
              priority
              className="h-12 w-auto sm:h-16"
            />
            <span className={`${FONT_CLASS.pixel} text-sm text-[#f2472d] sm:text-base`}>MX</span>
          </div>
        </div>

        <div className="tercera-rise mt-4 flex items-center gap-3" style={{ animationDelay: "140ms" }}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-[3px] ring-[#1a1a1a]"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {!loading && tagline ? (
              <p className={`${FONT_CLASS.hand} text-[22px] leading-none text-[#1a1a1a] sm:text-2xl`}>{tagline}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {schedule ? (
                <p
                  className={
                    `${FONT_CLASS.pixel} inline-flex items-center rounded-full border-2 px-2.5 py-1 text-[11px] sm:text-xs ` +
                    (schedule.open
                      ? "border-[#00b044] bg-[#00b044]/15 text-[#1c6b33]"
                      : "border-[#e74b34] bg-[#e74b34]/15 text-[#9a2b1a]")
                  }
                >
                  {schedule.open ? "● " : "○ "}
                  {schedule.label}
                </p>
              ) : null}
              {address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-[13px] font-bold leading-snug text-[#1a1a1a]/80 underline decoration-dotted underline-offset-4"
                >
                  <span className="truncate">{address}</span>
                </a>
              ) : null}
            </div>
            {secondarySubtitle ? (
              <p className="mt-1 text-[12px] font-bold text-[#1a1a1a]/60">{secondarySubtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      {/* La raya punteada que separa como en el papel. */}
      <div className="mx-auto max-w-3xl border-b-[3px] border-dotted border-[#1a1a1a]/70 lg:max-w-4xl" aria-hidden />
    </header>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function TerceraCover({ url, name }: { url: string; name: string }) {
  return (
    <div className="tercera-rise mb-8 overflow-hidden rounded-[28px] ring-4 ring-[#fbddd5]" style={{ animationDelay: "220ms" }}>
      <Image src={url} alt={`Portada de ${name}`} width={1600} height={900} unoptimized priority className="h-40 w-full object-cover sm:h-56" />
    </div>
  );
}

/* ─────────────────────────── Secciones ─────────────────────────── */

export function TerceraCategorySection({
  category,
  index,
  children,
  note = null,
  closed = false,
}: {
  category: string;
  index: number;
  children: ReactNode;
  /** "de 9:00 am a 12:00 pm · vuelve mañana a las 10:00 am" (ventanas por categoría). */
  note?: string | null;
  /** Fuera de su hora: la sección se apaga, se lee, no se pide. */
  closed?: boolean;
}) {
  const s = terceraCategoryStyle(category, index);
  const art = s.art ? ART[s.art] : null;
  const transparent = s.panel === "transparent";
  return (
    <section
      aria-labelledby={`menu-cat-${index}`}
      className={
        "tercera-rise relative rounded-[28px] px-4 pt-5 pb-4 sm:px-6 sm:pt-6 " +
        (closed ? "opacity-60 " : "") +
        (art ? `${art.section} ` : "mt-8 ") +
        (s.dashed ? "border-[3px] border-dashed " : "")
      }
      style={{
        background: transparent ? "transparent" : s.panel,
        borderColor: s.dashed,
        animationDelay: `${Math.min(index, 8) * 70 + 260}ms`,
      }}
    >
      {art ? (
        <Image
          src={`/skins/tercera/${s.art}.png`}
          alt=""
          width={art.w}
          height={art.h}
          unoptimized
          className={`pointer-events-none absolute w-auto select-none ${art.box} ${art.bob ? "tercera-bob" : ""}`}
          aria-hidden
        />
      ) : null}
      <h2
        id={`menu-cat-${index}`}
        className={`${FONT_CLASS[s.font]} relative pr-24 text-[26px] uppercase leading-none sm:text-[34px]`}
        style={{ color: s.color }}
      >
        {category}
      </h2>
      {note ? (
        <p className={`${FONT_CLASS.hand} relative mt-1 pr-24 text-[17px] leading-tight text-[#1a1a1a]/75`}>
          {closed ? "cerrado ahorita · " : ""}{note}
        </p>
      ) : null}
      <ul className="mt-4 divide-y-2 divide-dotted divide-[#1a1a1a]/25">{children}</ul>
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#1a1a1a] bg-[#1a1a1a] text-2xl font-bold leading-none text-[#fbddd5] transition-transform hover:scale-105 active:scale-95"
    >
      +
    </button>
  );
}

function Stepper({
  name,
  quantity,
  onIncrement,
  onDecrement,
}: {
  name: string;
  quantity: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  return (
    <div className="flex items-center rounded-full border-[3px] border-[#1a1a1a] bg-[#1a1a1a] text-[#fbddd5]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-9 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className={`${FONT_CLASS.pixel} min-w-[1.4rem] text-center text-sm`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-9 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

/** El renglón del papel: NOMBRE ........ $130 / descripción en chiquito. */
export function TerceraItemRow({
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
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  return (
    <li className="flex items-center gap-3 py-3">
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="flex items-baseline gap-2">
          <span className="[font-family:var(--tz-name),Impact,sans-serif] text-[17px] font-extrabold uppercase leading-tight tracking-wide text-[#1a1a1a] sm:text-[19px]">
            {name}
          </span>
          <span className="mb-1 min-w-4 flex-1 border-b-2 border-dotted border-[#1a1a1a]/70" aria-hidden />
          <span className="[font-family:var(--tz-name),Impact,sans-serif] text-[17px] font-extrabold tabular-nums text-[#1a1a1a] sm:text-[19px]">
            {formatPrice(price)}
          </span>
        </p>
        {optionsHint && optionsHint !== "Se arma a tu gusto" ? (
          <span className={`${FONT_CLASS.hand} mt-0.5 block text-[15px] leading-none text-[#1c6b33]`}>{optionsHint.replace(/^🌶️\s*/, "")}</span>
        ) : null}
        {description ? (
          <p className="mt-1 line-clamp-3 text-[13.5px] leading-snug text-[#1a1a1a]/85">{description}</p>
        ) : null}
      </button>
      {imageUrl ? (
        <div className="relative shrink-0">
          <button type="button" onClick={onOpen} aria-label={`Ver foto de ${name}`} className="block cursor-zoom-in">
            <Image src={imageUrl} alt="" width={96} height={96} unoptimized className="h-[76px] w-[76px] rounded-2xl object-cover ring-[3px] ring-[#1a1a1a] sm:h-24 sm:w-24" />
          </button>
          {control ? <div className="absolute -bottom-2 -right-2">{control}</div> : null}
        </div>
      ) : control ? (
        <div className="shrink-0">{control}</div>
      ) : null}
    </li>
  );
}

/** Sección de premios con el mismo panel, para que no rompa el papel. */
export function TerceraPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tercera-rise mt-8 rounded-[28px] bg-[#fbddd5] px-4 pt-5 pb-4 sm:px-6" aria-label={title}>
      <h2 className={`${FONT_CLASS.bubble} text-[26px] uppercase leading-none text-[#ee892f] sm:text-[34px]`}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
