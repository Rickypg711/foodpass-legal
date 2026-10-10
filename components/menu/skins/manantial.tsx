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
 * 7-oct: llegaron las fotos de ADENTRO (Saira) y de su pantalla de precios. De ahí sale el cuerpo:
 *  - La pared: lila (#efe6f6) con dibujos a línea en magenta (conos, paletas, copas, cerezas, fresas) y arriba
 *    una franja MAGENTA (#a12a8c) con puntitos blancos y la orilla en ola. Ese es el fondo de la hoja.
 *  - El techo: lámparas en forma de paleta, de colores (verde, rojo, amarillo, naranja, azul marino, magenta,
 *    celeste). Van flotando en la portada.
 *  - Su pantalla de precios: pizarra morada oscura; "Nuestras" en cursiva verde agua y "NIEVES" en mayúsculas
 *    gordas y angostas, blancas. Así va el título de cada sección ("Nuestros COCTELES", "Refréscate AGUAS").
 * La portada sigue siendo la fachada (su letrero), porque es su logo. La lógica (carrito, opciones, detalle)
 * es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { Baloo_2, Nunito, Oswald, Dancing_Script } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./manantial.css";
import "./skinTokens.generated.css";

const baloo = Baloo_2({ weight: ["700", "800"], subsets: ["latin"], variable: "--mn-display" });
const nunito = Nunito({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--mn-sans" });
const oswald = Oswald({ weight: ["600", "700"], subsets: ["latin"], variable: "--mn-board" });
const script = Dancing_Script({ weight: ["600", "700"], subsets: ["latin"], variable: "--mn-script" });

/** Solo las fuentes (sin fondo ni alto de pantalla): para la tarjeta de compartir del panel. */
export const MN_FONT_VARS = `${baloo.variable} ${nunito.variable} ${oswald.variable} ${script.variable}`;

export const MN_ROOT_CLASS =
  `${baloo.variable} ${nunito.variable} ${oswald.variable} ${script.variable} ` +
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
  // Como su pantalla: primero lo que se pide por tamaño (la nieve, las aguas), luego lo suelto de barato a caro.
  const priceOf = (r: MnRow<T>) => (r.kind === "sizes" ? r.sizes[0]!.item.price : r.item.price);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ka = a.r.kind === "sizes" ? 0 : 1;
      const kb = b.r.kind === "sizes" ? 0 : 1;
      return ka - kb || priceOf(a.r) - priceOf(b.r) || a.i - b.i;
    })
    .map(({ r }) => r);
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

/** El cono de su letrero: bola de chocolate con su crema escurriendo, sobre un cono de galleta cuadriculado. */
export function MnScoop({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 88" aria-hidden className={className}>
      <defs>
        <clipPath id="mn-cono-clip">
          <path d="M14 38 L50 38 L32 86 Z" />
        </clipPath>
      </defs>
      {/* Cono de galleta */}
      <path d="M14 38 L50 38 L32 86 Z" fill="#e0a85a" stroke="#9a6326" strokeWidth="2" strokeLinejoin="round" />
      <g clipPath="url(#mn-cono-clip)" stroke="#a86d2c" strokeWidth="1.6" opacity="0.8">
        <path d="M6 30 L58 82 M6 42 L58 94 M6 18 L58 70 M18 30 L70 82" />
        <path d="M58 30 L6 82 M58 42 L6 94 M58 18 L6 70 M46 30 L-6 82" />
      </g>
      {/* La crema que asoma en la orilla */}
      <path d="M10 38 q6 6 11 1 q5 6 11 0 q6 6 11 0 q5 6 11 -1 q2 -4 0 -6 L10 32 q-2 3 0 6 z" fill="#f7ecd4" />
      {/* La bola de chocolate con brillo y su escurrido */}
      <circle cx="32" cy="22" r="18" fill="#5a3222" />
      <path d="M15 28 q4 9 10 6 q3 8 8 2 q5 7 9 0 q5 4 7 -6" fill="#5a3222" />
      <path d="M20 16 c3 -7 10 -9 16 -8" stroke="#8f6049" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="40" cy="14" r="2.4" fill="#8f6049" />
      <path d="M26 36 v5 q0 3 -2 3 q-2 0 -2 -3 v-3" fill="#5a3222" />
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

/** "Nuestras" / "Nuestros" / "Refréscate" en cursiva, como su pantalla de precios. */
const SCRIPT_WORD: Record<string, string> = {
  nieves: "Nuestras",
  helados: "Nuestros",
  paletas: "Nuestras",
  cocteles: "Nuestros",
  "coctel de frutas": "Nuestros",
  snacks: "",
  aguas: "Refréscate",
  "aguas frescas": "Refréscate",
  extras: "",
  malteadas: "Nuestras",
  "fresas con crema": "Nuestras",
};

/** Título de sección como su pantalla: cursiva verde agua chiquita + MAYÚSCULAS gordas y angostas. */
function BoardTitle({ children, id }: { children: string; id?: string }) {
  const word = SCRIPT_WORD[mnKeyOf(children)] ?? "";
  return (
    <h2 id={id} className="flex items-baseline justify-center gap-2 text-center leading-none">
      {word ? <span className="[font-family:var(--mn-script),cursive] text-[22px] font-bold text-[#8fe3dc] sm:text-[24px]">{word}</span> : null}
      <span className="[font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[30px] font-bold uppercase tracking-[0.01em] text-white sm:text-[34px]">
        {children}
      </span>
    </h2>
  );
}

/** Las lámparas del techo: paletas de colores flotando. */
const LAMPS: { c: string; x: string; y: string; r: number; w: number }[] = [
  { c: "#1f5d4c", x: "4%", y: "18%", r: -8, w: 54 },
  { c: "#e04b4b", x: "84%", y: "10%", r: 70, w: 46 },
  { c: "#e7d83a", x: "10%", y: "62%", r: 80, w: 38 },
  { c: "#f08a3c", x: "88%", y: "58%", r: -14, w: 44 },
  { c: "#2f3a8f", x: "76%", y: "80%", r: 60, w: 34 },
  { c: "#d62f8f", x: "18%", y: "88%", r: -20, w: 36 },
  { c: "#7cc8e8", x: "92%", y: "34%", r: 20, w: 28 },
];
/** Chispas de colores (como las de un helado) regadas por la pared morada de la portada. */
const SPRINKLES: { c: string; x: number; y: number; r: number }[] = [
  { c: "#ffffff", x: 6, y: 8, r: 30 }, { c: "#f7d54a", x: 14, y: 30, r: -40 }, { c: "#7cc8e8", x: 26, y: 12, r: 70 },
  { c: "#ff7aa8", x: 34, y: 40, r: 15 }, { c: "#ffffff", x: 46, y: 6, r: -20 }, { c: "#8fe3dc", x: 58, y: 34, r: 50 },
  { c: "#f7d54a", x: 66, y: 10, r: -60 }, { c: "#ff7aa8", x: 76, y: 28, r: 35 }, { c: "#ffffff", x: 88, y: 16, r: -15 },
  { c: "#7cc8e8", x: 94, y: 44, r: 80 }, { c: "#ffffff", x: 4, y: 56, r: -70 }, { c: "#ff7aa8", x: 12, y: 78, r: 20 },
  { c: "#8fe3dc", x: 22, y: 64, r: -35 }, { c: "#f7d54a", x: 8, y: 92, r: 60 }, { c: "#ffffff", x: 96, y: 64, r: 10 },
  { c: "#7cc8e8", x: 2, y: 40, r: -50 }, { c: "#ff7aa8", x: 98, y: 8, r: 75 }, { c: "#ffffff", x: 90, y: 80, r: -25 },
  { c: "#f7d54a", x: 82, y: 70, r: 40 }, { c: "#8fe3dc", x: 92, y: 90, r: -65 }, { c: "#ffffff", x: 18, y: 48, r: 55 },
  { c: "#f7d54a", x: 40, y: 22, r: -10 }, { c: "#ff7aa8", x: 86, y: 54, r: -45 }, { c: "#ffffff", x: 92, y: 30, r: 65 },
];
function Sprinkles() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {SPRINKLES.map((p, i) => (
        <span key={i} className="mn-sprinkle absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.c, transform: `rotate(${p.r}deg)` } as CSSProperties} />
      ))}
    </div>
  );
}

function Lamps() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {LAMPS.map((l, i) => (
        <span
          key={i}
          className="mn-lamp absolute"
          style={{ left: l.x, top: l.y, width: l.w, height: Math.round(l.w * 0.42), background: l.c, transform: `rotate(${l.r}deg)`, animationDelay: `${i * 0.4}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** El listón blanco en arco de su letrero, con "Paletería y Heladería" en azul. */
function Ribbon({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 76" className={className} aria-hidden>
      <defs>
        <path id={id} d="M28 64 Q160 -6 292 64" />
      </defs>
      {/* El listón: una banda blanca con filo azul, en arco, y el texto azul montado en ella. */}
      <path d="M28 64 Q160 -6 292 64" fill="none" stroke="#1d4ed8" strokeWidth="32" strokeLinecap="round" />
      <path d="M28 64 Q160 -6 292 64" fill="none" stroke="#fff" strokeWidth="27" strokeLinecap="round" />
      <text fontSize="16.5" fontWeight="800" fill="#1d4ed8" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--mn-display), 'Baloo 2', Nunito, sans-serif" letterSpacing="0.3">
        <textPath href={`#${id}`} startOffset="50%">
          Paletería y Heladería
        </textPath>
      </text>
          </svg>
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
    <header className="mn-wall mn-rise relative overflow-hidden px-4 pb-0 pt-8 sm:px-6 sm:pt-10">
      <Sprinkles />
      <Lamps />
      <div className="relative mx-auto max-w-3xl text-center">
        {/* El listón blanco en arco: "Paletería y Heladería" en azul. */}
        <Ribbon className="mx-auto block h-[72px] w-[300px] sm:h-[84px] sm:w-[352px]" />
        <div className="relative -mt-1 inline-block">
          <MnScoop className="mn-scoop absolute -top-12 right-[3%] h-[74px] w-[54px] sm:-top-14 sm:h-[88px] sm:w-[64px]" />
          <h1 className={`${MN_TITLE} mn-bubble mn-bubble--big px-1 text-[clamp(46px,14.5vw,84px)] leading-[0.95] text-white`}>{name}</h1>
        </div>
        <p className={`${MN_NAME} mn-bubble mt-1.5 text-[19px] leading-none tracking-[0.04em] text-white sm:text-[22px]`}>
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
      {/* La franja magenta de su pared, con sus puntitos blancos, que escurre sobre el lila (la ola va fuera del
          morado: abajo se ve la pared). */}
      <div className="mn-band relative -mx-4 h-9 sm:-mx-6" aria-hidden />
      <div className="relative -mx-4 -mb-px -mt-[3px] h-6 bg-[#efe6f6] sm:-mx-6" aria-hidden>
        <Drip className="absolute inset-0 block h-6 w-full" fill="#a12a8c" />
      </div>
    </header>
  );
}

/* ─────────────────────────── Hoja ─────────────────────────── */

const LAMP_COLORS = ["#e04b4b", "#e7d83a", "#f08a3c", "#7cc8e8", "#d62f8f", "#1f5d4c", "#2f3a8f"];

/** La cinta de sabores: corre despacio bajo la portada, cada sabor separado por una lamparita de color. */
function FlavorTicker({ flavors }: { flavors: string[] }) {
  if (flavors.length < 3) return null;
  const run = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined}>
      {flavors.map((f, i) => (
        <span key={`${f}-${i}`} className="inline-flex items-center gap-3">
          {f}
          <i style={{ background: LAMP_COLORS[i % LAMP_COLORS.length] }} />
        </span>
      ))}
    </span>
  );
  return (
    <div className="mn-ticker -mx-4 mb-6 py-2.5 sm:-mx-6" role="presentation">
      <div className="mn-ticker__track [font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[14px] font-semibold uppercase leading-none tracking-[0.12em] text-white">
        <span className="mn-ticker__lead [font-family:var(--mn-script),cursive] text-[19px] font-bold normal-case tracking-normal text-[#8fe3dc]">Sabores</span>
        {run(false)}
        {run(true)}
        {run(true)}
      </div>
    </div>
  );
}

export function ManantialSheet({ children, flavors = [] }: { children: ReactNode; flavors?: string[] }) {
  return (
    <div className="pb-6">
      <FlavorTicker flavors={flavors} />
      <div className="mn-sheet">{children}</div>
    </div>
  );
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
  const ref = useRef<HTMLElement>(null);
  // Entrada al hacer scroll, como Kame: solo se "arma" lo que todavía no está en pantalla; sin IntersectionObserver
  // o con movimiento reducido no se arma nada y la vitrina se ve de una vez.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("mn-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("mn-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section
      ref={ref}
      aria-labelledby={id}
      data-mn={mnKeyOf(category)}
      className={"mn-vitrina mn-rise " + (closed ? "opacity-60" : "")}
      style={{ animationDelay: `${Math.min(index, 6) * 70 + 160}ms` } as CSSProperties}
    >
      {/* El letrero de la vitrina: morado, letras de bomba y la crema escurriendo. */}
      <div className="mn-vitrina__head px-4 pb-1 pt-4 sm:px-6">
        <BoardTitle id={id}>{category}</BoardTitle>
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
      <Drip className="block h-5 w-full" fill="#3d2a6e" />
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
  index = 0,
  topSeller = false,
}: MenuItemCardProps & { index?: number; hideDescription?: boolean }) {
  const iv = { "--i": index } as CSSProperties;
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  const desc = hideDescription ? null : description?.trim() || null;
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const text = (
    <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="block w-full min-w-0 cursor-pointer text-left">
      {topSeller ? (<span className={`mb-1 inline-flex w-fit items-center px-2 py-[3px] text-[10.5px] font-bold leading-none tracking-[0.06em] ${MN_NAME} bg-gradient-to-b from-[#4a3480] to-[#3d2a6e] text-[#8fe3dc] rounded-full`}>🔥 Más pedido</span>) : null}
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
      <li style={iv} className={"mn-row -mx-2 flex items-start gap-3 px-2 py-3 " + (quantity > 0 ? "mn-row--on" : "")}>
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
    <li style={iv} className={"mn-row -mx-2 flex items-center gap-3 px-2 py-3 " + (quantity > 0 ? "mn-row--on" : "")}>
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
  index = 0,
}: {
  name: string;
  description?: string | null;
  sizes: MnSizeCell[];
  orderingEnabled?: boolean;
  optionsHint?: string | null;
  index?: number;
}) {
  const any = sizes.some((s) => s.quantity > 0);
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  return (
    <li style={{ "--i": index } as CSSProperties} className={"mn-row -mx-2 px-2 py-3 " + (any ? "mn-row--on" : "")}>
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
        <BoardTitle>{title}</BoardTitle>
      </div>
      <Drip className="block h-5 w-full" fill="#3d2a6e" />
      <div className="mn-vitrina__body px-4 pb-5 pt-2 text-[#2a1740] sm:px-6">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Flujo de pago (checkout, pedido, puntos) ─────────────────────────── */

/** Encabezado del flujo: su pared morada con el letrero chico, las lamparitas y la franja magenta que escurre. */
export function ManantialFlowHeader({
  restaurantId,
  restaurantName,
  title,
  subtitle = null,
  back = true,
}: {
  restaurantId: string;
  restaurantName: string;
  title: string;
  subtitle?: string | null;
  back?: boolean;
}) {
  const name = restaurantName || "El Manantial";
  // La página del pedido manda el nombre del local como título; con el letrero arriba se repetiría.
  const shownTitle = title === restaurantName && subtitle ? subtitle : title;
  const shownSub = shownTitle === subtitle ? null : subtitle;
  return (
    <header className="mn-wall relative overflow-hidden px-4 pt-14 text-center">
      <Lamps />
      {back ? (
        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          aria-label="Regresar al menú"
          className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/80 bg-white/15 text-lg font-bold text-white backdrop-blur-sm hover:bg-white/25"
        >
          ←
        </Link>
      ) : null}
      <div className="relative mx-auto max-w-md pb-5 pt-1">
        <div className="relative inline-block">
          <MnScoop className="absolute -top-7 right-[1%] h-12 w-9" />
          <p className={`${MN_TITLE} mn-bubble text-[30px] leading-none text-white`}>{name}</p>
        </div>
        <h1 className="mt-3 [font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[24px] font-bold uppercase leading-none text-white">{shownTitle}</h1>
        {shownSub ? <p className="mt-1.5 text-[13px] font-semibold text-white/85">{shownSub}</p> : null}
      </div>
      <div className="mn-band relative -mx-4 h-5" aria-hidden />
      <div className="relative -mx-4 -mb-px h-5 bg-[#efe6f6]" aria-hidden>
        <Drip className="absolute inset-0 block h-5 w-full" fill="#a12a8c" />
      </div>
    </header>
  );
}

/* ─────────────────────────── Tarjeta de compartir (panel) ─────────────────────────── */

/**
 * La tarjeta de "Compartir menú" del panel con su morado (7-oct, Ricardo: "el QR con su morado, el que ellos
 * comparten"). Es un objeto impreso y también la imagen que se manda por WhatsApp: arriba su letrero con el cono y
 * las chispas, la franja magenta que escurre, y su pared lila con el QR en tinta morada. El QR lo pasa el panel
 * (siempre la URL de ID, que no se rompe).
 */
export function ManantialShareCard({
  name,
  qr,
  linkText,
  hasRewards,
}: {
  name: string;
  qr: ReactNode;
  linkText: string;
  hasRewards: boolean;
}) {
  return (
    <div className={`${MN_FONT_VARS} mn-skin overflow-hidden rounded-[20px] text-center`} style={{ minHeight: 0, backgroundAttachment: "scroll", backgroundSize: "300px 300px" }}>
      <div className="mn-wall relative overflow-hidden px-3 pt-9">
        <Sprinkles />
        <div className="relative">
          <Ribbon className="mx-auto block h-[52px] w-[216px]" />
          <div className="relative -mt-1 inline-block">
            <MnScoop className="absolute -top-9 right-[-2px] h-[52px] w-[38px]" />
            <p className={`${MN_TITLE} mn-bubble mn-bubble--big px-1 text-[40px] leading-[0.95] text-white`}>{name || "El Manantial"}</p>
          </div>
          <p className={`${MN_NAME} mn-bubble mt-1 pb-4 text-[15px] leading-none text-white`}>La Original</p>
        </div>
        <div className="mn-band relative -mx-3 h-6" aria-hidden />
        <div className="relative -mx-3 -mb-px -mt-[3px] h-5 bg-[#efe6f6]" aria-hidden>
          <Drip className="absolute inset-0 block h-5 w-full" fill="#a12a8c" />
        </div>
      </div>
      <div className="px-5 pb-5 pt-2">
        {/* Como los títulos de su menú (su pantalla): pizarra morada, "Escanea" en cursiva verde agua y "Y PIDE" en
            blanco. Sobre la pared con dibujos, un título suelto en morado no se leía (Ricardo, 7-oct). */}
        <p className="mx-auto flex w-fit items-baseline justify-center gap-2 rounded-full bg-gradient-to-b from-[#4a3480] to-[#3d2a6e] px-5 pb-2 pt-1.5 leading-none shadow-[0_10px_22px_-14px_rgba(20,5,40,0.8)]">
          <span className="[font-family:var(--mn-script),cursive] text-[22px] font-bold text-[#8fe3dc]">Escanea</span>
          <span className="[font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[26px] font-bold uppercase text-white">y pide</span>
        </p>
        <div className="mx-auto mt-3 w-fit rounded-[20px] bg-white p-3 shadow-[0_0_0_5px_#fff,0_0_0_7px_#b99ad3,0_16px_30px_-18px_rgba(20,5,40,0.6)]">{qr}</div>
        {/* Sobre la pared con dibujos el texto suelto no se lee: va en pastillas blancas. */}
        <p className="mx-auto mt-3 w-fit rounded-full bg-white px-3.5 py-1 text-[13.5px] font-bold tabular-nums text-[#3d2a6e] shadow-[0_6px_14px_-10px_rgba(20,5,40,0.6)]">
          {linkText}
        </p>
        {hasRewards ? (
          <p className="mx-auto mt-2 w-fit rounded-xl bg-white/95 px-3 py-1.5 text-[12px] font-semibold leading-4 text-[#5b2a80]">
            Con cada compra juntas puntos. Da tu número al pagar.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Tarjeta de MESA del Manantial: su letrero chico con chispas, la franja que escurre y su pared con el QR morado. */
export function ManantialTableCard({ name, mesa, qr, loyaltyLive, ctaLead = "Escanea", ctaTail = "y ordena", sub }: { name: string; mesa: string; qr: ReactNode; loyaltyLive: boolean; ctaLead?: string; ctaTail?: string; sub?: string }) {
  return (
    <div className={`${MN_FONT_VARS} mn-skin h-full overflow-hidden rounded-2xl text-center`} style={{ minHeight: 0, backgroundAttachment: "scroll", backgroundSize: "260px 260px" }}>
      <div className="mn-wall relative overflow-hidden px-2 pt-3">
        <Sprinkles />
        <p className={`${MN_TITLE} mn-bubble relative text-[22px] leading-none text-white`}>{name || "El Manantial"}</p>
        <p className="relative mt-1.5 pb-2.5 [font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[26px] font-bold uppercase leading-none text-white">{mesa}</p>
        <div className="mn-band relative -mx-2 h-4" aria-hidden />
        <div className="relative -mx-2 -mb-px -mt-[3px] h-3.5 bg-[#efe6f6]" aria-hidden>
          <Drip className="absolute inset-0 block h-3.5 w-full" fill="#a12a8c" />
        </div>
      </div>
      <div className="px-3 pb-4 pt-1">
        <div className="mx-auto w-fit rounded-xl bg-white p-2 shadow-[0_0_0_3px_#fff,0_0_0_4.5px_#b99ad3]">{qr}</div>
        <p className="mx-auto mt-2.5 flex w-fit items-baseline gap-1.5 rounded-full bg-gradient-to-b from-[#4a3480] to-[#3d2a6e] px-3.5 pb-1 pt-0.5 leading-none">
          <span className="[font-family:var(--mn-script),cursive] text-[15px] font-bold text-[#8fe3dc]">{ctaLead}</span>
          <span className="[font-family:var(--mn-board),Oswald,Impact,sans-serif] text-[16px] font-bold uppercase text-white">{ctaTail}</span>
        </p>
        <p className="mx-auto mt-1.5 w-fit rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-[#5b2a80]">
          {sub ?? (loyaltyLive ? "Pide desde tu teléfono y acumula puntos" : "Pide desde tu teléfono")}
        </p>
      </div>
    </div>
  );
}
