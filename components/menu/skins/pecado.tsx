"use client";

/**
 * Piel "Pecado" del menú público — la carta de Pecado Escondido (La Punta,
 * Puerto Escondido) en la web.
 *
 * Todo lo visual sale de sus tres cartas de papel (fotos en Google Maps, 10-sep-
 * 2026): fondo rojo #c03427 con iconos a línea (camarón, limón, chile, tostada,
 * nacho), hoja crema #ffeecf con esquinas redondas, títulos PLATILLOS / BEBIDAS
 * en bloque rojo con sombra amarilla, cada sección con su píldora y sus dos
 * iconitos, renglón NOMBRE $250 en itálica condensada roja, descripción en
 * Montserrat, y la caja amarilla #fbaa19 de EXTRAS / HAPPY HOUR. El patrón, los
 * iconos y el logo son recortes de SU papel y SU logo (public/skins/pecado),
 * nada inventado. La lógica (carrito, opciones, detalle) es la de MenuView:
 * aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Barlow_Condensed, Lilita_One, Montserrat } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./pecado.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--pc-block" });
const barlow = Barlow_Condensed({ weight: ["700", "800"], style: ["normal", "italic"], subsets: ["latin"], variable: "--pc-name" });
const montserrat = Montserrat({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--pc-body" });

export const PECADO = {
  red: "#c03427",
  ink: "#a61c21",
  cream: "#ffeecf",
  yellow: "#fbaa19",
  line: "#d76e25",
  /* La carta verde PECADO MAÑANERO (desayunos). */
  olive: "#969e57",
  moss: "#48612c",
  mossInk: "#4d5f2a",
  mossYellow: "#faa61a",
};

export type PecadoTone = "red" | "green";

/** Clase raíz: fuentes + fondo rojo con patrón (pecado.css .pecado-skin) + tinta. */
export const PECADO_ROOT_CLASS =
  `${lilita.variable} ${barlow.variable} ${montserrat.variable} ` +
  "min-h-screen text-[#a61c21] [font-family:var(--pc-body),Montserrat,sans-serif] pecado-skin";

const F = {
  block: "[font-family:var(--pc-block),Impact,sans-serif]",
  name: "[font-family:var(--pc-name),'Arial_Narrow',sans-serif]",
};

/** Sombra amarilla en bloque, como PLATILLOS / BEBIDAS del papel. */
const BLOCK_SHADOW = { textShadow: "0.035em 0.035em 0 #fbaa19, 0.07em 0.07em 0 #fbaa19" } as const;

export function pecadoKey(category: string): string {
  return category
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** Iconos de las píldoras, recortados del papel (public/skins/pecado/ic_*.png). */
const PILL_ICON: Record<string, string> = {
  ceviches: "ic_ceviches",
  tostadas: "ic_tostadas",
  chicharrines: "ic_chicharrines",
  tostilocos: "ic_tostilocos",
  especiales: "ic_especiales",
  chelas: "ic_chelas",
  micheladas: "ic_micheladas",
  softs: "ic_softs",
  cocteles: "ic_cocteles",
  mezcal: "ic_mezcal",
};

/** Cómo lo escribe SU papel cuando difiere del dato. */
const LABEL: Record<string, string> = {
  "para botanear": "¡Pa' Botanear!",
  "taqueria": "Taquería",
  "happy hour 3 a 4 pm": "Happy Hour · 3 a 4 pm",
  "happy hour 7 a 8 pm": "Happy Hour · 7 a 8 pm",
  "bebidas mañaneras": "Bebidas",
  "extras mañaneros": "Extras",
};

export function pecadoCategoryLabel(category: string): string {
  return LABEL[pecadoKey(category)] ?? category;
}

/** Caja amarilla del papel: EXTRAS (platillos) y HAPPY HOUR (bebidas). */
function isYellow(category: string): boolean {
  return !pecadoIsBreakfast(category) && /\b(extras?|happy hour|promos?|promociones?)\b/.test(pecadoKey(category));
}

/** Píldoras grandes sin icono: MARISQUITOS FRESCOS, TAQUERÍA, ¡PA' BOTANEAR! */
function isBigPill(category: string): boolean {
  return /\b(marisquitos|taqueria|botanear)\b/.test(pecadoKey(category));
}

/** La carta verde: PECADO MAÑANERO (desayunos, 8am–3pm). Categorías tal cual
 *  se montaron el 10-sep (scripts/seedPecadoMananero.js en FOODPASS). */
export function pecadoIsBreakfast(category: string): boolean {
  return /\b(chilaquiles|tortilla costeña|sopes?|molletes?|enchiladas?|taco cabo|huevos|jugos?|mañaner[oa]s?)\b/.test(
    pecadoKey(category),
  );
}

/** Qué va en la hoja BEBIDAS. Lo demás es PLATILLOS. */
export function pecadoIsDrink(category: string): boolean {
  return /\b(chelas?|cervezas?|micheladas?|softs?|refrescos?|cocteles?|cocktails?|mezcal(es)?|happy hour|promos?|promociones?|bebidas?|aguas?|limonadas?|jugos?|cafes?|vinos?|licores?|shots?)\b/.test(
    pecadoKey(category),
  );
}

/** Corta la lista en hojas: corridas seguidas de platillos / bebidas. */
export function pecadoSheets<T extends { category: string }>(
  groups: T[],
): { title: string; tone: PecadoTone; groups: T[] }[] {
  const sheets: { title: string; tone: PecadoTone; groups: T[] }[] = [];
  for (const g of groups) {
    const breakfast = pecadoIsBreakfast(g.category);
    const title = breakfast ? "Pecado Mañanero" : pecadoIsDrink(g.category) ? "Bebidas" : "Platillos";
    const last = sheets[sheets.length - 1];
    if (last && last.title === title) last.groups.push(g);
    else sheets.push({ title, tone: breakfast ? "green" : "red", groups: [g] });
  }
  return sheets;
}

/* ─────────────────────────── Encabezado ─────────────────────────── */

export function PecadoHeader({
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
    <header className="relative">
      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6 sm:pt-7 lg:max-w-4xl">
        <div className="pecado-rise rounded-[28px] bg-[#ffeecf] px-5 pt-6 pb-5 text-center shadow-[0_12px_32px_rgba(60,10,5,0.28)]">
          <Image
            src="/skins/pecado/logo.png"
            alt={restaurantName || "Pecado Escondido"}
            width={913}
            height={479}
            unoptimized
            priority
            className="mx-auto h-auto w-[230px] sm:w-[290px]"
          />
          {!loading && tagline ? (
            <p className={`${F.name} mt-1 text-[19px] font-bold uppercase italic leading-none tracking-wide text-[#a61c21]`}>
              {tagline}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {schedule ? (
              <p
                className={
                  `${F.name} inline-flex items-center rounded-full border-2 border-[#a61c21] px-3 py-1 text-[13px] font-bold uppercase tracking-wide ` +
                  (schedule.open ? "bg-[#a61c21] text-[#ffeecf]" : "bg-transparent text-[#a61c21]")
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
                className="inline-flex max-w-full items-start gap-1 text-[12.5px] font-semibold leading-snug text-[#a61c21]/85 underline decoration-[#a61c21]/40 underline-offset-4"
              >
                <span aria-hidden>📍</span>
                <span className="line-clamp-2 text-left">{address}</span>
              </a>
            ) : null}
          </div>
          {secondarySubtitle ? (
            <p className="mt-2 text-[12px] font-semibold text-[#a61c21]/65">{secondarySubtitle}</p>
          ) : null}
        </div>
        <PecadoPolaroids />
      </div>
    </header>
  );
}

/* ─────────────────────────── Polaroids ─────────────────────────── */

/** Tres fotos de SU Instagram (@pecadoescondido, sep-2026), pegadas como
 *  polaroids torcidas: tacos pero de mar, el poke bowl y la banda. Tocar
 *  cualquiera abre su Instagram. Recortes en public/skins/pecado/ig_*.jpg. */
const POLAROIDS: { src: string; caption: string; tilt: string; delay: string }[] = [
  { src: "ig_tacos", caption: "Tacos, pero de mar", tilt: "-rotate-[5deg]", delay: "260ms" },
  { src: "ig_poke", caption: "WTF es poke bowl", tilt: "rotate-[3deg] translate-y-2", delay: "340ms" },
  { src: "ig_banda", caption: "La banda", tilt: "-rotate-[2deg]", delay: "420ms" },
];

export function PecadoPolaroids() {
  return (
    <a
      href="https://www.instagram.com/pecadoescondido/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ver a Pecado Escondido en Instagram"
      className="group mx-auto mt-5 flex max-w-md items-end justify-center gap-2 px-1 sm:mt-6 sm:gap-4"
    >
      {POLAROIDS.map((p) => (
        <figure
          key={p.src}
          className={`pecado-rise w-[31%] rotate-0 bg-[#ffeecf] p-1.5 pb-5 shadow-[0_10px_24px_rgba(60,10,5,0.35)] transition-transform duration-300 group-hover:rotate-0 sm:p-2 sm:pb-6 ${p.tilt}`}
          style={{ animationDelay: p.delay }}
        >
          <Image src={`/skins/pecado/${p.src}.jpg`} alt={p.caption} width={480} height={480} unoptimized className="aspect-square w-full object-cover" />
          <figcaption className={`${F.name} mt-1.5 truncate text-center text-[11px] font-bold uppercase leading-none tracking-wide text-[#a61c21] sm:text-[12px]`}>
            {p.caption}
          </figcaption>
        </figure>
      ))}
    </a>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function PecadoCover({ url, name }: { url: string; name: string }) {
  return (
    <div className="pecado-rise mb-6 overflow-hidden rounded-[28px] ring-4 ring-[#ffeecf]" style={{ animationDelay: "120ms" }}>
      <Image src={url} alt={`Portada de ${name}`} width={1600} height={900} unoptimized priority className="h-40 w-full object-cover sm:h-56" />
    </div>
  );
}

/* ─────────────────────────── Hoja ─────────────────────────── */

/** La hoja crema con su título en bloque (PLATILLOS / BEBIDAS). */
export function PecadoSheet({
  title,
  tone = "red",
  index = 0,
  children,
}: {
  title: string;
  tone?: PecadoTone;
  index?: number;
  children: ReactNode;
}) {
  const green = tone === "green";
  return (
    <div
      className={
        "pecado-rise mt-6 rounded-[28px] bg-[#ffeecf] px-4 pt-6 pb-5 shadow-[0_12px_32px_rgba(60,10,5,0.28)] first:mt-0 sm:px-6 sm:pt-8 sm:pb-7 " +
        (green ? "pecado-green ring-[10px] ring-[#969e57] mt-9 sm:mt-10" : "")
      }
      style={{ animationDelay: `${index * 120 + 180}ms` }}
    >
      {green ? (
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <Image src="/skins/pecado/ic_bowl_mananero.png" alt="" width={184} height={153} unoptimized aria-hidden className="pecado-float h-16 w-auto shrink-0 sm:h-24" />
          <h2
            className={`${F.block} text-center text-[38px] uppercase leading-[0.9] tracking-wide text-[#48612c] sm:text-[52px]`}
            style={{ textShadow: "0.035em 0.035em 0 #faa61a, 0.07em 0.07em 0 #faa61a" }}
          >
            Pecado
            <br />
            Mañanero
          </h2>
        </div>
      ) : (
        <h2
          className={`${F.block} text-center text-[44px] uppercase leading-none tracking-wide text-[#a61c21] sm:text-[56px]`}
          style={BLOCK_SHADOW}
        >
          {title}
        </h2>
      )}
      {green ? (
        <p className={`${F.name} mx-auto mt-3 max-w-md text-center text-[15px] font-bold uppercase italic leading-tight tracking-wide text-[#4d5f2a] sm:text-[17px]`}>
          Desayunos mexicanos con sabor costeño · ingredientes frescos y el toque especial de Pecado · todos los días de 8am a 3pm
        </p>
      ) : null}
      {children}
    </div>
  );
}

/* ─────────────────────────── Secciones ─────────────────────────── */

function Pill({ category, id }: { category: string; id: string }) {
  const icon = PILL_ICON[pecadoKey(category)];
  const big = isBigPill(category) || !icon;
  return (
    <h3
      id={id}
      className={
        `${F.name} mx-auto flex w-full items-center justify-center gap-3 rounded-full border-2 border-[#a61c21] px-4 uppercase leading-none tracking-[0.05em] text-[#a61c21] ` +
        (big ? "max-w-xl py-2.5 text-[24px] font-extrabold sm:text-[28px]" : "max-w-md py-1.5 text-[17px] font-extrabold sm:text-[19px]")
      }
    >
      {icon ? <Image src={`/skins/pecado/${icon}.png`} alt="" width={114} height={88} unoptimized className="h-7 w-auto" aria-hidden /> : null}
      <span className="pt-0.5">{pecadoCategoryLabel(category)}</span>
      {icon ? <Image src={`/skins/pecado/${icon}.png`} alt="" width={114} height={88} unoptimized className="h-7 w-auto" aria-hidden /> : null}
    </h3>
  );
}

export function PecadoCategorySection({
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
  const yellow = isYellow(category);
  const id = `menu-cat-${index}`;
  const toggle =
    closed && onToggle ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={`${F.name} mt-3 inline-flex items-center gap-2 rounded-full border-2 border-[#a61c21] px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-wide text-[#a61c21] hover:bg-[#a61c21]/10`}
      >
        {collapsed ? `Ver los ${itemCount} platillos ▾` : "Ocultar ▴"}
      </button>
    ) : null;

  if (yellow) {
    // La botella del papel vive en HAPPY HOUR (recorte de SU carta, con
    // transparencia): en el renglón del título, para no pisar los precios.
    const bottle = pecadoKey(category) === "happy hour";
    return (
      <section
        aria-labelledby={id}
        className={"mt-6 rounded-[22px] bg-[#fbaa19] px-4 pt-4 pb-3 sm:px-5 " + (closed ? "opacity-60" : "")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <h3 id={id} className={`${F.block} text-[30px] uppercase leading-none tracking-wide text-[#a61c21] sm:text-[36px]`}>
              {pecadoCategoryLabel(category)}
            </h3>
            {note ? <p className="mt-1 text-[13px] font-semibold text-[#a61c21]/85">{note}</p> : null}
            {toggle}
          </div>
          {bottle ? (
            <Image
              src="/skins/pecado/botella.png"
              alt=""
              width={118}
              height={441}
              unoptimized
              aria-hidden
              className="pecado-float -mt-8 mr-1 h-28 w-auto shrink-0 select-none sm:-mt-10 sm:h-36"
            />
          ) : null}
        </div>
        {collapsed ? null : <ul className="mt-1">{children}</ul>}
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className={"mt-7 " + (closed ? "opacity-60" : "")}>
      <Pill category={category} id={id} />
      {note ? <p className="mt-2 text-center text-[13px] font-semibold text-[#a61c21]/80">{note}</p> : null}
      {toggle ? <div className="text-center">{toggle}</div> : null}
      {collapsed ? null : <ul className="mt-3">{children}</ul>}
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
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#a61c21] text-2xl font-bold leading-none text-[#ffeecf] shadow-[0_3px_0_#7a1014] transition-transform hover:scale-105 active:translate-y-[2px] active:shadow-none"
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
    <div className="flex items-center rounded-full bg-[#a61c21] text-[#ffeecf] shadow-[0_3px_0_#7a1014]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className={`${F.name} min-w-[1.4rem] text-center text-[17px] font-extrabold`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

/** El renglón del papel: NOMBRE          $250 / descripción en Montserrat. */
export function PecadoItemRow({
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
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="flex items-baseline justify-between gap-3">
          <span className={`${F.name} text-[19px] font-extrabold uppercase italic leading-tight tracking-wide text-[#a61c21] sm:text-[21px]`}>
            {name}
          </span>
          <span className={`${F.name} shrink-0 text-[19px] font-extrabold italic tabular-nums text-[#a61c21] sm:text-[21px]`}>
            {formatPrice(price)}
          </span>
        </p>
        {optionsHint && optionsHint !== "Se arma a tu gusto" ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold italic text-[#a61c21]/80">
            {/\b(salsa|picante|chile)/i.test(optionsHint) ? (
              <Image src="/skins/pecado/ic_chiles.png" alt="" width={84} height={122} unoptimized aria-hidden className="h-5 w-auto" />
            ) : null}
            {optionsHint.replace(/^🌶️\s*/, "")}
          </span>
        ) : null}
        {description ? (
          <p className="mt-0.5 line-clamp-3 text-[13.5px] font-medium leading-snug text-[#a61c21]/90">{description}</p>
        ) : null}
      </button>
      {imageUrl ? (
        <div className="relative shrink-0">
          <button type="button" onClick={onOpen} aria-label={`Ver foto de ${name}`} className="block cursor-zoom-in">
            <Image src={imageUrl} alt="" width={96} height={96} unoptimized className="h-[76px] w-[76px] rounded-2xl object-cover ring-[3px] ring-[#a61c21] sm:h-24 sm:w-24" />
          </button>
          {control ? <div className="absolute -bottom-2 -right-2">{control}</div> : null}
        </div>
      ) : control ? (
        <div className="shrink-0">{control}</div>
      ) : null}
    </li>
  );
}

/** Hoja crema con píldora, para los premios: no rompe el papel. */
export function PecadoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pecado-rise mt-6 rounded-[28px] bg-[#ffeecf] px-4 pt-5 pb-5 shadow-[0_12px_32px_rgba(60,10,5,0.28)] sm:px-6" aria-label={title}>
      <h2 className={`${F.name} mx-auto flex w-full max-w-md items-center justify-center rounded-full border-2 border-[#a61c21] px-4 py-1.5 text-[17px] font-extrabold uppercase leading-none tracking-[0.05em] text-[#a61c21] sm:text-[19px]`}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
