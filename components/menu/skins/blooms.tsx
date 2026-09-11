"use client";

/**
 * Piel "Blooms" del menú público — Blooms Coffee & Mocktails (C. Rey Hugo Capeto 17902, Villas del Rey, Chihuahua;
 * IG @blooms_cuu). Cuarta piel.
 *
 * No es "nuestra plantilla pintada de rosa": cada sección copia la COMPOSICIÓN de su página en el "Menú BLOOMS 2026"
 * (Canva, 8 páginas, 10-sep-2026):
 *  - portada: su logo grande sobre el rubor de acuarela, el horario con su tipografía y la píldora de Instagram,
 *  - cada sección es una página blanca con la franja rosa #ff5c9a a la izquierda y su acuarela GRANDE a un lado,
 *    con flecha a mano apuntando (como en su papel),
 *  - la barra de espresso es su tabla CALIENTE 12oz | EN LAS ROCAS 16oz, con dos precios por renglón,
 *  - si casi toda la sección cuesta lo mismo (filtrados $90, frappés $98, especiales $110, mocktails $98) el precio va
 *    junto al título y solo las excepciones llevan su etiqueta ($100), igual que su papel,
 *  - listas sin descripción van a dos columnas (frappés, filtrados),
 *  - "M O C K T A I L S  de autor" con "C O N  C A F É" subrayado en rosa, "DEATH BEFORE DECAF" detrás de los
 *    filtrados, el ajedrez rosa enmarcando las pizzas, "Postres y Panadería" en cursiva, sus notas al pie.
 * Acuarelas: recortes de SU menú (public/skins/blooms), mix-blend multiply. La lógica (carrito, opciones, detalle)
 * es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Montserrat, Pinyon_Script } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./blooms.css";

const mont = Montserrat({ weight: ["400", "500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--bl-sans" });
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], variable: "--bl-script" });

export const BL_ROOT_CLASS =
  `${mont.variable} ${pinyon.variable} ` +
  "bl-skin min-h-screen pl-[10px] text-[#1c1a1b] antialiased md:pl-[22px] [font-family:var(--bl-sans),Montserrat,Arial,sans-serif]";

export const BL_SCRIPT = "[font-family:var(--bl-script),'Snell_Roundhand',cursive]";

const INSTAGRAM_URL = "https://www.instagram.com/blooms_cuu/";
/** Lo que dice su portada. Si cambian el horario en su papel, se cambia aquí (el chip de "abierto" sí es vivo). */
const PAPER_HOURS: [string, string][] = [
  ["Lunes a Domingo:", "11:00am a 10:00pm"],
  ["Martes:", "CERRADO"],
];

function keyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/* ─────────────────────────── Piezas de marca ─────────────────────────── */

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0c.9 6.5 5.5 11.1 12 12-6.5.9-11.1 5.5-12 12-.9-6.5-5.5-11.1-12-12C6.5 11.1 11.1 6.5 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** La flecha a mano de su papel (de la acuarela al platillo). */
function HandArrow({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 90 60" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden>
      <path d="M84 8C62 4 30 10 16 40" fill="none" stroke="#1c1a1b" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M8 30l8 12 12-6" fill="none" stroke="#1c1a1b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Título a su manera: una palabra se parte con el principio en rosa ("MOCK·TAILS", "FILTRA·DOS"); varias
 *  palabras alternan ("BARRA **DE** ESPRESSO **Y** MÁS"). */
function SplitTitle({ text, className = "" }: { text: string; className?: string }) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const out: ReactNode[] = [];
  if (words.length === 1) {
    const w = words[0];
    const cut = Math.max(2, Math.round(w.length * 0.42));
    out.push(<span key="a" className="text-[#ff5c9a]">{w.slice(0, cut)}</span>, <span key="b">{w.slice(cut)}</span>);
  } else {
    words.forEach((w, i) =>
      out.push(
        <span key={i} className={i % 2 === 1 ? "text-[#ff5c9a]" : undefined}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>,
      ),
    );
  }
  return (
    <span className={className} style={{ textShadow: "2px 2px 0 rgba(28,26,27,0.13)" }}>
      {out}
    </span>
  );
}

function PriceTag({ price, big = false }: { price: number; big?: boolean }) {
  return (
    <span
      className={
        "inline-block bg-[#1c1a1b] font-extrabold leading-none tabular-nums text-white " +
        (big ? "px-2.5 py-1.5 text-[20px] sm:text-[24px]" : "px-2 py-[4px] text-[13.5px] sm:text-[15px]")
      }
    >
      {formatPrice(price)}
    </span>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function BloomsHeader({
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
  return (
    <header className="relative overflow-hidden">
      {/* Su portada: el rubor de acuarela a todo lo ancho y el logo grande, sin caja. */}
      <div className="bl-cover relative">
        <div className="mx-auto max-w-5xl px-4 pt-3 pb-5 sm:px-6 sm:pt-4 sm:pb-8 lg:pt-8 lg:pb-12">
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
            <div className="bl-rise relative mx-auto w-[48%] max-w-[440px] sm:w-full lg:max-w-[520px]">
              <Image
                src="/skins/blooms/portada_logo.jpg"
                alt={restaurantName || "Blooms Coffee & Mocktails"}
                width={974}
                height={1000}
                unoptimized
                priority
                className="bl-cover-logo aspect-square w-full object-cover"
              />
              <Sparkle className="bl-twinkle absolute right-[12%] top-[16%] h-7 w-7 text-[#ff5c9a] sm:h-9 sm:w-9" />
              <Sparkle className="bl-twinkle absolute left-[6%] bottom-[18%] h-4 w-4 text-[#ff5c9a]/70 [animation-delay:1.1s]" />
            </div>

            <div className="bl-rise min-w-0 text-center lg:text-left" style={{ animationDelay: "140ms" }}>
              <h1 className="sr-only">{restaurantName || "Blooms Coffee & Mocktails"}</h1>
              {/* El horario como su portada: la etiqueta en rosa espaciado, la hora en negro. */}
              {/* En teléfono los dos horarios van lado a lado (11-sep: la portada tapaba el menú). */}
              <dl className="grid grid-cols-[auto_auto] justify-center gap-x-5 sm:block sm:space-y-1">
                {PAPER_HOURS.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-extrabold tracking-[0.2em] text-[#ff5c9a] sm:text-[18px]">{k}</dt>
                    <dd className="text-[16px] font-black tracking-[0.08em] text-[#1c1a1b] sm:text-[28px]">{v}</dd>
                  </div>
                ))}
              </dl>
              {!loading && tagline ? (
                <p className={`${BL_SCRIPT} mt-2 text-[24px] leading-tight text-[#6d2f47] [text-wrap:balance] sm:mt-3 sm:text-[36px]`}>{tagline}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:mt-5 lg:justify-start">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bl-ig inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-[14px] font-extrabold tracking-[0.06em] text-white shadow-[0_10px_24px_-10px_rgba(221,42,123,0.8)] transition-transform hover:scale-[1.03]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white/90" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="white" strokeWidth="2.2">
                      <circle cx="12" cy="8.5" r="3.5" />
                      <path d="M5 20c1.2-3.6 4-5.3 7-5.3s5.8 1.7 7 5.3" strokeLinecap="round" />
                    </svg>
                  </span>
                  @blooms_cuu
                </a>
                {schedule ? (
                  <p
                    className={
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] " +
                      (schedule.open ? "bg-[#1c1a1b] text-white" : "bg-white text-[#1c1a1b] ring-2 ring-[#1c1a1b]")
                    }
                  >
                    <span className={"h-2 w-2 rounded-full " + (schedule.open ? "bg-[#ff5c9a]" : "bg-[#1c1a1b]")} aria-hidden />
                    {schedule.label}
                  </p>
                ) : null}
              </div>
              {address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[11.5px] font-bold uppercase sm:mt-3 tracking-[0.1em] text-[#6d2f47] underline decoration-[#ff5c9a]/50 underline-offset-4"
                >
                  <span className="min-w-0 truncate">{address}</span>
                  <span aria-hidden className="shrink-0">↗</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="bl-checker h-[30px]" aria-hidden />
    </header>
  );
}

/** Blooms no usa la portada suelta: su arte ya vive en el encabezado. */
export function BloomsCover() {
  return null;
}

/* ─────────────────────────── Cada sección = su página ─────────────────────────── */

type Art = { src: string; w: number; h: number };
const A = (src: string, w: number, h: number): Art => ({ src: `/skins/blooms/${src}.jpg`, w, h });

type SectionStyle = {
  match: RegExp;
  art?: Art;
  /** Cursiva con SUS palabras bajo el título. */
  script?: string;
  /** El título mismo va en cursiva ("Postres y Panadería", "Pizzas"). */
  scriptTitle?: boolean;
  /** "M O C K T A I L S  de autor" + subtítulo espaciado subrayado ("C O N  C A F É"). */
  mocktails?: { sub: string; withTitle: boolean };
  /** Marca de agua de su papel detrás de la acuarela. */
  watermark?: string;
  /** Ajedrez rosa arriba y abajo (su página de pizzas). */
  checker?: boolean;
  /** Nota de su papel al pie de la sección. */
  note?: string;
  /** Nota en caja negra (como "Postres sujetos a disponibilidad."). */
  boxNote?: string;
};

const SECTION: SectionStyle[] = [
  { match: /^barra de espresso/, art: A("latte_taza", 560, 400) },
  { match: /^filtrados/, art: A("chemex", 300, 560), script: "Cafés especiales", watermark: "DEATH BEFORE DECAF" },
  { match: /^frappes?$/, art: A("frappe", 230, 560), script: "¡todos son grandes!" },
  { match: /^especiales$/, art: A("especial_copa", 260, 560), script: "de la casa" },
  { match: /^mocktails con cafe/, art: A("m_espresso_tonic", 280, 560), mocktails: { sub: "con café", withTitle: true } },
  { match: /^mocktails sin cafe/, art: A("m_pink_colada", 250, 560), mocktails: { sub: "sin café", withTitle: false } },
  { match: /^postres/, art: A("p_cheesecake", 560, 350), scriptTitle: true, boxNote: "Postres sujetos a disponibilidad." },
  { match: /^crepas especiales/, art: A("c_crepa_salada", 560, 560) },
  {
    match: /^crepas?$/,
    art: A("c_crepa_fresa", 560, 480),
    script: "elige tus ingredientes",
    note: "Te pedimos paciencia ya que todos nuestros alimentos son preparados al momento para que tu experiencia sea fresca y deliciosa. Gracias <3",
  },
  { match: /^entradas/, art: A("e_ensalada", 560, 450) },
  { match: /^croissants?/, art: A("e_croissant", 560, 470), script: "calientes al horno" },
  { match: /^pizzas?$/, art: A("z_pizza_quesos", 560, 450), script: "preparadas con pan pita, al horno", scriptTitle: true, checker: true },
  { match: /^chilaquiles/, art: A("z_chilaquiles", 560, 470) },
];

function sectionFor(category: string): SectionStyle | null {
  const k = keyOf(category);
  return SECTION.find((s) => s.match.test(k)) ?? null;
}

function Spaced({ text, className = "" }: { text: string; className?: string }) {
  return <span className={className}>{text.toUpperCase().split("").join(" ")}</span>;
}

export function BloomsCategorySection({
  category,
  index,
  children,
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
  sectionPrice = null,
  priceColumns = null,
  twoCol = false,
}: {
  category: string;
  index: number;
  children: ReactNode;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
  /** Precio común de la sección: va junto al título (y los renglones que cuestan eso no repiten etiqueta). */
  sectionPrice?: number | null;
  /** Encabezados de columnas de precio ("CALIENTE" 12oz | "EN LAS ROCAS" 16oz). */
  priceColumns?: [string, string, string, string] | null;
  /** Lista corta a dos columnas (sin descripciones). */
  twoCol?: boolean;
}) {
  const s = sectionFor(category);
  const id = `menu-cat-${index}`;
  const art = s?.art ?? null;
  const title = s?.mocktails ? (
    s.mocktails.withTitle ? (
      <span className="block text-center">
        <span className="block text-[26px] font-black tracking-[0.34em] sm:text-[34px]" style={{ textShadow: "2px 2px 0 rgba(28,26,27,0.13)" }}>
          <span className="text-[#ff5c9a]">MOCK</span>TAILS
        </span>
        <span className="block text-[11px] font-black tracking-[0.5em] sm:text-[12px]">DE AUTOR</span>
      </span>
    ) : null
  ) : s?.scriptTitle ? (
    <span className={`${BL_SCRIPT} block text-[46px] leading-[1.05] text-[#1c1a1b] sm:text-[58px]`}>
      {category.split(/\s+/).map((w, i) => (
        <span key={i} className={i % 2 === 1 ? "text-[#ff5c9a]" : undefined}>
          {w}{" "}
        </span>
      ))}
    </span>
  ) : (
    <SplitTitle text={category} className="block text-[23px] font-black leading-tight tracking-[0.06em] sm:text-[30px]" />
  );

  return (
    <section
      aria-labelledby={id}
      className={"bl-page bl-rise relative mt-7 overflow-hidden first:mt-0 " + (closed ? "opacity-60" : "")}
      style={{ animationDelay: `${Math.min(index, 6) * 70 + 200}ms` }}
    >
      {s?.checker ? <div className="bl-checker h-[26px]" aria-hidden /> : null}
      <div className="px-4 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className={art ? "grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8" : ""}>
          <div className="min-w-0">
            {/* Encabezado de su página */}
            <div className={art ? "relative pr-[30%] sm:pr-[38%] lg:pr-0" : "relative"}>
              {art ? (
                <div className="pointer-events-none absolute right-0 top-[-8px] w-[28%] sm:w-[36%] lg:hidden" aria-hidden>
                  <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized className="bl-art bl-float ml-auto h-24 w-auto max-w-full object-contain sm:h-40" />
                  <HandArrow className="absolute -left-6 bottom-0 h-7 w-10 opacity-80" />
                </div>
              ) : null}
              {s?.mocktails && !s.mocktails.withTitle ? null : <div className="h-[2px] w-full bg-[#1c1a1b]" aria-hidden />}
              <h2 id={id} className={s?.mocktails && !s.mocktails.withTitle ? "sr-only" : "flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"}>
                {title ?? category}
                {sectionPrice != null && !s?.mocktails ? <PriceTag price={sectionPrice} big /> : null}
              </h2>
              {s?.mocktails && !s.mocktails.withTitle ? null : <div className="h-[2px] w-full bg-[#1c1a1b]" aria-hidden />}
              {s?.mocktails ? (
                <p className="mt-4 flex items-center gap-3">
                  <Spaced text={s.mocktails.sub} className="text-[16px] font-black text-[#ff5c9a] underline decoration-[#ff5c9a] decoration-2 underline-offset-[6px] sm:text-[18px]" />
                  {sectionPrice != null ? <PriceTag price={sectionPrice} /> : null}
                </p>
              ) : null}
              {s?.script ? (
                <p className={`${BL_SCRIPT} mt-1.5 text-[26px] leading-none text-[#6d2f47] sm:text-[32px]`}>{s.script}</p>
              ) : null}
              {note ? <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#e8407f]">{note}</p> : null}
              {closed && onToggle ? (
                <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={!collapsed}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-[#ff5c9a] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#e8407f] hover:bg-[#ff5c9a]/10"
                >
                  {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
                </button>
              ) : null}
            </div>

            {priceColumns && !collapsed ? (
              <div className="mt-3 flex items-end justify-end gap-2 pr-[52px] sm:mt-5 sm:gap-3" aria-hidden>
                {[0, 2].map((k) => (
                  <div key={k} className="w-[66px] text-center sm:w-[92px]">
                    <span className="block bg-[#1c1a1b] px-1 py-[3px] text-[9.5px] font-black tracking-[0.04em] text-white sm:text-[11px]">{priceColumns[k]}</span>
                    <span className="block pt-0.5 text-[10px] font-black text-[#ff5c9a] underline">{priceColumns[k + 1]}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {collapsed ? <div className="h-4" /> : (
              <ul className={(art ? "mt-5 sm:mt-7 lg:mt-5 " : "mt-5 ") + (twoCol ? "grid grid-cols-1 sm:grid-cols-2 sm:gap-x-10" : "")}>{children}</ul>
            )}

            {s?.note ? (
              <p className="mt-4 text-[11.5px] font-bold leading-snug text-[#1c1a1b] underline decoration-[#1c1a1b]/40 underline-offset-2">{s.note}</p>
            ) : null}
            {s?.boxNote ? (
              <p className="mt-5 text-center">
                <span className="inline-block bg-[#1c1a1b] px-3 py-1.5 font-serif text-[15px] tracking-[0.04em] text-white">{s.boxNote}</span>
              </p>
            ) : null}
          </div>

          {/* Escritorio: su acuarela grande a un lado, como media página de su papel. */}
          {art ? (
            <div className="relative hidden lg:block" aria-hidden>
              <div className="sticky top-24">
                {s?.watermark ? (
                  <p className="absolute left-0 top-24 w-[55%] text-left font-serif text-[28px] font-bold leading-[1.05] tracking-[0.02em] text-[#1c1a1b]/[0.06]">
                    {s.watermark.split(" ").map((w) => (
                      <span key={w} className="block">{w}</span>
                    ))}
                  </p>
                ) : null}
                <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized className={"bl-art bl-float relative max-h-[300px] w-auto object-contain " + (s?.watermark ? "ml-auto" : "mx-auto")} />
                <HandArrow className="mx-auto mt-2 h-10 w-16" flip />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {s?.checker ? <div className="bl-checker h-[26px]" aria-hidden /> : null}
    </section>
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/** La acuarela de SU menú junto al platillo, solo si no es la misma del encabezado de la sección. */
const ITEM_ART: [RegExp, Art][] = [
  [/carlota/, A("p_carlota", 400, 520)],
  [/affogato/, A("p_affogato", 330, 520)],
  [/torre de nutella/, A("p_torre_nutella", 560, 360)],
  [/moscow/, A("m_moscow", 440, 510)],
  [/jamaiquino/, A("m_jamaiquino", 420, 490)],
  [/lavanda/, A("m_lavanda", 250, 540)],
  [/pina brew/, A("tiki_pina", 300, 450)],
  [/^crepa base/, A("c_crepa_platano", 440, 560)],
  [/^papas taro/, A("e_papas", 560, 470)],
  [/^peperoni|^pepperoni/, A("z_pizza_pepperoni", 560, 340)],
];

function itemArtFor(name: string): Art | null {
  const k = keyOf(name);
  for (const [re, art] of ITEM_ART) if (re.test(k)) return art;
  return null;
}

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff5c9a] text-[24px] font-semibold leading-none text-white shadow-[0_8px_18px_-8px_rgba(255,92,154,0.95)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c9a] focus-visible:ring-offset-2"
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex items-center rounded-full bg-[#ff5c9a] text-white shadow-[0_8px_18px_-8px_rgba(255,92,154,0.95)]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className="min-w-[1.3rem] text-center text-[14px] font-extrabold">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

/** Renglón: • NOMBRE en mayúsculas anchas; precio en caja negra (o dos columnas en la barra); su acuarela al lado. */
export function BloomsItemRow({
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
  altPrice,
  priceColumns = false,
  hidePrice = false,
}: MenuItemCardProps & {
  /** Segundo precio de la tabla (EN LAS ROCAS). null = "-" como en su papel. */
  altPrice?: number | null;
  /** La sección es tabla de dos precios. */
  priceColumns?: boolean;
  /** Cuesta lo mismo que la sección: la etiqueta ya está junto al título. */
  hidePrice?: boolean;
}) {
  const control = !orderingEnabled ? (
    <span className="w-10" aria-hidden />
  ) : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  const art = imageUrl ? null : itemArtFor(name);
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" && !priceColumns ? optionsHint.replace(/^🌶️\s*/, "") : null;

  return (
    <li className="flex items-center gap-2.5 border-t border-dashed border-[#ff5c9a]/30 py-3 first:border-t-0 sm:gap-3">
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className="flex items-start gap-2">
          <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#1c1a1b]" aria-hidden />
          <span className="min-w-0 flex-1 text-[13.5px] font-extrabold uppercase leading-snug tracking-[0.16em] text-[#1c1a1b] sm:text-[15px]">{name}</span>
          {!priceColumns && !hidePrice ? <PriceTag price={price} /> : null}
        </p>
        {hint ? <span className="mt-1 block pl-4 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#e8407f]">{hint}</span> : null}
        {description ? (
          <p className="mt-1 line-clamp-3 pl-4 text-[12.5px] font-semibold leading-snug tracking-[0.02em] text-[#e8407f]">{description}</p>
        ) : null}
      </button>
      {priceColumns ? (
        <>
          <span className="w-[66px] text-center text-[15px] font-black tracking-[0.06em] tabular-nums sm:w-[92px] sm:text-[17px]">{formatPrice(price)}</span>
          <span className="w-[66px] text-center text-[15px] font-black tracking-[0.06em] tabular-nums sm:w-[92px] sm:text-[17px]">
            {altPrice != null ? formatPrice(altPrice) : "-"}
          </span>
        </>
      ) : null}
      {art ? (
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="relative hidden shrink-0 min-[400px]:block">
          <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized aria-hidden className="bl-art h-[76px] w-[76px] object-contain sm:h-[96px] sm:w-[96px]" />
        </button>
      ) : imageUrl ? (
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="shrink-0">
          <Image src={imageUrl} alt="" width={96} height={96} unoptimized className="h-[68px] w-[68px] object-cover ring-2 ring-[#ff5c9a]/30 sm:h-[84px] sm:w-[84px]" />
        </button>
      ) : null}
      <div className="shrink-0">{control}</div>
    </li>
  );
}

/** Tarjeta de premios como una página más. */
export function BloomsPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bl-page bl-rise mt-7 px-4 pt-6 pb-5 sm:px-8" aria-label={title}>
      <div className="h-[2px] w-full bg-[#1c1a1b]" aria-hidden />
      <h2 className="py-2.5">
        <SplitTitle text={title} className="block text-[22px] font-black tracking-[0.06em] sm:text-[26px]" />
      </h2>
      <div className="h-[2px] w-full bg-[#1c1a1b]" aria-hidden />
      <div className="mt-4">{children}</div>
    </section>
  );
}
