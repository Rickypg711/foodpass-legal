"use client";

/**
 * Piel "Fresheria" del menú público — La Fresheria, postres y snacks (Calle Vicente Leñero 6323, Col. Saucito,
 * Chihuahua; IG @la.fresheriaa.postres, FB "La Fresheriaa Postres"). Décima piel (15-sep-2026).
 *
 * Fuente única: SU PDF de 19 páginas (rosa pálido, marco dorado de esquinas redondas, títulos en cursiva vino,
 * nombres en serif condensada, precios en píldoras blancas). Cada sección copia la COMPOSICIÓN de su página:
 *  - portada: sus fresas a línea detrás del logo "La Fresheria · postres y snacks" y "M E N U" subrayado con ♥;
 *  - Frappes / Extras: lista "nombre … precio" con la fresa (o el vaso) dibujado muy tenue detrás;
 *  - Malteadas y FreshePops: "Precio General" en píldora, y los sabores de la paleta en lista centrada;
 *  - Topings: la caja blanca con viñetas y "(Dos topings por vaso)";
 *  - Nieves: foto a la izquierda, nombre cursivo + píldora, "Incluye:", y las cajas Cobertura | Panes;
 *  - Enchilados y cada vaso de "Postres con crema": nombre cursivo, las tres píldoras CH · M · LT, la foto a la
 *    izquierda y "Incluye:" a la derecha, con Rebanadas / Cobertura / Panes abajo cuando el vaso los lleva;
 *  - Rebanadas: la caja con los tres pays, "Rebanada:" y la caja "Preparada:" con viñetas;
 *  - la hoja "Postres Con Crema": la fruta a escoger (una o varias) y "Mango + $15" con costo extra.
 * Fotos y dibujos: recortes de SU PDF (public/skins/fresheria). Los tamaños, la fruta, coberturas, panes, toppings,
 * sabores y extras NO están escritos aquí: se pintan desde los `optionGroups` de los platillos (lo que el dueño
 * cambie en su panel se ve igual en la hoja). La lógica (carrito, opciones, detalle) es la de MenuView: aquí solo
 * se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Great_Vibes, Bree_Serif, Poppins } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import type { ScheduleStatus } from "@/lib/schedule";
import "./fresheria.css";

const script = Great_Vibes({ weight: "400", subsets: ["latin"], variable: "--fr-script" });
const bree = Bree_Serif({ weight: "400", subsets: ["latin"], variable: "--fr-name" });
const poppins = Poppins({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--fr-sans" });

export const FR_ROOT_CLASS =
  `${script.variable} ${bree.variable} ${poppins.variable} ` +
  "fr-skin min-h-screen text-[#56052d] antialiased [font-family:var(--fr-sans),Poppins,system-ui,sans-serif]";

/** Sus títulos cursivos ("Frappes", "Nieves", "Postres Con Crema"). */
export const FR_SCRIPT = "[font-family:var(--fr-script),'Snell_Roundhand',cursive] font-normal";
/** Sus nombres en serif condensada ("Oreo", "Chispas De chocolate"). */
export const FR_NAME = "[font-family:var(--fr-name),'Bree_Serif',Georgia,serif] font-normal";

const INSTAGRAM_URL = "https://www.instagram.com/la.fresheriaa.postres/";
const WINE = "#56052d";
const MAGENTA = "#cb0465";
const GOLD = "#9e6036";

export function frKeyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Qué página de su PDF es cada sección. Lo que no esté en su papel sale como "otra" (una página más). */
export type FrBlock = "frappes" | "malteadas" | "pops" | "nieves" | "enchilados" | "rebanadas" | "postres" | "otra";
export function frBlockOf(category: string): FrBlock {
  const k = frKeyOf(category);
  if (k.includes("frapp")) return "frappes";
  if (k.includes("maltead")) return "malteadas";
  if (k.includes("pop") || k.includes("palet")) return "pops";
  if (k.startsWith("nieve")) return "nieves";
  if (k.includes("enchilad")) return "enchilados";
  if (k.includes("rebanad")) return "rebanadas";
  if (k.includes("crema") || k.includes("postre")) return "postres";
  return "otra";
}

function money(price: number): string {
  return formatPrice(price);
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/**
 * En Firestore los frappés van como "Frappé Oreo" porque el carrito y el WhatsApp solo llevan el nombre (hay un
 * "Rafaello" frappé y un "Rafaello" vaso). En su papel la página ya dice "Frappes": aquí se quita SOLO para pintar.
 */
export function frShortName(name: string, category: string): string {
  if (frBlockOf(category) !== "frappes") return name;
  const out = name.replace(/^frapp[eé]s?\s+(?:de\s+)?/i, "");
  return out.length >= 2 ? out : name;
}

/* ─────────────────────────── Piezas de su papel ─────────────────────────── */

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5C16.9 12.6 12.6 16.9 12 22.5 11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5z" fill="#dca467" />
    </svg>
  );
}

function ScriptTitle({ children, id, size = "md", className = "" }: { children: ReactNode; id?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sz = size === "lg" ? "text-[54px] sm:text-[66px]" : size === "sm" ? "text-[34px] sm:text-[40px]" : "text-[44px] sm:text-[52px]";
  return (
    <h2 id={id} className={`${FR_SCRIPT} ${sz} leading-[1.05] text-[#56052d] [text-wrap:balance] ${className}`}>
      {children}
    </h2>
  );
}

/** "Sabores", "Cobertura", "Panes", "Rebanadas": sus subtítulos cursivos chicos. */
function ScriptSub({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`${FR_SCRIPT} text-[30px] leading-none text-[#70244f] ${className}`}>{children}</h3>;
}

function Pill({ children, big = false, className = "" }: { children: ReactNode; big?: boolean; className?: string }) {
  return (
    <span className={`${FR_NAME} fr-pill tabular-nums ${big ? "px-5 py-1 text-[22px] sm:text-[24px]" : "px-3.5 py-[3px] text-[17px] sm:text-[18px]"} ${className}`}>
      {children}
    </span>
  );
}

function AddButton({ name, onAdd, small = false }: { name: string; onAdd: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "fr-add flex shrink-0 items-center justify-center rounded-full font-semibold leading-none transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cb0465] focus-visible:ring-offset-2 focus-visible:ring-offset-[#feeef8] " +
        (small ? "h-8 w-8 text-[19px]" : "h-10 w-10 text-[24px]")
      }
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="fr-add flex shrink-0 items-center rounded-full">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        −
      </button>
      <span className="min-w-[1.2rem] text-center text-[14px] font-semibold tabular-nums">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-10 w-9 items-center justify-center text-xl font-bold">
        +
      </button>
    </div>
  );
}

/** Sus iconos junto a coberturas, panes y frutas (en su papel son emojis). */
function emojiFor(name: string): string {
  const k = frKeyOf(name);
  if (k.includes("chocolate")) return "🍫";
  if (k.includes("caramelo")) return "🍬";
  if (k.includes("lechera")) return "🥛";
  if (k.includes("pinguino")) return "🐧";
  if (k.includes("gansito")) return "🍰";
  if (k.includes("chocorrol")) return "🍩";
  if (k.includes("fresa")) return "🍓";
  if (k.includes("platano")) return "🍌";
  if (k.includes("manzana")) return "🍏";
  if (k.includes("mango")) return "🥭";
  return "";
}

/** Sus fotos, recortadas de SU PDF (public/skins/fresheria). Por nombre de platillo. */
type Art = { src: string; w: number; h: number };
const A = (src: string, w: number, h: number): Art => ({ src: `/skins/fresheria/${src}.jpg`, w, h });
const PHOTO: [RegExp, Art][] = [
  [/^nieve sencilla|^sencilla$/, A("nieve_sencilla", 580, 540)],
  [/^nieve especial|^especial$/, A("nieve_especial", 580, 540)],
  [/fresas enchilad/, A("fresas_enchiladas", 570, 690)],
  [/mango enchilad/, A("mango_enchilado", 570, 680)],
  [/^freshoncho/, A("freshoncho", 630, 840)],
  [/^sencillas?$/, A("sencillas", 630, 760)],
  [/^fresheras?$/, A("fresheras", 630, 750)],
  [/^hersheys?/, A("hersheys", 570, 690)],
  [/^de nieve/, A("de_nieve", 570, 680)],
  [/^lotus/, A("lotus", 570, 690)],
  [/^chocolatadas?/, A("chocolatadas", 570, 680)],
  [/^rafaello/, A("rafaello", 570, 690)],
  [/^dubai/, A("dubai", 570, 680)],
  [/costco/, A("costco", 570, 690)],
  [/^de queso horneado/, A("queso_horneado", 570, 680)],
  [/^mega/, A("mega", 640, 740)],
];
function photoFor(name: string): Art | null {
  const k = frKeyOf(name);
  for (const [re, art] of PHOTO) if (re.test(k)) return art;
  return null;
}
const PAY: Record<string, Art> = {
  tortuga: A("pay_tortuga", 270, 230),
  limon: A("pay_limon", 290, 230),
  queso: A("pay_queso", 260, 210),
};
function payFor(name: string): Art | null {
  const k = frKeyOf(name);
  if (k.includes("tortuga")) return PAY.tortuga!;
  if (k.includes("limon")) return PAY.limon!;
  if (k.includes("queso")) return PAY.queso!;
  return null;
}

type Lite = { name: string; price: number; optionGroups?: MenuItemOptionGroup[] };
function findGroup(groups: MenuItemOptionGroup[] | undefined, re: RegExp): MenuItemOptionGroup | null {
  return (groups ?? []).find((g) => re.test(frKeyOf(g.name)) || re.test(frKeyOf(g.id))) ?? null;
}
function findGroupIn(items: Lite[], re: RegExp): MenuItemOptionGroup | null {
  for (const it of items) {
    const g = findGroup(it.optionGroups, re);
    if (g) return g;
  }
  return null;
}

/** "Chico (CH)" → "CH"; "Litro (LT) · 2 panes" → "LT" + nota "2 panes". */
function sizeLabel(name: string): { abbr: string; note: string | null } {
  const m = name.match(/\(([^)]+)\)/);
  const abbr = m ? m[1]!.trim() : name.split(/\s|·/)[0]!.slice(0, 2).toUpperCase();
  const noteM = name.match(/·\s*(.+)$/);
  return { abbr, note: noteM ? noteM[1]!.trim() : null };
}

/** Las tres píldoras "CH $75 · M $95 · LT $185" desde el grupo Tamaño. */
function SizePills({ price, tamano }: { price: number; tamano: MenuItemOptionGroup }) {
  return (
    <div className="mt-2 flex flex-wrap items-start justify-center gap-2 sm:gap-3">
      {tamano.options.map((o) => {
        const { abbr, note } = sizeLabel(o.name);
        return (
          <span key={o.id} className="flex flex-col items-center">
            <Pill>
              <span className="text-[15px] sm:text-[16px]">{abbr}</span> {Math.trunc(price + o.priceDelta) === price + o.priceDelta ? `$${price + o.priceDelta}` : money(price + o.priceDelta)}
            </Pill>
            {note ? <span className={`${FR_NAME} mt-0.5 text-[11px] text-[#56052d]/80`}>({note})</span> : null}
          </span>
        );
      })}
    </div>
  );
}

/** Caja "Cobertura" / "Panes": el subtítulo cursivo y la lista con su emoji, como en su papel. */
function EmojiBox({ title, group, join = false }: { title: string; group: MenuItemOptionGroup; join?: boolean }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <ScriptSub className="mb-1.5">{title}</ScriptSub>
      <div className={`${FR_NAME} fr-soft px-3 py-2.5 text-[17px] leading-snug text-[#56052d]`}>
        {group.options.map((o, i) => (
          <span key={o.id} className="block">
            {join && i > 0 ? <span className="block text-[14px]">o</span> : null}
            <span aria-hidden>{emojiFor(o.name)} </span>
            {o.name}
            {o.priceDelta ? <span className="ml-1 text-[14px]">+{money(o.priceDelta)}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Caja "Rebanadas": los tres pays con su foto (del grupo Rebanada). */
function RebanadasBox({ group }: { group: MenuItemOptionGroup }) {
  return (
    <div className="text-center">
      <ScriptSub className="mb-1.5">Rebanadas</ScriptSub>
      <div className="fr-box flex items-end justify-around gap-2 px-3 py-2.5">
        {group.options.map((o) => {
          const art = payFor(o.name);
          return (
            <span key={o.id} className="flex min-w-0 flex-col items-center gap-1">
              {art ? <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized aria-hidden className="h-12 w-auto object-contain sm:h-14" /> : null}
              <span className={`${FR_NAME} text-[13px] leading-tight text-[#56052d] sm:text-[14px]`}>{o.name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Portada ─────────────────────────── */

export function FresheriaHeader({
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
    <header className="fr-rise px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="fr-page mx-auto max-w-5xl overflow-hidden px-4 pb-4 pt-4 text-center sm:px-8 sm:pb-7 sm:pt-7">
        <div className="relative mx-auto max-w-[560px]">
          <Sparkle className="fr-twinkle absolute -right-1 top-0 h-5 w-5 sm:h-7 sm:w-7" />
          <Sparkle className="fr-twinkle absolute -left-1 bottom-2 h-4 w-4 [animation-delay:1.2s] sm:h-5 sm:w-5" />
          {/* Su logo: el nombre en magenta con fondo dorado y "postres y snacks" sobre sus dos fresas a línea. */}
          <Image
            src="/skins/fresheria/logo.png"
            alt={loading ? "La Fresheria" : restaurantName || "La Fresheria"}
            width={1200}
            height={673}
            priority
            unoptimized
            className="mx-auto h-[92px] w-auto sm:h-[150px] lg:h-[190px]"
          />
          <h1 className="sr-only">{restaurantName || "La Fresheria"}</h1>
          {/* "postres y snacks" ya viene en el logo; el lema del doc se pinta solo si es OTRO. */}
          {!loading && tagline && frKeyOf(tagline) !== "postres y snacks" ? (
            <p className={`${FR_SCRIPT} mt-1 text-[26px] leading-none text-[#70244f]`}>{tagline}</p>
          ) : null}
        </div>
        {/* "M E N U" con la raya magenta y el corazón dorado de su portada. */}
        <p className={`${FR_NAME} mt-1.5 text-[20px] uppercase leading-none tracking-[0.5em] text-[#9e6036] sm:mt-4 sm:text-[28px]`} aria-hidden>
          MENU
        </p>
        <div className="mx-auto mt-1 h-[2px] w-20 bg-[#cb0465] sm:w-28" aria-hidden />
        <p className="mt-0.5 text-[12px] leading-none text-[#9e6036]" aria-hidden>♥</p>
        {!loading ? (
          <div className="mt-2.5 flex flex-col items-center gap-1.5 sm:mt-4 sm:gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {schedule ? (
                <span
                  className={
                    "inline-flex items-center gap-2 rounded-full border-[1.5px] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] " +
                    (schedule.open ? "border-[#cb0465] bg-[#cb0465] text-[#fffbfd]" : "border-[#9e6036] bg-[#fffbfd] text-[#56052d]")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (schedule.open ? "bg-[#fffbfd]" : "bg-[#cb0465]")} aria-hidden />
                  {schedule.label}
                </span>
              ) : null}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#9e6036] bg-[#fffbfd] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#56052d] transition-colors hover:bg-[#cb0465] hover:text-[#fffbfd]"
              >
                <span aria-hidden>🍓</span> @la.fresheriaa.postres
              </a>
            </div>
            {address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium text-[#56052d]/80 underline decoration-[#cb0465]/50 underline-offset-4 hover:text-[#56052d] sm:text-[13px]"
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

/** Su portada ya es el encabezado: no hay portada suelta. */
export function FresheriaCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

/**
 * La hoja: las páginas de su PDF, una por sección. `toppings` (grupo "Toppings" de cualquier vaso) pinta su página
 * "Topings" después de Malteadas; `extras` (grupo "Extras") pinta su última página. Ninguno es platillo: se piden
 * dentro de cada vaso.
 */
export function FresheriaSheet({ children, toppings = null, extras = null }: { children: ReactNode; toppings?: MenuItemOptionGroup | null; extras?: MenuItemOptionGroup | null }) {
  return (
    <div className="fr-grid fr-rise pb-6 pt-1">
      {children}
      {extras ? <ExtrasPage group={extras} /> : null}
      {toppings ? null : null}
    </div>
  );
}

/** Su página "Topings": caja blanca con viñetas y "(Dos topings por vaso)". La pinta la sección que la trae. */
export function ToppingsPage({ group }: { group: MenuItemOptionGroup }) {
  return (
    <section aria-label="Toppings" data-fr="toppings" className="fr-page px-5 pb-5 pt-4 text-center sm:px-8">
      <ScriptTitle>Topings</ScriptTitle>
      <ul className={`${FR_NAME} fr-box mx-auto mt-3 max-w-sm space-y-1.5 px-6 py-4 text-left text-[19px] leading-tight text-[#56052d]`}>
        {group.options.map((o) => (
          <li key={o.id} className="flex items-start gap-3">
            <span className="mt-[9px] h-2.5 w-2.5 shrink-0 rounded-full bg-[#56052d]" aria-hidden />
            {o.name}
          </li>
        ))}
      </ul>
      <p className={`${FR_NAME} mt-3 text-[17px] text-[#56052d]`}>({group.max === 1 ? "Un toping por vaso" : `${group.max === 2 ? "Dos" : group.max} topings por vaso`})</p>
    </section>
  );
}

/** Su última página, "Extras": lista con precio y las fresas a línea detrás. */
function ExtrasPage({ group }: { group: MenuItemOptionGroup }) {
  return (
    <section aria-label="Extras" data-fr="extras" className="fr-page overflow-hidden px-6 pb-6 pt-4 sm:px-10">
      <Sparkle className="fr-twinkle absolute right-6 top-5 h-5 w-5" />
      <div className="relative">
        <ScriptTitle className="text-center">Extras</ScriptTitle>
        <ul className={`${FR_NAME} mx-auto mt-2 max-w-md columns-1 text-[19px] leading-[1.75] text-[#56052d] sm:columns-2 sm:gap-x-10`}>
          {group.options.map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-3 [break-inside:avoid]">
              <span>{o.name}</span>
              <span className="tabular-nums">{money(o.priceDelta)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[#56052d]/60">Se agregan a tu vaso al pedirlo, en “Extras”.</p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

/** El orden de SU papel dentro de cada sección. Lo que no esté aquí va al final. */
const PAPER_ORDER = [
  "Frappé Oreo", "Frappé Moka", "Frappé Café", "Frappé Fresa (dulce)", "Frappé Mango (dulce)", "Frappé Chili mango", "Frappé Chili fresa",
  "Frappé Pingüino", "Frappé Gansito", "Frappé Chocorrol", "Frappé Lotus", "Frappé Nutella", "Frappé Rafaello",
  "Malteada", "FreshePop", "Nieve sencilla", "Nieve especial", "Fresas enchiladas", "Mango enchilado",
  "Rebanada", "Rebanada preparada",
  "Freshoncho", "Sencillas", "Fresheras", "Hersheys", "De nieve", "Lotus Biscoff", "Chocolatadas", "Rafaello", "Dubai",
  "De Costco", "De queso horneado", "Mega",
].map(frKeyOf);

export function frSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(frKeyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

export function FresheriaCategorySection({
  category,
  index,
  children,
  items = [],
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
  toppings = null,
}: {
  category: string;
  index: number;
  children: ReactNode;
  /** Los platillos de la sección (nombre, precio y grupos): las cajas de la página salen de aquí. */
  items?: Lite[];
  /** El grupo "Toppings": su página se pinta después de Malteadas. */
  toppings?: MenuItemOptionGroup | null;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const id = `menu-cat-${index}`;
  const block = frBlockOf(category);

  const windowNote = note ? (
    <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#cb0465]">
      {closed ? "🕒 " : ""}
      {note}
    </p>
  ) : null;
  const toggle =
    closed && onToggle ? (
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="rounded-full border-[1.5px] border-[#9e6036] bg-[#fffbfd] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#56052d] hover:bg-[#cb0465] hover:text-[#fffbfd]"
        >
          {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
        </button>
      </div>
    ) : null;
  const body = collapsed ? null : children;
  const page = (content: ReactNode, extra = "") => (
    <section aria-labelledby={id} data-fr={block} className={"fr-page overflow-hidden px-5 pb-5 pt-4 sm:px-8 " + extra + (closed ? " opacity-60" : "")}>
      {content}
    </section>
  );

  if (block === "frappes") {
    return page(
      <>
        <div className="fr-art" aria-hidden>
          <Image src="/skins/fresheria/art_frappe.jpg" alt="" width={520} height={1000} unoptimized className="left-1/2 top-10 w-[58%] max-w-[300px] -translate-x-[40%]" />
        </div>
        <div className="relative">
          <ScriptTitle id={id} className="text-center">{category}</ScriptTitle>
          {windowNote}
          {toggle}
          {collapsed ? null : <ul className="mt-1 px-1 sm:px-4">{body}</ul>}
        </div>
      </>,
    );
  }
  if (block === "malteadas" || block === "pops") {
    const sabor = block === "pops" ? findGroupIn(items, /sabor/) : null;
    return (
      <>
        {page(
          <>
            {block === "malteadas" ? (
              <div className="fr-art" aria-hidden>
                <Image src="/skins/fresheria/art_malteada.jpg" alt="" width={520} height={915} unoptimized className="left-1/2 top-24 w-[52%] max-w-[260px] -translate-x-1/2" />
              </div>
            ) : null}
            <div className="relative text-center">
              <ScriptTitle id={id}>{category}</ScriptTitle>
              {windowNote}
              {toggle}
              {collapsed ? null : (
                <>
                  <ul className="mt-2 space-y-4">{body}</ul>
                  {sabor ? (
                    <>
                      <ScriptTitle size="sm" className="mt-3">Sabores</ScriptTitle>
                      <ul className={`${FR_NAME} mt-1 space-y-0.5 text-[19px] leading-snug text-[#56052d]`}>
                        {sabor.options.map((o) => (
                          <li key={o.id}>{o.name}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </>,
          "text-center",
        )}
        {block === "malteadas" && toppings ? <ToppingsPage group={toppings} /> : null}
      </>
    );
  }
  if (block === "nieves") {
    const cobertura = findGroupIn(items, /cobertura/);
    const panes = findGroupIn(items, /^pan|panes/);
    return page(
      <>
        <ScriptTitle id={id} className="text-center">{category}</ScriptTitle>
        <p className={`${FR_NAME} fr-pill mx-auto mt-2 flex max-w-full px-4 py-1 text-[15px] leading-tight text-[#56052d]`}>(pregunta por los sabores de nieve disponibles)</p>
        {windowNote}
        {toggle}
        {collapsed ? null : (
          <>
            <ul className="mt-4 space-y-5">{body}</ul>
            {cobertura || panes ? (
              <div className="mt-5 flex gap-3">
                {cobertura ? <EmojiBox title="Cobertura" group={cobertura} join /> : null}
                {panes ? <EmojiBox title="Panes" group={panes} /> : null}
              </div>
            ) : null}
          </>
        )}
      </>,
    );
  }
  if (block === "rebanadas") {
    const rebanada = findGroupIn(items, /rebanada/);
    return page(
      <>
        <ScriptTitle id={id} className="text-center">{category}</ScriptTitle>
        {rebanada ? (
          <div className="fr-box mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3">
            {rebanada.options.map((o) => {
              const art = payFor(o.name);
              return (
                <span key={o.id} className="flex items-center gap-2">
                  {art ? <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized aria-hidden className="h-12 w-auto object-contain sm:h-14" /> : null}
                  <span className={`${FR_NAME} text-[20px] text-[#56052d]`}>{o.name}</span>
                </span>
              );
            })}
          </div>
        ) : null}
        {windowNote}
        {toggle}
        {collapsed ? null : <ul className="mt-4 space-y-4">{body}</ul>}
      </>,
    );
  }
  if (block === "postres") {
    const fruta = findGroupIn(items, /fruta/);
    const libres = fruta?.options.filter((o) => !o.priceDelta) ?? [];
    const conCosto = fruta?.options.filter((o) => o.priceDelta > 0) ?? [];
    return (
      <section aria-labelledby={id} data-fr={block} className={closed ? "opacity-60" : ""}>
        {/* Su hoja "Postres Con Crema": la fruta a escoger, una o varias; mango con costo extra. */}
        <div className="fr-page px-5 pb-5 pt-4 text-center sm:px-8">
          <ScriptTitle id={id} size="lg">{category}</ScriptTitle>
          {fruta ? (
            <>
              <p className={`${FR_NAME} fr-box mx-auto mt-3 max-w-md px-4 py-1.5 text-[18px] text-[#56052d]`}>(Fruta a escoger con crema)</p>
              {libres.length ? (
                <>
                  <ScriptSub className="mt-3">Una o varias</ScriptSub>
                  <p className={`${FR_NAME} fr-box mx-auto mt-1 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-1 px-4 py-2.5 text-[20px] text-[#56052d]`}>
                    {libres.map((o) => (
                      <span key={o.id}>
                        <span aria-hidden>{emojiFor(o.name)} </span>
                        {o.name}
                      </span>
                    ))}
                  </p>
                </>
              ) : null}
              {conCosto.length ? (
                <>
                  <ScriptSub className="mt-3">Con costo extra</ScriptSub>
                  <p className={`${FR_NAME} fr-box mx-auto mt-1 flex max-w-md flex-wrap justify-center gap-x-6 px-4 py-2.5 text-[20px] text-[#56052d]`}>
                    {conCosto.map((o) => (
                      <span key={o.id}>
                        <span aria-hidden>{emojiFor(o.name)} </span>
                        {o.name} + {money(o.priceDelta)}
                      </span>
                    ))}
                  </p>
                </>
              ) : null}
              <p className={`${FR_NAME} mt-4 text-[17px] text-[#56052d]`}>Elige tu fruta para cualquier presentacion</p>
              <p className="text-[22px] leading-none text-[#9e6036]" aria-hidden>⟶</p>
            </>
          ) : null}
          {windowNote}
          {toggle}
        </div>
        {collapsed ? null : <ul className="fr-postres mt-4 space-y-4 lg:space-y-0">{body}</ul>}
      </section>
    );
  }
  // Enchilados y cualquier otra sección: una página con el título cursivo y cada platillo a lo ancho.
  return page(
    <>
      {block === "enchilados" ? <h2 id={id} className="sr-only">{category}</h2> : <ScriptTitle id={id} className="text-center">{category}</ScriptTitle>}
      {windowNote}
      {toggle}
      {collapsed ? null : <ul className={block === "enchilados" ? "divide-y-0" : "mt-3 space-y-4"}>{body}</ul>}
    </>,
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/** Un renglón, como su página. Cambia de ropa según el bloque. */
export function FresheriaItemRow({
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
  groups = [],
  first = false,
}: MenuItemCardProps & { category?: string; groups?: MenuItemOptionGroup[]; first?: boolean }) {
  const block = frBlockOf(category);
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} small={block === "frappes"} />
  );
  const label = frShortName(name, category);
  const tamano = findGroup(groups, /tama/);
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;

  /* Frappes: "nombre … precio" en serif, sin dibujos. */
  if (block === "frappes") {
    return (
      <li className="flex items-center gap-2 py-[3px]">
        <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 text-left">
          <span className={`${FR_NAME} min-w-0 text-[22px] leading-tight text-[#56052d] sm:text-[24px]`}>
            {label}
            {description ? <span className="ml-1.5 text-[15px] text-[#56052d]/70">{description}</span> : null}
          </span>
          <span className={`${FR_NAME} shrink-0 text-[22px] tabular-nums text-[#56052d] sm:text-[24px]`}>{money(price)}</span>
        </button>
        {control}
      </li>
    );
  }

  /* Malteadas y FreshePops: la nota entre paréntesis, "Precio General" en píldora y el botón, como su página. */
  if (block === "malteadas" || block === "pops") {
    return (
      <li className="flex flex-col items-center gap-2">
        <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="cursor-pointer text-center">
          {description ? <span className={`${FR_NAME} block text-[19px] leading-snug text-[#56052d] [text-wrap:balance]`}>({description.replace(/\.$/, "")})</span> : <span className={`${FR_NAME} block text-[20px] text-[#56052d]`}>{label}</span>}
          <span className={`${FR_NAME} mt-2 flex items-center justify-center gap-3 text-[21px] text-[#56052d]`}>
            {block === "pops" ? <>Precio General : <Pill big>{money(price)}</Pill></> : <><Pill big>{money(price)}</Pill> Precio General</>}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {quantity > 0 ? null : <span className={`${FR_NAME} text-[14px] uppercase tracking-[0.12em] text-[#56052d]/70`}>Pedir {label}</span>}
          {control}
        </div>
      </li>
    );
  }

  /* Nieves: foto a la izquierda; nombre cursivo + píldora y "Incluye:" a la derecha. */
  if (block === "nieves") {
    const art = imageUrl ? { src: imageUrl, w: 600, h: 600 } : photoFor(name);
    const short = label.replace(/^nieve\s+/i, "");
    return (
      <li className="flex items-center gap-3 sm:gap-4">
        {art ? (
          <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="fr-photo w-[38%] max-w-[190px] shrink-0">
            <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized className="aspect-square w-full object-cover" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="block w-full cursor-pointer text-left">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`${FR_SCRIPT} text-[34px] leading-none text-[#56052d] sm:text-[40px]`}>{short.charAt(0).toUpperCase() + short.slice(1)}</span>
              <Pill>{money(price)}</Pill>
            </span>
            {description ? (
              <span className={`${FR_NAME} mt-1.5 block text-[15px] leading-snug text-[#56052d] sm:text-[16px]`}>
                <span className="font-bold">Incluye: </span>
                {description.replace(/^incluye:?\s*/i, "")}
              </span>
            ) : null}
          </button>
          <div className="mt-2 flex items-center justify-end gap-2">
            {quantity > 0 ? null : <span className={`${FR_NAME} text-[13px] uppercase tracking-[0.12em] text-[#56052d]/70`}>Pedir</span>}
            {control}
          </div>
        </div>
      </li>
    );
  }

  /* Rebanadas: "Rebanada: [$65]" y la caja "Preparada: [$110]" con viñetas de su papel. */
  if (block === "rebanadas") {
    const preparada = /preparad/i.test(name);
    const bullets = preparada && description ? description.replace(/\.$/, "").split(/,\s*|\s+y\s+(?=\d)/).map((s) => s.trim()).filter(Boolean) : [];
    const short = preparada ? "Preparada" : label;
    const head = (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`${FR_SCRIPT} text-[36px] leading-none text-[#56052d] sm:text-[42px]`}>{short}:</span>
        <Pill big>{money(price)}</Pill>
      </span>
    );
    return (
      <li className={preparada ? "fr-box px-4 py-3 sm:px-6" : "px-1"}>
        <div className="flex items-start gap-3">
          <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="min-w-0 flex-1 cursor-pointer text-left">
            {head}
            {bullets.length ? (
              <ul className={`${FR_NAME} mt-2 space-y-0.5 text-[18px] leading-snug text-[#56052d]`}>
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-[#56052d]" aria-hidden />
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </li>
                ))}
              </ul>
            ) : !preparada && hint ? (
              <span className={`${FR_NAME} mt-1 block text-[15px] text-[#56052d]/75`}>{description ?? hint}</span>
            ) : null}
          </button>
          <div className="pt-1">{control}</div>
        </div>
      </li>
    );
  }

  /* Enchilados y cada vaso de Postres con crema: su página completa. */
  const art = imageUrl ? { src: imageUrl, w: 600, h: 720 } : photoFor(name);
  const cobertura = findGroup(groups, /cobertura/);
  const panes = findGroup(groups, /^pan|panes/);
  const rebanada = findGroup(groups, /rebanada/);
  const isPostre = block === "postres";
  const inner = (
    <>
      <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="block w-full cursor-pointer text-center">
        <span className={`${FR_SCRIPT} block text-[42px] leading-[1.05] text-[#56052d] [text-wrap:balance] sm:text-[50px]`}>{label}</span>
        {tamano ? (
          <SizePills price={price} tamano={tamano} />
        ) : (
          <span className="mt-2 block">
            <Pill big>{money(price)}</Pill>
          </span>
        )}
      </button>
      <div className="mt-3 flex items-start gap-3 sm:gap-4">
        {art ? (
          <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="fr-photo w-[42%] max-w-[210px] shrink-0">
            <Image src={art.src} alt="" width={art.w} height={art.h} unoptimized className="aspect-[5/6] w-full object-cover" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} aria-label={`Ver ${label}`} className="block w-full cursor-pointer text-left">
            {description ? (
              <span className={`${FR_NAME} block text-[15.5px] leading-snug text-[#56052d] sm:text-[17px]`}>
                <span className="font-bold">Incluye: </span>
                {description.replace(/^incluye:?\s*/i, "")}
              </span>
            ) : hint ? (
              <span className={`${FR_NAME} block text-[15px] text-[#56052d]/75`}>{hint}</span>
            ) : null}
          </button>
          <div className="mt-3 flex items-center justify-end gap-2">
            {quantity > 0 ? null : <span className={`${FR_NAME} text-[13px] uppercase tracking-[0.12em] text-[#56052d]/70`}>Pedir</span>}
            {control}
          </div>
        </div>
      </div>
      {isPostre && (rebanada || cobertura || panes) ? (
        <div className="mt-4 space-y-3">
          {rebanada ? <RebanadasBox group={rebanada} /> : null}
          {cobertura || panes ? (
            <div className="flex gap-3">
              {cobertura ? <EmojiBox title="Cobertura" group={cobertura} /> : null}
              {panes ? <EmojiBox title="Panes" group={panes} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
  if (isPostre) {
    return <li className="fr-page px-5 pb-5 pt-4 sm:px-7">{inner}</li>;
  }
  return (
    <li className="py-3">
      {first ? null : <div className="fr-rule mb-5" aria-hidden />}
      {inner}
    </li>
  );
}

/** Tarjeta de premios como una página más de su PDF. */
export function FresheriaPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fr-page fr-rise mt-6 px-5 pb-5 pt-4 sm:px-8" aria-label={title}>
      <ScriptTitle className="text-center">{title}</ScriptTitle>
      <div className="mt-3 text-[#56052d]">{children}</div>
    </section>
  );
}

export const FR_COLORS = { wine: WINE, magenta: MAGENTA, gold: GOLD };
