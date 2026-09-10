"use client";

/**
 * Piel "Negro Blanco" del menú público — Negro Blanco Café (Trasviña y Retes
 * 3300, San Felipe, Chihuahua; #77 en 100 Best Coffee Shops North & Central
 * America 2026).
 *
 * Todo sale de SU marca (Estudio Ye Yé; ilustraciones de Samir Razonable),
 * revisada el 10-sep-2026 en su Instagram, Facebook y Google Maps:
 *  - el círculo negro con "negro / blanco / café ®" en grotesca minúscula,
 *  - los tres puntos (negro · blanco · café) de sus tazas y de su papel,
 *  - la retícula de puntos del pegboard de su barra,
 *  - la luz dura y las sombras largas de sus fotos (la sombra de la taza es
 *    una píldora: por eso la portada es una píldora),
 *  - su lámpara eclipse: disco negro con aro de luz.
 * Negro y blanco de a de veras: las secciones se alternan en panel negro y
 * panel blanco. El arte (public/skins/negroblanco) son recortes de SU
 * Instagram/Facebook, nada generado. La lógica (carrito, opciones, detalle)
 * es la de MenuView: aquí solo se pinta. Distinta a propósito de "tercera"
 * (collage de papel) y "pecado" (hojas y píldoras).
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./negroblanco.css";

const sans = Inter_Tight({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--nb-sans" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--nb-mono" });

export const NB = {
  ink: "#0b0b0b",
  paper: "#f4f3ef",
  white: "#ffffff",
  /** El tercer punto: café (gris tostado). */
  cafe: "#9b928a",
  /** El rojo de sus pósters (5to aniversario). */
  red: "#fe3030",
};

/** Clase raíz: fuentes + papel con retícula de pegboard (negroblanco.css). */
export const NB_ROOT_CLASS =
  `${sans.variable} ${mono.variable} ` +
  "nb-skin min-h-screen text-[#0b0b0b] antialiased [font-family:var(--nb-sans),'Helvetica_Neue',Helvetica,Arial,sans-serif]";

export const NB_MONO = "[font-family:var(--nb-mono),ui-monospace,monospace]";

export type NBTone = "negro" | "blanco";

/** Secciones alternadas: la primera negra, la segunda blanca, y así. */
export function nbTone(index: number): NBTone {
  return index % 2 === 0 ? "negro" : "blanco";
}

function keyOf(category: string): string {
  return category
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/* ─────────────────────────── Piezas de marca ─────────────────────────── */

/** Los tres puntos de sus tazas: negro · blanco · café. */
export function NBDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[5px] ${className}`} aria-hidden>
      <span className="h-[9px] w-[9px] rounded-full bg-[#0b0b0b] ring-1 ring-white/70" />
      <span className="h-[9px] w-[9px] rounded-full bg-white ring-1 ring-[#0b0b0b]/70" />
      <span className="h-[9px] w-[9px] rounded-full bg-[#9b928a]" />
    </span>
  );
}

/** Su logotipo: tres renglones en minúscula, apretados, con ®. */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <p aria-hidden className={`select-none text-left font-semibold leading-[0.9] tracking-[-0.05em] ${className}`}>
      negro
      <br />
      blanco
      <br />
      café
      <sup className="ml-[0.1em] align-[0.62em] text-[0.3em] font-medium tracking-normal">®</sup>
    </p>
  );
}

/** Texto que gira alrededor del disco (mono, espaciado). */
const RING_TEXT =
  "café mexicano de especialidad · tostado en casa · trasviña y retes 3300 · chihuahua · ";

function Eclipse() {
  return (
    <div className="relative mx-auto w-[236px] sm:w-[270px] lg:w-[320px]">
      <svg viewBox="0 0 320 320" className="nb-spin absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <path id="nb-ring" d="M 160,160 m -148,0 a 148,148 0 1,1 296,0 a 148,148 0 1,1 -296,0" fill="none" />
        </defs>
        <text
          fill="rgba(255,255,255,0.55)"
          fontSize="10.5"
          style={{ fontFamily: "var(--nb-mono), ui-monospace, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          <textPath href="#nb-ring" textLength="920" lengthAdjust="spacing">
            {RING_TEXT.toUpperCase()}
          </textPath>
        </text>
      </svg>
      <div className="relative p-[26px] sm:p-[30px] lg:p-[36px]">
        <div className="nb-eclipse grid aspect-square w-full place-items-center rounded-full bg-[#0b0b0b]">
          <Wordmark className="text-[40px] text-white sm:text-[46px] lg:text-[54px]" />
        </div>
      </div>
    </div>
  );
}

const BAND = [
  "Café mexicano de especialidad",
  "Productores con nombre",
  "Tostado en casa",
  "#77 · 100 Best Coffee Shops · North & Central America 2026",
  "Top 50 México 2025",
];

/** Cinta que corre bajo el encabezado. Se duplica para que el loop no brinque. */
function Band() {
  const row = (
    <div className="flex shrink-0 items-center gap-6 pr-6">
      {BAND.map((t) => (
        <span key={t} className="flex items-center gap-6 whitespace-nowrap">
          {t}
          <NBDots />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`${NB_MONO} relative overflow-hidden border-t border-white/[0.12] py-3 text-[10.5px] uppercase tracking-[0.22em] text-white/70`}>
      <div className="nb-marquee flex w-max">
        {row}
        <div aria-hidden className="flex">{row}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Encabezado ─────────────────────────── */

export function NegroBlancoHeader({
  loading,
  restaurantName,
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
  return (
    <header className="nb-night relative overflow-hidden text-white">
      <div className="mx-auto max-w-3xl px-5 pt-5 pb-9 sm:px-8 sm:pt-7 lg:max-w-5xl lg:pb-14">
        <div className={`${NB_MONO} flex items-center justify-between text-[10.5px] uppercase tracking-[0.22em] text-white/55`}>
          <NBDots />
          <span>Chihuahua · MX</span>
        </div>

        {/* minmax(0,1fr): sin esto la dirección larga estira la columna más que la
            pantalla (375 px → 439 px) y descentra el disco y el lema. */}
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:mt-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-16">
          <div className="nb-rise min-w-0" style={{ animationDelay: "60ms" }}>
            <Eclipse />
          </div>

          <div className="nb-rise min-w-0 text-center lg:text-left" style={{ animationDelay: "180ms" }}>
            <h1 className="sr-only">{restaurantName || "Negro Blanco Café"}</h1>
            <p className="mx-auto max-w-[18ch] text-[30px] font-medium leading-[1] tracking-[-0.04em] text-white sm:text-[38px] lg:mx-0 lg:text-[58px]">
              {!loading && tagline ? tagline : "Café mexicano de especialidad."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              {schedule ? (
                <p
                  className={
                    `${NB_MONO} inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] ` +
                    (schedule.open ? "border-white bg-white text-[#0b0b0b]" : "border-white/30 text-white/80")
                  }
                >
                  <span
                    className={"h-2 w-2 rounded-full " + (schedule.open ? "bg-[#0b0b0b]" : "ring-1 ring-white/80")}
                    aria-hidden
                  />
                  {schedule.label}
                </p>
              ) : null}
              {address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${NB_MONO} inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:border-white/60 hover:text-white`}
                >
                  <span className="min-w-0 truncate">{address}</span>
                  <span aria-hidden className="shrink-0">↗</span>
                </a>
              ) : null}
            </div>
            {secondarySubtitle ? (
              <p className={`${NB_MONO} mt-4 text-[11px] uppercase tracking-[0.16em] text-white/45`}>{secondarySubtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      <Band />
    </header>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

/** La portada como la sombra de su taza: una píldora. */
export function NegroBlancoCover({ url, name }: { url: string; name: string }) {
  return (
    <div className="nb-rise mb-8 overflow-hidden rounded-full bg-[#0b0b0b] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]" style={{ animationDelay: "260ms" }}>
      <Image
        src={url}
        alt={`Portada de ${name}`}
        width={1600}
        height={900}
        unoptimized
        priority
        className="h-44 w-full object-cover object-center sm:h-60 lg:h-72"
      />
    </div>
  );
}

/* ─────────────────────────── Secciones ─────────────────────────── */

type Art = "ventana" | "barista";

/** Su arte en las secciones: la chava en la ventana con lluvia ("Llueve. Buen
 *  momento para no tener prisa.") abre el menú; la barista del 5to
 *  aniversario, en rojo, vive con el pan y los postres. */
function artFor(category: string, index: number): Art | null {
  const k = keyOf(category);
  if (index === 0) return "ventana";
  if (/\b(postres?|pan|panes|dulces?|reposteria|galletas?|pasteles?)\b/.test(k)) return "barista";
  return null;
}

export function NegroBlancoCategorySection({
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
  /** "Solo de 9:00 am a 12:00 pm · mañana desde las 9:00 am" (ventanas por categoría). */
  note?: string | null;
  /** Fuera de su hora: la sección se apaga, se lee, no se pide. */
  closed?: boolean;
  /** Fuera de hora nace plegada: título + horario + "Ver los platillos". */
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const dark = nbTone(index) === "negro";
  const art = artFor(category, index);
  const id = `menu-cat-${index}`;
  return (
    <section
      aria-labelledby={id}
      className={
        "nb-rise relative mt-5 overflow-hidden rounded-[32px] px-5 pt-6 pb-2 first:mt-0 sm:px-8 sm:pt-8 sm:pb-3 " +
        (dark ? "bg-[#0b0b0b] text-white " : "bg-white text-[#0b0b0b] ring-1 ring-[#0b0b0b]/[0.07] ") +
        (closed ? "opacity-60" : "")
      }
      style={{ animationDelay: `${Math.min(index, 6) * 80 + 300}ms` }}
    >
      {dark ? <div className="nb-grid-dark pointer-events-none absolute inset-0" aria-hidden /> : null}

      {art === "ventana" ? (
        <Image
          src={dark ? "/skins/negroblanco/ventana_blanca.png" : "/skins/negroblanco/ventana.png"}
          alt=""
          width={724}
          height={900}
          unoptimized
          aria-hidden
          className="nb-float pointer-events-none absolute right-3 top-4 h-28 w-auto select-none sm:right-6 sm:top-6 sm:h-40"
        />
      ) : art === "barista" ? (
        <div className="pointer-events-none absolute right-4 top-5 h-24 w-24 rotate-[-6deg] overflow-hidden rounded-full ring-[5px] ring-white sm:right-7 sm:top-7 sm:h-32 sm:w-32" aria-hidden>
          <Image src="/skins/negroblanco/barista_roja.jpg" alt="" width={720} height={720} unoptimized className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div className={`${NB_MONO} relative flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em] ${art ? "pr-28 sm:pr-44" : ""} ${dark ? "text-white/55" : "text-[#0b0b0b]/50"}`}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="h-px flex-1 bg-current opacity-40" aria-hidden />
        <span>{itemCount}</span>
      </div>
      <h2
        id={id}
        className={`relative mt-3 text-[42px] font-semibold lowercase leading-[0.9] tracking-[-0.055em] sm:text-[60px] ${art ? "pr-28 sm:pr-44" : ""}`}
      >
        {category}
      </h2>
      {note ? (
        <p className={`${NB_MONO} relative mt-3 text-[11px] uppercase tracking-[0.12em] ${dark ? "text-white/65" : "text-[#0b0b0b]/60"}`}>
          {note}
        </p>
      ) : null}
      {closed && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={
            `${NB_MONO} relative mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ` +
            (dark ? "border-white/40 text-white hover:bg-white/10" : "border-[#0b0b0b]/30 text-[#0b0b0b] hover:bg-[#0b0b0b]/5")
          }
        >
          {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
        </button>
      ) : null}
      {collapsed ? <div className="h-5" /> : <ul className={"relative " + (art ? "mt-8 sm:mt-12" : "mt-5")}>{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

function AddButton({ name, onAdd, dark }: { name: string; onAdd: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "flex h-10 w-10 items-center justify-center rounded-full text-[24px] font-light leading-none transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
        (dark
          ? "bg-white text-[#0b0b0b] focus-visible:ring-white focus-visible:ring-offset-[#0b0b0b]"
          : "bg-[#0b0b0b] text-white focus-visible:ring-[#0b0b0b] focus-visible:ring-offset-white")
      }
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
  dark,
}: {
  name: string;
  quantity: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  dark: boolean;
}) {
  return (
    <div className={"flex items-center rounded-full " + (dark ? "bg-white text-[#0b0b0b]" : "bg-[#0b0b0b] text-white")}>
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-light">
        −
      </button>
      <span className={`${NB_MONO} min-w-[1.3rem] text-center text-[13px] font-medium`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-light">
        +
      </button>
    </div>
  );
}

/** Renglón: nombre en grotesca, precio en mono, el "+" es un punto. */
export function NegroBlancoItemRow({
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
  tone = "blanco",
}: MenuItemCardProps & { tone?: NBTone }) {
  const dark = tone === "negro";
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} dark={dark} />
  ) : (
    <AddButton name={name} onAdd={onAdd} dark={dark} />
  );
  return (
    <li className={"flex items-center gap-4 border-t py-4 first:border-t-0 " + (dark ? "border-white/[0.12]" : "border-[#0b0b0b]/[0.08]")}>
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="flex items-baseline gap-3">
          <span className="text-[17px] font-medium leading-snug tracking-[-0.02em] sm:text-[19px]">{name}</span>
          <span className={`${NB_MONO} ml-auto shrink-0 text-[14px] tabular-nums sm:text-[15px] ${dark ? "text-white/80" : "text-[#0b0b0b]/75"}`}>
            {formatPrice(price)}
          </span>
        </p>
        {optionsHint && optionsHint !== "Se arma a tu gusto" ? (
          <span className={`${NB_MONO} mt-1 block text-[10.5px] uppercase tracking-[0.14em] ${dark ? "text-white/55" : "text-[#0b0b0b]/50"}`}>
            {optionsHint.replace(/^🌶️\s*/, "")}
          </span>
        ) : null}
        {description ? (
          <p className={`mt-1 line-clamp-3 text-[13.5px] leading-snug ${dark ? "text-white/60" : "text-[#0b0b0b]/60"}`}>{description}</p>
        ) : null}
      </button>
      {imageUrl ? (
        <div className="relative shrink-0">
          <button type="button" onClick={onOpen} aria-label={`Ver foto de ${name}`} className="block cursor-zoom-in">
            <Image
              src={imageUrl}
              alt=""
              width={96}
              height={96}
              unoptimized
              className={"h-[72px] w-[72px] rounded-full object-cover sm:h-[88px] sm:w-[88px] " + (dark ? "ring-1 ring-white/20" : "ring-1 ring-[#0b0b0b]/10")}
            />
          </button>
          {control ? <div className="absolute -bottom-1.5 -right-1.5">{control}</div> : null}
        </div>
      ) : control ? (
        <div className="shrink-0">{control}</div>
      ) : null}
    </li>
  );
}

/** Panel blanco para los premios: no rompe el negro/blanco. */
export function NegroBlancoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nb-rise mt-5 rounded-[32px] bg-white px-5 pt-6 pb-5 ring-1 ring-[#0b0b0b]/[0.07] sm:px-8" aria-label={title}>
      <div className={`${NB_MONO} flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em] text-[#0b0b0b]/50`}>
        <NBDots />
        <span className="h-px flex-1 bg-current opacity-40" aria-hidden />
      </div>
      <h2 className="mt-3 text-[34px] font-semibold lowercase leading-[0.95] tracking-[-0.05em] sm:text-[44px]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
