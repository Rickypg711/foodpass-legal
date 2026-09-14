"use client";

/**
 * Piel "Omu" del menú público — Omu Balls & Sushi (Juana de Arco y Av. Colonias Populares, Miguel Sigala,
 * Chihuahua; FB "Omu Balls & Sushi" 4.8K, IG @omuballsandsushi). Novena piel (13-sep-2026).
 *
 * Fuente única: SU HOJA de menú (foto de WhatsApp del 13-sep), una sola página negra con la foto oscura de sushi:
 *  - arriba a la izquierda "MENÜ" en letra fina con los ojitos de su logo (sus estrellas y "El favorito de los
 *    Omu Lovers" NO se pintan: decisión de Ricardo, 13-sep);
 *  - "¡ÁRMALAS A TU GUSTO!" en píldora blanca con letras rojas, y sus 4 PASOS numerados en tarjetas blancas
 *    (1 cubierta con las dos columnas BALL | SUSHI, 2 proteína, 3 aderezos, 4 vegetales);
 *  - "OMU PREMIUM" en píldora blanca de borde rojo: NOMBRE gordo en blanco, precio a la derecha, descripción en
 *    versalitas grises; abajo la nota roja de lo que incluyen los premium;
 *  - "OMU BONELESS" y "PARA COMPARTIR": tarjetas blancas con cabecera roja, "todas las porciones incluyen papas
 *    y verduras", tamaños con precio y "escoge tu salsa";
 *  - "¡COMPLEMENTA!" (refrescos y postres), la etiqueta roja "¡AGREGA UN INGREDIENTE EXTRA POR SÓLO $25!" y
 *    "EXTRAS" (proteínas, salsas, aderezos).
 * Su rojo es #f10809 y su negro #151311, sacados de la propia hoja.
 *
 * Los pasos, los tamaños y las listas de extras NO están escritos aquí: se pintan desde los `optionGroups` de
 * los platillos (lo que el dueño cambie en su panel se ve igual en la hoja). La lógica (carrito, opciones,
 * detalle) es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { Montserrat, Bodoni_Moda } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import type { ScheduleStatus } from "@/lib/schedule";
import "./omu.css";

const montserrat = Montserrat({ weight: ["400", "500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--omu-sans" });
const bodoni = Bodoni_Moda({ weight: ["400", "500"], subsets: ["latin"], variable: "--omu-display" });

export const OMU_ROOT_CLASS =
  `${montserrat.variable} ${bodoni.variable} ` +
  "omu-skin min-h-screen text-[#f9f8f8] antialiased [font-family:var(--omu-sans),Montserrat,system-ui,sans-serif]";

export const OMU_DISPLAY = "[font-family:var(--omu-display),'Bodoni_72',Didot,serif] font-normal";
export const OMU_NAME = "[font-family:var(--omu-sans),Montserrat,system-ui,sans-serif] font-extrabold uppercase";

const FACEBOOK_URL = "https://www.facebook.com/p/Omu-Balls-Sushi-100049656712691/";
const RED = "#f10809";

export function omuKeyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

/** Qué pedazo de su hoja es cada sección. Lo que no esté en su papel sale como "otra" (tarjeta blanca). */
export type OmuBlock = "armalas" | "premium" | "boneless" | "compartir" | "refrescos" | "postres" | "extras" | "otra";
export function omuBlockOf(category: string): OmuBlock {
  const k = omuKeyOf(category);
  if (k.startsWith("armalas") || k.includes("arma")) return "armalas";
  if (k.includes("premium")) return "premium";
  if (k.includes("boneless")) return "boneless";
  if (k.includes("compartir")) return "compartir";
  if (k.includes("refresco") || k.includes("bebida")) return "refrescos";
  if (k.includes("postre")) return "postres";
  if (k.includes("extra")) return "extras";
  return "otra";
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

function money(price: number): string {
  return formatPrice(price);
}

/* ─────────────────────────── Portada (arriba de su hoja) ─────────────────────────── */

export function OmuHeader({
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
    <header className="omu-rise px-4 pb-2 pt-6 text-center sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <Image
          src="/skins/omu/logo.png"
          alt={loading ? "Omu Balls & Sushi" : restaurantName || "Omu Balls & Sushi"}
          width={720}
          height={493}
          priority
          unoptimized
          className="mx-auto h-[76px] w-auto sm:h-[88px]"
        />
        <h1 className={`${OMU_DISPLAY} mt-3 text-[64px] uppercase leading-none tracking-[0.1em] text-[#f9f8f8] sm:text-[84px]`}>
          MENÜ
        </h1>
        {/* Su papel trae cinco estrellas y "El favorito de los Omu Lovers" bajo el MENÜ; Ricardo las quitó el 13-sep:
            en una página las estrellas se leen como calificación. */}
        {tagline?.trim() ? (
          <p className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#f9f8f8] sm:text-[12px]">{tagline.trim()}</p>
        ) : null}
        {!loading ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            {schedule ? (
              <span
                className={
                  "inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] " +
                  (schedule.open ? "border-[#f10809] bg-[#f10809] text-[#f9f8f8]" : "border-[#f9f8f8]/60 text-[#f9f8f8]/85")
                }
              >
                <span className={"h-1.5 w-1.5 rounded-full " + (schedule.open ? "bg-[#f9f8f8]" : "bg-[#f9f8f8]/70")} aria-hidden />
                {schedule.label}
              </span>
            ) : null}
            {address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-[11.5px] font-medium text-[#f9f8f8]/75 underline decoration-[#f10809]/60 underline-offset-4 hover:text-[#f9f8f8] sm:text-[12.5px]"
              >
                <span className="min-w-0 truncate">{shortAddress(address)}</span>
                <span aria-hidden className="shrink-0">↗</span>
              </a>
            ) : null}
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#f9f8f8]/55 hover:text-[#f9f8f8]"
            >
              Omu Balls &amp; Sushi en Facebook
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Omu no usa portada suelta: arriba de su hoja ya va todo. */
export function OmuCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

export function OmuSheet({ children }: { children: ReactNode }) {
  return <div className="omu-grid omu-rise pb-6 pt-2">{children}</div>;
}

/* ─────────────────────────── Piezas ─────────────────────────── */

function Pill({ children, red = false, small = false }: { children: ReactNode; red?: boolean; small?: boolean }) {
  return (
    <div className="text-center">
      <h2
        className={
          `${OMU_NAME} omu-pill ${red ? "omu-pill--red" : ""} leading-none tracking-[0.02em] ` +
          (small ? "px-5 py-2 text-[17px] sm:text-[19px]" : "px-6 py-2.5 text-[21px] sm:px-8 sm:text-[26px]")
        }
      >
        {children}
      </h2>
    </div>
  );
}

function CardHead({ children }: { children: ReactNode }) {
  return (
    <h2 className={`${OMU_NAME} omu-card__head px-4 py-2.5 text-center text-[21px] leading-none tracking-[0.02em] sm:text-[24px]`}>
      {children}
    </h2>
  );
}

function AddButton({ name, onAdd, small = false }: { name: string; onAdd: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className={
        "omu-add flex shrink-0 items-center justify-center rounded-full font-bold leading-none transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f10809] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151311] " +
        (small ? "h-8 w-8 text-[18px]" : "h-9 w-9 text-[22px]")
      }
    >
      +
    </button>
  );
}

function Stepper({ name, quantity, onIncrement, onDecrement }: { name: string; quantity: number; onIncrement?: () => void; onDecrement?: () => void }) {
  return (
    <div className="flex shrink-0 items-center rounded-full bg-[#f10809] text-[#f9f8f8]">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className="flex h-9 w-8 items-center justify-center text-lg font-bold">
        −
      </button>
      <span className="min-w-[1.2rem] text-center text-[13.5px] font-extrabold tabular-nums">{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className="flex h-9 w-8 items-center justify-center text-lg font-bold">
        +
      </button>
    </div>
  );
}

/* ─────────────────────────── Los 4 pasos de "¡Ármalas a tu gusto!" ─────────────────────────── */

type OmuItemLite = { name: string; price: number; optionGroups?: MenuItemOptionGroup[] };

function findGroup(items: OmuItemLite[], re: RegExp): MenuItemOptionGroup | null {
  for (const it of items) for (const g of it.optionGroups ?? []) if (re.test(omuKeyOf(g.name))) return g;
  return null;
}

/** Sus 4 tarjetas numeradas, pintadas desde los grupos de "Omu Ball" / "Omu Sushi". */
function ArmalasSteps({ items }: { items: OmuItemLite[] }) {
  const ball = items.find((i) => /ball/.test(omuKeyOf(i.name)));
  const sushi = items.find((i) => /sushi/.test(omuKeyOf(i.name)));
  const cubierta =
    (sushi ? findGroup([sushi], /cubierta/) : null) ?? (ball ? findGroup([ball], /cubierta/) : null) ?? findGroup(items, /cubierta/);
  const ballCubiertas = new Set((ball ? findGroup([ball], /cubierta/) : null)?.options.map((o) => omuKeyOf(o.name)) ?? []);
  const proteina = findGroup(items, /prote/);
  const aderezos = findGroup(items, /aderezo/);
  const vegetales = findGroup(items, /vegetal|verdura/);
  const steps: { title: string; body: ReactNode }[] = [];
  if (cubierta) {
    steps.push({
      title: `Elige ${cubierta.max === 1 ? 1 : cubierta.max} cubierta`,
      body: (
        <table className="w-full text-[11.5px] leading-tight">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-[#d40607]">
              <th className="pb-1 text-left font-extrabold" scope="col">
                <span className="sr-only">Cubierta</span>
              </th>
              {ball ? <th className="pb-1 text-right font-extrabold" scope="col">Ball</th> : null}
              {sushi ? <th className="pb-1 text-right font-extrabold" scope="col">Sushi</th> : null}
            </tr>
          </thead>
          <tbody>
            {cubierta.options.map((o) => {
              const enBall = !ball || ballCubiertas.size === 0 || ballCubiertas.has(omuKeyOf(o.name));
              return (
                <tr key={o.id}>
                  <td className="py-[2px] pr-2 font-bold uppercase text-[#151311]">{o.name.replace(/\s*\(.*\)\s*$/, "")}{/\(/.test(o.name) ? "*" : ""}</td>
                  {ball ? <td className="py-[2px] text-right font-extrabold tabular-nums text-[#151311]">{enBall ? Math.trunc(ball.price + o.priceDelta) : ""}</td> : null}
                  {sushi ? <td className="py-[2px] text-right font-extrabold tabular-nums text-[#151311]">{Math.trunc(sushi.price + o.priceDelta)}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      ),
    });
  }
  const lista = (g: MenuItemOptionGroup) => (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-[3px] text-[11.5px] font-bold uppercase leading-tight text-[#151311]">
      {g.options.map((o) => (
        <li key={o.id}>{o.name}</li>
      ))}
    </ul>
  );
  if (proteina) steps.push({ title: `Elige ${proteina.max} proteína`, body: lista(proteina) });
  if (aderezos) steps.push({ title: `Elige ${aderezos.max} aderezos`, body: lista(aderezos) });
  if (vegetales) steps.push({ title: `Elige ${vegetales.max} vegetales`, body: lista(vegetales) });
  if (!steps.length) return null;
  return (
    <ol className="mt-4 space-y-3 pl-4">
      {steps.map((s, i) => (
        <li key={s.title} className="omu-card relative px-4 py-3">
          <span className="omu-num absolute -left-4 top-3 text-[15px] font-black" aria-hidden>
            {i + 1}
          </span>
          <h3 className="mb-1.5 pl-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#d40607]">
            <span className="sr-only">Paso {i + 1}: </span>
            {s.title}
          </h3>
          <div className="pl-2">{s.body}</div>
        </li>
      ))}
      {cubierta?.options.some((o) => /\(/.test(o.name)) ? (
        <li className="list-none pl-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#f9f8f8]/60" aria-hidden>
          * Natural: temperatura ambiente
        </li>
      ) : null}
    </ol>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

/** El orden de SU papel dentro de cada sección. Lo que no esté aquí va al final. */
const PAPER_ORDER = [
  "Omu Ball", "Omu Sushi",
  "Omu Queen", "Omu King", "Omu Mar y Tierra", "Omu Boneless", "Omu Veggie", "Omu Bacon",
  "Omu Squid", "Omu Salmón", "Omu Mango Especial", "Omu Doble Empanizado", "Omu Atún Especial", "Omu Frut",
  "Omu Box Sushi & Boneless", "Omu Box Sushi",
  "Coca Cola 355 ml", "Pepsi 400 ml", "Mirinda 400 ml", "Manzanita 400 ml",
  "Rebanada de pay", "Rebanada de pastel", "Omu galleta",
  "Ingrediente extra",
].map(omuKeyOf);

export function omuSortItems<T extends { name: string }>(items: T[]): T[] {
  const pos = (n: string) => {
    const i = PAPER_ORDER.indexOf(omuKeyOf(n));
    return i < 0 ? 999 : i;
  };
  return [...items].sort((a, b) => pos(a.name) - pos(b.name) || a.name.localeCompare(b.name, "es"));
}

const PREMIUM_NOTE = "Nuestros premium incluyen: aguacate, queso crema, zanahoria, pepino, chipotle y soya *excepto Omu Mango Especial y Omu Frut*";
const PORCIONES_NOTE = "Todas las porciones incluyen papas y verduras";

export function OmuCategorySection({
  category,
  index,
  children,
  items = [],
  note = null,
  closed = false,
  collapsed = false,
  itemCount = 0,
  onToggle,
}: {
  category: string;
  index: number;
  children: ReactNode;
  /** Los platillos de la sección (nombre, precio y grupos): los pasos y las notas salen de aquí. */
  items?: OmuItemLite[];
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const id = `menu-cat-${index}`;
  const block = omuBlockOf(category);
  const dark = block === "armalas" || block === "premium" || block === "extras";
  const extraPrice = block === "extras" ? items[0]?.price : undefined;

  const windowNote = note ? (
    <p className={"mt-2 text-center text-[10.5px] font-extrabold uppercase tracking-[0.12em] " + (dark ? "text-[#f9f8f8]/80" : "text-[#d40607]")}>
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
          className={
            "rounded-full border-2 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] " +
            (dark ? "border-[#f9f8f8]/60 text-[#f9f8f8] hover:bg-[#f9f8f8]/10" : "border-[#f10809] text-[#d40607] hover:bg-[#f10809]/10")
          }
        >
          {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
        </button>
      </div>
    ) : null;
  const body = collapsed ? null : children;

  // Título de la sección para lectores de pantalla: la píldora o la cabecera lo llevan visible.
  const wrap = (content: ReactNode) => (
    <section aria-labelledby={id} data-omu={block} className={closed ? "opacity-60" : ""}>
      {content}
    </section>
  );

  if (block === "armalas") {
    return wrap(
      <>
        <div id={id}>
          <Pill red>¡{category.replace(/^¡|!$/g, "")}!</Pill>
        </div>
        <p className="mt-3 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#f9f8f8]">Pasos para armar tu sushi o ball</p>
        {windowNote}
        {toggle}
        {collapsed ? null : (
          <>
            <ArmalasSteps items={items} />
            <ul className="mt-4 space-y-2">{children}</ul>
          </>
        )}
      </>,
    );
  }
  if (block === "premium") {
    return wrap(
      <>
        <div id={id}>
          <Pill>{category}</Pill>
        </div>
        {windowNote}
        {toggle}
        {collapsed ? null : (
          <>
            <ul className="omu-cols mt-5">{body}</ul>
            <p className="omu-badge mx-auto mt-3 max-w-xl px-4 py-2 text-center text-[10px] font-extrabold uppercase leading-snug tracking-[0.04em] sm:text-[10.5px]">
              {PREMIUM_NOTE}
            </p>
          </>
        )}
      </>,
    );
  }
  if (block === "boneless" || block === "compartir") {
    return wrap(
      <div className="omu-card overflow-hidden">
        <div id={id}>
          <CardHead>{category}</CardHead>
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#151311]">{PORCIONES_NOTE}</p>
          {windowNote}
          {toggle}
          {collapsed ? null : <ul className="mt-3 space-y-3">{body}</ul>}
        </div>
      </div>,
    );
  }
  if (block === "refrescos" || block === "postres") {
    return wrap(
      <>
        {block === "refrescos" ? (
          <div id={id} className="mb-3">
            <Pill small>¡Complementa!</Pill>
          </div>
        ) : null}
        <div className="omu-card px-4 py-3">
          <h3 id={block === "refrescos" ? undefined : id} className={`${OMU_NAME} text-[15px] leading-none tracking-[0.04em] text-[#151311]`}>
            {category}
          </h3>
          {windowNote}
          {toggle}
          {collapsed ? null : <ul className="mt-2 space-y-1">{body}</ul>}
        </div>
      </>,
    );
  }
  if (block === "extras") {
    return wrap(
      <>
        {typeof extraPrice === "number" ? (
          <p className="omu-badge mx-auto mb-3 max-w-xs px-4 py-2 text-center text-[11px] font-extrabold uppercase leading-snug tracking-[0.04em]">
            ¡Agrega un ingrediente extra por sólo {money(extraPrice)}!
          </p>
        ) : null}
        <div id={id}>
          <Pill small>{category}</Pill>
        </div>
        {windowNote}
        {toggle}
        {collapsed ? null : <ul className="mt-4 space-y-3">{body}</ul>}
      </>,
    );
  }
  return wrap(
    <div className="omu-card overflow-hidden">
      <div id={id}>
        <CardHead>{category}</CardHead>
      </div>
      <div className="px-4 pb-4 pt-2">
        {windowNote}
        {toggle}
        {collapsed ? null : <ul className="mt-2 space-y-3">{body}</ul>}
      </div>
    </div>,
  );
}

/* ─────────────────────────── Renglón ─────────────────────────── */

/** Un renglón, como su hoja: NOMBRE gordo · precio · descripción en versalitas. Cambia de ropa según el bloque. */
export function OmuItemRow({
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
}: MenuItemCardProps & { category?: string; groups?: MenuItemOptionGroup[] }) {
  const block = omuBlockOf(category);
  const dark = block === "armalas" || block === "premium" || block === "extras";
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} small={block === "refrescos" || block === "postres"} />
  );
  const ink = dark ? "text-[#f9f8f8]" : "text-[#151311]";
  const soft = dark ? "text-[#f9f8f8]/62" : "text-[#151311]/70";
  const tamano = groups.find((g) => /tama/.test(omuKeyOf(g.name)));
  const salsa = groups.find((g) => /salsa/.test(omuKeyOf(g.name)));

  /* Refrescos y postres: renglón chico con puntitos, como su lista de "¡Complementa!". */
  if (block === "refrescos" || block === "postres") {
    return (
      <li className="flex items-center gap-2">
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="flex min-w-0 flex-1 cursor-pointer items-end gap-2 text-left">
          <span className={`${ink} min-w-0 truncate text-[12px] font-bold uppercase leading-tight`}>{name}</span>
          <span className="omu-dots" aria-hidden />
          <span className={`${ink} shrink-0 text-[13px] font-extrabold tabular-nums`}>{money(price)}</span>
        </button>
        {control}
      </li>
    );
  }

  /* Boneless: los tamaños con su precio (del grupo Tamaño) y "escoge tu salsa" (del grupo Salsa). */
  if (block === "boneless" && tamano) {
    return (
      <li className="[break-inside:avoid]">
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="block w-full cursor-pointer text-left">
          <ul className="space-y-1">
            {tamano.options.map((o) => (
              <li key={o.id} className="flex items-end gap-2">
                <span className="text-[13px] font-semibold uppercase leading-tight text-[#151311]">{o.name}</span>
                <span className="omu-dots" aria-hidden />
                <span className="text-[16px] font-extrabold tabular-nums leading-none text-[#151311]">{Math.trunc(price + o.priceDelta)}</span>
              </li>
            ))}
          </ul>
          {salsa ? (
            <p className="mt-3 text-[10px] font-extrabold uppercase leading-snug tracking-[0.04em] text-[#151311]">
              Escoge tu salsa: {salsa.options.map((o) => o.name).join(", ")}.
            </p>
          ) : null}
        </button>
        <div className="mt-3 flex items-center justify-end gap-2">
          {quantity > 0 ? null : <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#151311]/60">Pedir</span>}
          {control}
        </div>
      </li>
    );
  }

  /* Extras: las tres listas de su papel (proteínas · salsas · aderezos) desde el grupo "Cuál". */
  if (block === "extras" && groups[0]) {
    const opts = groups[0].options;
    const salsas = opts.filter((o) => /^salsa/i.test(o.name));
    const aderezos = opts.filter((o) => /^aderezo/i.test(o.name));
    const proteinas = opts.filter((o) => !/^salsa|^aderezo/i.test(o.name));
    const cols: [string, typeof opts][] = [
      ["Proteínas", proteinas],
      ["Salsas", salsas],
      ["Aderezos", aderezos],
    ];
    return (
      <li>
        <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="block w-full cursor-pointer text-left">
          <div className="grid grid-cols-3 gap-3">
            {cols
              .filter(([, list]) => list.length)
              .map(([title, list]) => (
                <div key={title}>
                  <h4 className="mb-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#f9f8f8]">{title}</h4>
                  <ul className="space-y-[2px] text-[10.5px] font-medium uppercase leading-tight text-[#f9f8f8]/75">
                    {list.map((o) => (
                      <li key={o.id}>{o.name.replace(/^(salsa|aderezo)\s+/i, "")}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </button>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12px] font-extrabold uppercase text-[#f9f8f8]">
            {name} · {money(price)}
          </span>
          {control}
        </div>
      </li>
    );
  }

  /* Premium, Ármalas, Para compartir y lo demás: NOMBRE · precio · descripción. */
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  // Su papel abre cada premium con "ELIGE BOLA O SUSHI:" — solo cuando de verdad se elige (grupo Presentación).
  const bolaOSushi =
    block === "premium" && groups.some((g) => /presentacion/.test(omuKeyOf(g.name)) && g.options.some((o) => /sushi/i.test(o.name)));
  return (
    <li className={"flex items-start gap-3 [break-inside:avoid] " + (dark ? "pb-4" : "")}>
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`${OMU_NAME} ${ink} text-[15px] leading-tight tracking-[0.01em] sm:text-[16px]`}>{name}</span>
          <span className={`${ink} shrink-0 text-[16px] font-extrabold tabular-nums leading-none sm:text-[17px]`}>{Math.trunc(price)}</span>
        </span>
        {description ? (
          <span className={`${soft} mt-1 block text-[10.5px] font-medium uppercase leading-snug tracking-[0.03em] sm:text-[11px]`}>
            {bolaOSushi ? "Elige bola o sushi: " : ""}
            {description}
          </span>
        ) : hint ? (
          <span className={`${soft} mt-1 block text-[10.5px] font-bold uppercase tracking-[0.06em]`}>{hint}</span>
        ) : null}
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={320} height={200} unoptimized className="mt-2 h-28 w-full max-w-[320px] rounded-[4px] object-cover" />
        ) : null}
      </button>
      <div className="pt-0.5">{control}</div>
    </li>
  );
}

/** Tarjeta de premios como otra tarjeta blanca con cabecera roja de su hoja. */
export function OmuPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="omu-card omu-rise mt-8 overflow-hidden" aria-label={title}>
      <CardHead>{title}</CardHead>
      <div className="px-4 pb-5 pt-4 text-[#151311] sm:px-6">{children}</div>
    </section>
  );
}

export const OMU_RED = RED;
