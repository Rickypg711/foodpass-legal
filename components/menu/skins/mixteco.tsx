"use client";

/**
 * Piel "Mixteco" del menú público — Mixteco, cocina mexicana (Av. Insurgentes 300, San Felipe V, Chihuahua;
 * IG @mixteco.cuu). Quinta piel (11-sep-2026).
 *
 * No es "nuestra plantilla pintada de verde": copia la COMPOSICIÓN de su menú (Google Sites, 5 páginas):
 *  - portada verde bosque con SU frase partida en dos letras — "EN / Mixteco / CADA PLATILLO / ES UN RITUAL DE /
 *    Sanación": la de molde áspera (Bungee + filtro de papel, como su sello) y la cursiva verde (Sacramento) — y su logo;
 *  - cada hoja crema abre con su jaguar corriendo entre "MEX" y "CUU";
 *  - las secciones de comida llevan el nombre VERTICAL en el margen izquierdo (pegado al subir) y los platillos a dos
 *    columnas en escritorio: título de molde espaciado, precio gris-verde espaciado a la derecha, descripción ligera;
 *  - sus fotos a sangre entre secciones, en el mismo lugar que en su papel;
 *  - la hoja de bebidas: título + cursiva ("BEBIDAS especiales", "jugos (16oz)", "frutales", "gasificados"), precio
 *    común junto a la cursiva, renglones de una línea; postres con sus fotos; niños con sus platos redondos;
 *  - al lado, SALSAS y GUISOS "de la casa" con sus iconos, su máscara de jaguar y su luna con estrella.
 * En escritorio usa todo el ancho (pedido de Ricardo): hojas de ~1100 px a dos columnas, como su papel.
 * Imágenes: recortes de SU menú (public/skins/mixteco). La lógica (carrito, opciones, detalle) es la de MenuView:
 * aquí solo se pinta.
 */

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Bungee, Josefin_Sans, Sacramento } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./mixteco.css";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--mx-display" });
const sacramento = Sacramento({ weight: "400", subsets: ["latin"], variable: "--mx-script" });
const josefin = Josefin_Sans({ weight: ["300", "400", "600", "700"], subsets: ["latin"], variable: "--mx-sans" });

export const MX_ROOT_CLASS =
  `${bungee.variable} ${sacramento.variable} ${josefin.variable} ` +
  "mx-skin min-h-screen text-[#1f3a2b] antialiased [font-family:var(--mx-sans),'Josefin_Sans',Futura,sans-serif]";

export const MX_DISPLAY = "[font-family:var(--mx-display),Impact,sans-serif] font-normal";
export const MX_SCRIPT = "[font-family:var(--mx-script),'Snell_Roundhand',cursive] font-normal";

const INSTAGRAM_URL = "https://www.instagram.com/mixteco.cuu/";
/** Lo que dice su Instagram. Si cambian el horario, se cambia aquí (el chip de "abierto" sí es vivo). */
const PAPER_HOURS = "Todos los días · 8:00 am – 5:30 pm";

const GREEN = "#234933";

function keyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/* ─────────────────────────── Portada ─────────────────────────── */

/** Filtro de papel para la letra de molde de su portada (bordes ásperos de sello). Vive una vez por página. */
function RoughFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="mx-rough" x="-4%" y="-12%" width="108%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

export function MixtecoHeader({
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
  const molde = `${MX_DISPLAY} mx-rough block tracking-[0.01em] text-[#cfe3cb]`;
  const cursiva = `${MX_SCRIPT} relative z-10 block text-[#6cbd8c]`;
  return (
    <header className="mx-cover relative overflow-hidden">
      <RoughFilter />
      {/* Su jaguar de fondo, casi invisible, como la marca de agua de su portada. */}
      <Image
        src="/skins/mixteco/jaguar_solo.png"
        alt=""
        width={200}
        height={100}
        unoptimized
        aria-hidden
        className="mx-wm pointer-events-none absolute -left-[14%] bottom-[-6%] w-[110%] max-w-[900px] -rotate-6 select-none lg:-left-[4%] lg:bottom-[-14%] lg:w-[58%]"
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-4 px-5 pt-5 pb-6 sm:gap-7 sm:px-8 sm:pt-8 sm:pb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:pt-16 lg:pb-20">
        {/* Logo e información: arriba en el teléfono, a la derecha en escritorio. */}
        <div className="mx-rise text-center lg:order-2">
          <Image
            src="/skins/mixteco/logo_lockup.png"
            alt={restaurantName || "Mixteco — cocina mexicana"}
            width={425}
            height={295}
            unoptimized
            priority
            className="mx-auto h-auto w-[150px] sm:w-[250px] lg:w-[330px]"
          />
          {!loading ? (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
                {schedule ? (
                  <p className="inline-flex items-center gap-2 rounded-full border border-[#cfe3cb]/35 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f6f5e0]">
                    <span className={"h-2 w-2 rounded-full " + (schedule.open ? "bg-[#6cbd8c]" : "bg-[#e3a17d]")} aria-hidden />
                    {schedule.label}
                  </p>
                ) : null}
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f5e0] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#234933] transition-transform hover:scale-[1.03]"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  @mixteco.cuu
                </a>
              </div>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#cfe3cb]/85">{PAPER_HOURS}</p>
              {address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[12.5px] text-[#cfe3cb]/75 underline decoration-[#6cbd8c]/50 underline-offset-4 hover:text-[#f6f5e0]"
                >
                  <span className="min-w-0 truncate">{address}</span>
                  <span aria-hidden className="shrink-0">↗</span>
                </a>
              ) : null}
            </>
          ) : null}
        </div>

        {/* SU frase, partida como en su portada. */}
        <div className="mx-rise text-center lg:order-1 lg:text-left" style={{ animationDelay: "120ms" }}>
          <h1 className="sr-only">{restaurantName || "Mixteco"} — menú</h1>
          <p className="select-none">
            <span className="sr-only">En Mixteco cada platillo es un ritual de sanación.</span>
            <span aria-hidden className={`${molde} text-[clamp(28px,8vw,70px)] leading-none`}>EN</span>
            <span aria-hidden className={`${cursiva} -mt-[0.32em] text-[clamp(46px,13vw,118px)] leading-[1.05] lg:-ml-1`}>
              Mixteco
            </span>
            <span aria-hidden className={`${molde} -mt-[0.28em] text-[clamp(22px,6.2vw,52px)] leading-[1.08]`}>CADA PLATILLO</span>
            <span aria-hidden className={`${molde} text-[clamp(22px,6.2vw,52px)] leading-[1.08]`}>ES UN RITUAL DE</span>
            <span aria-hidden className={`${cursiva} -mt-[0.34em] text-[clamp(42px,12vw,104px)] leading-[1.05] lg:ml-8`}>
              Sanación
            </span>
          </p>
        </div>
      </div>
    </header>
  );
}

/** Mixteco no usa la portada suelta: su arte vive en el encabezado. */
export function MixtecoCover() {
  return null;
}

/* ─────────────────────────── Hojas ─────────────────────────── */

type Photo = { src: string; w: number; h: number; alt: string };
const ph = (f: string, w: number, h: number, alt: string): Photo => ({ src: `/skins/mixteco/${f}.jpg`, w, h, alt });

// Cada foto, en el lugar donde la puso su papel.
const PH = {
  tortaAvena: [ph("ph_torta_d", 570, 318, "Torta"), ph("ph_avena", 507, 318, "Avena dulce")],
  desayuno: [ph("ph_desayuno", 1545, 292, "Chilango y omelette")],
  caldos: ph("ph_caldos", 402, 525, "Pozole y sopa de tortilla"),
  chilaquiles: [ph("ph_nostalgia", 793, 492, "Chilaquiles Nostalgia"), ph("ph_divorciados", 752, 492, "Chilaquiles divorciados")],
  tacos: [ph("ph_taco_costra", 468, 330, "Tacos con costra de queso"), ph("ph_tortas", 1075, 330, "Tortas de milanesa y de chilaquiles")],
  quesadilla: ph("ph_quesadilla", 426, 462, "Quesadilla con queso menonita"),
  casa: [ph("ph_casa", 795, 388, "Tampiqueña, flautas y tacos")],
};

type SectionStyle = {
  match: RegExp;
  /** Fotos a sangre antes / después de la sección. */
  before?: Photo[];
  after?: Photo[];
  /** Foto al lado de la lista (escritorio); en el teléfono va arriba. */
  aside?: Photo;
  /** Hoja de bebidas: título de molde + cursiva, o solo cursiva ("jugos"). */
  title?: string;
  script?: string;
  scriptTitle?: string;
  sub?: string;
  note?: string;
  kids?: boolean;
};

const SECTION: SectionStyle[] = [
  { match: /^entradas/, after: PH.tortaAvena },
  { match: /^clasicos/, after: PH.desayuno },
  { match: /^caldos/, aside: PH.caldos },
  { match: /^chilaquiles/, after: PH.chilaquiles },
  { match: /^tacos/, before: PH.tacos },
  { match: /^quesadillas/, aside: PH.quesadilla },
  { match: /^de la casa/, after: PH.casa },
  { match: /^bebidas/, title: "Bebidas", script: "especiales" },
  { match: /^jugos/, scriptTitle: "jugos", sub: "(16oz)" },
  { match: /^(aguas frutales|frutales|aguas)/, scriptTitle: "frutales", sub: "(16oz)" },
  { match: /^gasificados/, scriptTitle: "gasificados" },
  { match: /^postres/, note: "Elige una de las cubiertas para tu postre: Cajeta / Berries / Chocolate" },
  { match: /^ninos/, kids: true },
];

function sectionFor(category: string): SectionStyle | null {
  const k = keyOf(category);
  return SECTION.find((s) => s.match.test(k)) ?? null;
}

/** Sus cuatro hojas: 0 desayunos · 1 caldos, chilaquiles y tortas · 2 tacos, quesadillas y de la casa · 3 bebidas. */
function sheetOf(category: string): number {
  const k = keyOf(category);
  if (/^(entradas|tamales|clasicos|desayun)/.test(k)) return 0;
  if (/^(caldos|sopas|chilaquiles|tortas)/.test(k)) return 1;
  if (/^(tacos|quesadillas|de la casa)/.test(k)) return 2;
  if (/(bebida|jugo|agua|frutal|gasificad|refresc|cafe|postre|nino)/.test(k)) return 3;
  return 2;
}

export function mixtecoSheets<T extends { category: string }>(groups: T[]): { n: number; groups: T[] }[] {
  const byN = new Map<number, T[]>();
  for (const g of groups) {
    const n = sheetOf(g.category);
    byN.set(n, [...(byN.get(n) ?? []), g]);
  }
  return [...byN.entries()].sort((a, b) => a[0] - b[0]).map(([n, gs]) => ({ n, groups: gs }));
}

// El orden de SU papel dentro de cada sección (columna izquierda, luego derecha). Lo que no esté aquí va al final.
const PAPER_ORDER = [
  "Queso frito", "Sopa de tortilla (entrada)", "Papas Mixteco",
  "Desayuno tamal", "Tamalitos con queso", "Chilaquimal", "Torta de tamal", "Tamales en olla",
  "Huevos montados", "Enchiladas mañaneras", "Mixteco", "Oaxaca", "Chilango",
  "Burrote", "Molletes", "Avena dulce", "Omelette de pibil", "Norteño", "Omelette con chilaquiles",
  "Maruchan chipotle", "Pozole", "Sopa de tortilla",
  "Chilaquiles Nostalgia", "Chilaquiles clásicos", "Chilaquiles Fit", "Chilaquiles divorciados",
  "Torta de chilaquiles", "Torta de cochinita", "Torta de carnitas", "Torta de huevo con guiso", "Torta de milanesa", "Torta ahogada",
  "Tacos con costra de queso", "Tacos de canasta", "Tacos de milanesa", "Taco especial",
  "Quesadilla bañada", "Orden de quesadillas", "Quesadillas kit",
  "Sándwich supremo", "Milanesa Mixteco", "Sope", "Gringa Mixteca", "Flautas", "Tampiqueña", "Chimichanga", "Enchiladas",
  "Atole de guayaba", "Café americano / de olla", "Matcha", "Chocolate",
  "Amanecer", "Bida", "Energía", "Flor de sol",
  "Jamaica-guayaba", "Coco cremoso", "Tamarindo", "Limón", "Maracuyá-limón", "Horchata",
  "Agua mineral", "Limonada mineral", "Refresco", "Agua embotellada",
  "Pan de elote", "Dulcequiles",
  "Salchipulpos", "Huevito con salchicha", "Nuggets",
].map(keyOf);

export function mixtecoSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(keyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

/** "jugos (16oz) $69": si toda la sección cuesta lo mismo, el precio va junto al título, como en su papel. */
export function mixtecoSectionPrice(items: { price: number }[]): number | null {
  if (items.length < 3) return null;
  const p = items[0].price;
  return items.every((it) => it.price === p) ? p : null;
}

/** Dentro de "Tortas" su papel dice "DE CHILAQUILES", "AHOGADA"; en la Caja y el ticket el nombre va completo. */
function shownName(category: string, name: string): string {
  const c = keyOf(category);
  if (c === "tortas") return name.replace(/^torta\s+/i, "");
  if (c === "chilaquiles") return name.replace(/^chilaquiles\s+/i, "");
  return name;
}

function Runner() {
  return (
    <div className="flex justify-center pt-6 pb-1 sm:pt-8" aria-hidden>
      <Image src="/skins/mixteco/jaguar_run.png" alt="" width={345} height={120} unoptimized className="mx-trot h-auto w-[170px] sm:w-[230px]" />
    </div>
  );
}

function PhotoStrip({ photos, className = "" }: { photos: Photo[]; className?: string }) {
  return (
    <div
      className={"grid gap-[3px] " + className}
      style={{ gridTemplateColumns: photos.map((p) => `minmax(0,${p.w / p.h}fr)`).join(" ") } as CSSProperties}
    >
      {photos.map((p) => (
        <Image
          key={p.src}
          src={p.src}
          alt={p.alt}
          width={p.w}
          height={p.h}
          unoptimized
          className={"w-full object-cover " + (photos.length === 1 && p.w / p.h > 3 ? "h-32 sm:h-44 lg:h-56" : "h-36 sm:h-52 lg:h-64")}
        />
      ))}
    </div>
  );
}

const SALSAS: [string, string, string?][] = [
  ["s_rosa", "Rosa nostalgia", "betabel + chile morita"],
  ["s_mole", "Mole"],
  ["s_poblana", "Poblana"],
  ["s_chipotle", "Chipotle"],
  ["s_roja", "Roja"],
  ["s_verde", "Verde"],
];
const GUISOS: [string, string][] = [
  ["g_cochinita", "Cochinita pibil"],
  ["g_carnitas", "Carnitas"],
  ["g_chicharron", "Chicharrón prensado"],
  ["g_pollo", "Pollo"],
  ["g_asado", "Asado de puerco"],
  ["g_bistec", "Bistec ranchero"],
  ["g_milanesa", "Milanesa empanizada"],
];

function CasaList({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  return (
    <div className="mt-8 first:mt-0">
      <h3 className="leading-none">
        <span className={`${MX_DISPLAY} block text-[26px] tracking-[0.12em] text-[#234933] sm:text-[30px]`}>{title.toUpperCase()}</span>
        <span className={`${MX_SCRIPT} -mt-1 ml-16 block text-[34px] leading-none text-[#1f3a2b] sm:text-[40px]`}>de la casa</span>
      </h3>
      <ul className="mt-4 grid grid-cols-1 gap-y-2.5 min-[420px]:grid-cols-2 lg:grid-cols-1">
        {rows.map(([icon, name, sub]) => (
          <li key={name} className="flex items-center gap-3">
            <Image src={`/skins/mixteco/${icon}.png`} alt="" width={90} height={80} unoptimized aria-hidden className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
            <span className="min-w-0">
              <span className={`${MX_DISPLAY} block text-[14px] leading-tight tracking-[0.16em] text-[#1f3a2b] sm:text-[16px]`}>{name.toUpperCase()}</span>
              {sub ? <span className="block text-[13px] leading-tight text-[#1f3a2b]/75">({sub})</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Su columna de salsas y guisos (la media hoja derecha de su página de bebidas). */
function MixtecoCasa() {
  return (
    <aside className="border-t-2 border-[#234933]/80 px-4 pt-8 pb-10 sm:px-8 lg:border-t-0 lg:pt-10" aria-label="Salsas y guisos de la casa">
      <Image src="/skins/mixteco/luna_estrella.png" alt="" width={285} height={175} unoptimized aria-hidden className="mx-float mx-auto h-auto w-[150px] sm:w-[190px]" />
      <div className="mt-6">
        <CasaList title="Salsas" rows={SALSAS} />
        <CasaList title="Guisos" rows={GUISOS} />
      </div>
      <p className="mt-7 text-[14px] leading-snug text-[#1f3a2b]/80">
        Tu salsa y tu guiso los eliges al agregar tu platillo.
      </p>
    </aside>
  );
}

/** Una hoja crema de su papel. Las de comida abren con su jaguar; la de bebidas va a dos medias hojas. */
export function MixtecoSheet({ n, children }: { n: number; children: ReactNode }) {
  if (n === 3) {
    return (
      <section className="mx-sheet mx-rise relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[6px]">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0 px-4 pt-6 pb-8 sm:px-8 lg:border-r-2 lg:border-[#234933]/80 lg:pt-8">
            <Image src="/skins/mixteco/mask.png" alt="" width={275} height={175} unoptimized aria-hidden className="mx-auto h-auto w-[150px] sm:w-[190px] lg:ml-24" />
            {children}
          </div>
          <MixtecoCasa />
        </div>
      </section>
    );
  }
  return (
    <section className="mx-sheet mx-rise relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[6px]">
      <Runner />
      <div className="pb-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

export function MixtecoCategorySection({
  category,
  index,
  children,
  drinks = false,
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
  sectionPrice = null,
}: {
  category: string;
  index: number;
  children: ReactNode;
  /** Hoja de bebidas: título horizontal con cursiva, renglones de una línea. */
  drinks?: boolean;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
  sectionPrice?: number | null;
}) {
  const s = sectionFor(category);
  const id = `menu-cat-${index}`;
  const toggle =
    closed && onToggle ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-[#234933] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#234933] hover:bg-[#234933]/10"
      >
        {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
      </button>
    ) : null;
  const windowNote = note ? <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f7a50]">{closed ? "🕒 " : ""}{note}</p> : null;

  if (drinks) {
    const kids = !!s?.kids;
    return (
      <section aria-labelledby={id} className={"break-inside-avoid pt-7 first:pt-4 " + (closed ? "opacity-60" : "")}>
        <h2 id={id} className="flex items-end justify-between gap-3">
          <span className="min-w-0 leading-none">
            {s?.scriptTitle ? (
              <span className="flex items-baseline gap-2">
                <span className={`${MX_SCRIPT} text-[44px] leading-[0.9] text-[#1f3a2b] sm:text-[50px]`}>{s.scriptTitle}</span>
                {s.sub ? <span className="text-[14px] text-[#1f3a2b]/80">{s.sub}</span> : null}
              </span>
            ) : (
              <>
                <span className={`${MX_DISPLAY} block text-[26px] tracking-[0.1em] text-[#234933] sm:text-[30px]`}>{(s?.title ?? category).toUpperCase()}</span>
                {s?.script ? <span className={`${MX_SCRIPT} -mt-1 ml-1 block text-[38px] leading-none text-[#1f3a2b] sm:text-[44px]`}>{s.script}</span> : null}
              </>
            )}
          </span>
          {sectionPrice != null ? (
            <span className={`${MX_DISPLAY} mb-1 shrink-0 text-[17px] tracking-[0.18em] text-[#557061] tabular-nums`}>{formatPrice(sectionPrice)}</span>
          ) : null}
        </h2>
        {windowNote}
        {toggle}
        {collapsed ? null : (
          <ul className={kids ? "mt-4 grid grid-cols-3 gap-2 sm:gap-4" : "mt-2 pl-1 sm:pl-3"}>{children}</ul>
        )}
        {s?.note && !collapsed ? <p className="mt-2 pl-1 text-[13.5px] leading-snug text-[#1f3a2b]/80 sm:pl-3">**{s.note}</p> : null}
      </section>
    );
  }

  const label = category.toUpperCase();
  return (
    <section aria-labelledby={id} className={"relative " + (closed ? "opacity-60" : "")}>
      {s?.before ? <PhotoStrip photos={s.before} className="mt-4 mb-2" /> : null}
      <div className="flex gap-2.5 px-3 pt-6 pb-5 sm:gap-5 sm:px-6 lg:px-10">
        {/* Su nombre de sección, vertical en el margen. */}
        <div className="relative w-8 shrink-0 text-[24px] sm:w-11 sm:text-[34px]" style={{ minHeight: `${label.length * 0.8 + 0.6}em` }}>
          <h2 id={id} className={`${MX_DISPLAY} mx-vertical sticky top-[78px] leading-none tracking-[0.06em] text-[#234933]`}>
            {label}
          </h2>
        </div>
        <div className="min-w-0 flex-1">
          {windowNote}
          {toggle}
          {collapsed ? null : s?.aside ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-10">
              <Image
                src={s.aside.src}
                alt={s.aside.alt}
                width={s.aside.w}
                height={s.aside.h}
                unoptimized
                className="h-44 w-full rounded-[4px] object-cover sm:h-56 lg:order-2 lg:h-auto lg:max-h-[420px]"
              />
              <ul className="lg:order-1">{children}</ul>
            </div>
          ) : (
            <ul className="lg:columns-2 lg:gap-x-14">{children}</ul>
          )}
        </div>
      </div>
      {s?.after && !collapsed ? <PhotoStrip photos={s.after} className="mt-1" /> : null}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

function AddButton({ name, onAdd, small = false }: { name: string; onAdd: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "flex items-center justify-center rounded-full bg-[#234933] font-semibold leading-none text-[#f6f5e0] shadow-[0_8px_18px_-8px_rgba(20,50,35,0.9)] ring-2 ring-[#f6f5e0] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-[#6cbd8c] " +
        (small ? "h-9 w-9 text-[22px]" : "h-10 w-10 text-[24px]")
      }
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex items-center rounded-full bg-[#234933] text-[#f6f5e0] shadow-[0_8px_18px_-8px_rgba(20,50,35,0.9)] ring-2 ring-[#f6f5e0]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className="min-w-[1.3rem] text-center text-[14px] font-bold">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

function Price({ price, className = "" }: { price: number; className?: string }) {
  return <span className={`${MX_DISPLAY} shrink-0 tracking-[0.18em] text-[#557061] tabular-nums ${className}`}>{formatPrice(price)}</span>;
}

/** Renglón: TÍTULO de molde espaciado, precio gris-verde a la derecha, descripción ligera — como su papel. */
export function MixtecoItemRow({
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
  category,
  drinks = false,
  hidePrice = false,
}: MenuItemCardProps & {
  category: string;
  /** Hoja de bebidas: una línea, la descripción entre paréntesis como su "(355 ml)". */
  drinks?: boolean;
  /** Cuesta lo mismo que la sección: el precio ya va junto al título. */
  hidePrice?: boolean;
}) {
  const shown = shownName(category, name);
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  const control = (small = false) =>
    !orderingEnabled ? null : quantity > 0 ? (
      <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
    ) : (
      <AddButton name={name} onAdd={onAdd} small={small} />
    );

  // Niños: su plato redondo, nombre y precio arriba — como su papel.
  if (sectionFor(category)?.kids) {
    return (
      <li className="flex flex-col items-center text-center">
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="flex flex-col items-center">
          <span className={`${MX_DISPLAY} text-[10.5px] leading-tight tracking-[0.08em] text-[#1f3a2b] sm:text-[12px]`}>{name.toUpperCase()}</span>
          <Price price={price} className="mt-0.5 text-[12px]" />
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={170} height={170} unoptimized className="mt-2 h-[88px] w-[88px] rounded-full object-cover shadow-[0_10px_20px_-12px_rgba(20,50,35,0.8)] sm:h-[120px] sm:w-[120px]" />
          ) : null}
        </button>
        <div className={imageUrl ? "-mt-4" : "mt-2"}>{control(true)}</div>
      </li>
    );
  }

  if (drinks) {
    const desc = description ? description.replace(/\.$/, "") : null;
    return (
      <li className="flex items-center gap-2.5 border-t border-dashed border-[#234933]/15 py-2 first:border-t-0 sm:gap-3">
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 text-left">
          <span className={`${MX_DISPLAY} text-[13.5px] leading-snug tracking-[0.15em] text-[#1f3a2b] sm:text-[15.5px]`}>{shown.toUpperCase()}</span>
          {desc ? <span className="ml-1.5 text-[13.5px] leading-snug text-[#1f3a2b]/80">({desc})</span> : null}
          {hint ? <span className="mt-0.5 block text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2f7a50]">{hint}</span> : null}
        </button>
        {!hidePrice ? <Price price={price} className="text-[15px] sm:text-[16px]" /> : null}
        {imageUrl ? (
          <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="shrink-0">
            <Image src={imageUrl} alt="" width={120} height={90} unoptimized className="h-[52px] w-[64px] rounded-[4px] object-cover" />
          </button>
        ) : null}
        <div className="shrink-0">{control(true)}</div>
      </li>
    );
  }

  return (
    <li className="break-inside-avoid border-t border-dashed border-[#234933]/15 py-3.5 first:border-t-0 lg:[&:nth-child(n)]:border-t-0 lg:pb-5 lg:pt-0">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
          <span className="flex items-baseline gap-3">
            <span className={`${MX_DISPLAY} min-w-0 flex-1 text-[15px] leading-[1.25] tracking-[0.15em] text-[#1f3a2b] sm:text-[17px]`}>{shown.toUpperCase()}</span>
            <Price price={price} className="text-[15px] sm:text-[17px]" />
          </span>
          {hint ? <span className="mt-1 block text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2f7a50]">{hint}</span> : null}
          {description ? (
            <span className="mt-1 block text-[15px] leading-[1.35] text-[#1f3a2b]/85 line-clamp-4 sm:text-[15.5px]">{description}</span>
          ) : null}
        </button>
        {imageUrl ? (
          <div className="relative shrink-0">
            <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="block">
              <Image src={imageUrl} alt="" width={180} height={150} unoptimized className="h-[84px] w-[92px] rounded-[6px] object-cover shadow-[0_10px_22px_-14px_rgba(20,50,35,0.9)] sm:h-[96px] sm:w-[108px]" />
            </button>
            <div className="absolute -bottom-2.5 -right-2">{control(true)}</div>
          </div>
        ) : (
          <div className="shrink-0 pt-0.5">{control()}</div>
        )}
      </div>
    </li>
  );
}

/** Tarjeta de premios como una hoja más. */
export function MixtecoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-sheet mx-rise -mx-4 mt-8 px-5 pt-6 pb-6 sm:mx-0 sm:rounded-[6px] sm:px-8" aria-label={title}>
      <h2 className={`${MX_DISPLAY} text-[22px] tracking-[0.1em] text-[#234933] sm:text-[26px]`}>{title.toUpperCase()}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export { GREEN as MX_GREEN };
