"use client";

/**
 * Piel "Kame" del menú público — Kame House Cevichería (Rey Ramsés II 714, Villas del Rey, Chihuahua; en Comeleal
 * "Tosticeviches Kame House"). Undécima piel (5-oct-2026). Diego, el dueño, se dio de alta solo y Ricardo le
 * prometió su menú "como ya lo tiene".
 *
 * Fuente única: SU VOLANTE (la foto que subió al importar su menú) y su portada de Facebook:
 *  - arriba, la franja amarilla con su logo redondo verde ("KAME HOUSE / CEVICHERIA") a la izquierda y la foto de
 *    sus platillos (ostiones, coctel, ramen, tosticeviche con sus Tostitos) a la derecha; abajo "Ceviches,
 *    cocteles, aguachiles, ramen.";
 *  - hoja verde pizarrón a dos columnas: TÍTULO amarillo gordo, la descripción de la sección UNA vez bajo el
 *    título, y renglones NOMBRE (dorado claro, espaciado) · precio (dorado);
 *  - CEVICHE como tabla: nombre · 1/2 · 1L, cada tamaño con su precio;
 *  - OSTIONES con su etiqueta roja "NEW".
 * Su verde es #263532 y su amarillo #EFD250, sacados del propio volante.
 *
 * Lo que la piel agrega para que se sienta viva (pedido de Ricardo): los platillos flotan sobre unos rayos que
 * giran despacio, el anillo de letras le da la vuelta al logo, una cinta corre con SUS secciones, la foto de cada
 * platillo flota junto a su título y los renglones entran al hacer scroll. Todo se apaga con
 * `prefers-reduced-motion` y sin JavaScript el menú se ve completo.
 *
 * Nada del menú está escrito aquí: nombres, precios y descripciones salen de Firestore. Los tamaños del ceviche
 * son platillos separados ("CAMARÓN 1/2", "CAMARÓN 1L"); la piel solo los junta en un renglón, como su papel.
 * La lógica (carrito, opciones, detalle) es la de MenuView: aquí solo se pinta.
 */

import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { League_Spartan, Jost } from "next/font/google";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemCardProps } from "@/components/menu/MenuItemCard";
import type { ScheduleStatus } from "@/lib/schedule";
import "./kame.css";

const spartan = League_Spartan({ weight: ["600", "700", "800", "900"], subsets: ["latin"], variable: "--kame-display" });
const jost = Jost({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--kame-sans" });

export const KAME_ROOT_CLASS =
  `${spartan.variable} ${jost.variable} ` +
  "kame-skin min-h-screen text-[#fbf3d0] antialiased [font-family:var(--kame-sans),Jost,system-ui,sans-serif]";

/** Títulos de sección y botones: su molde gordo. */
export const KAME_TITLE = "[font-family:var(--kame-display),'League_Spartan',Futura,sans-serif] font-black uppercase";
/** Nombres de platillo: el mismo molde, más delgado y espaciado. */
export const KAME_NAME = "[font-family:var(--kame-display),'League_Spartan',Futura,sans-serif] font-bold uppercase";

const PAPER_TAGLINE = "Ceviches, cocteles, aguachiles, ramen.";

export function kameKeyOf(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ/]+/g, " ").trim();
}

/** Qué pedazo de su papel es cada sección. Lo que no esté en su volante sale como "otra". */
export type KameBlock = "tosticeviche" | "cocteles" | "ceviche" | "ramen" | "aguachiles" | "ostiones" | "extras" | "otra";
export function kameBlockOf(category: string): KameBlock {
  const k = kameKeyOf(category);
  if (k.includes("tosti")) return "tosticeviche";
  if (k.includes("coctel")) return "cocteles";
  if (k.includes("ceviche")) return "ceviche";
  if (k.includes("ramen")) return "ramen";
  if (k.includes("aguachile")) return "aguachiles";
  if (k.includes("ostion")) return "ostiones";
  if (k.includes("extra") || k.includes("bebida")) return "extras";
  return "otra";
}

/** La foto de SU platillo por sección (recortes de su volante). Sin foto suya, la sección va sin medalla. */
const MEDAL: Partial<Record<KameBlock, { src: string; alt: string }>> = {
  tosticeviche: { src: "/skins/kame/s_tosti.jpg", alt: "Tosticeviche de Kame House" },
  cocteles: { src: "/skins/kame/s_coctel.jpg", alt: "Coctel de Kame House" },
  ramen: { src: "/skins/kame/s_ramen.jpg", alt: "Ramen de mariscos de Kame House" },
  ostiones: { src: "/skins/kame/s_ostiones.jpg", alt: "Ostiones de Kame House" },
};

/** El orden de SU papel dentro de cada sección (por cómo empieza el nombre). Lo demás va al final, como venía. */
const PAPER_ORDER: Partial<Record<KameBlock, string[]>> = {
  tosticeviche: ["camaron", "pescado", "mixto", "tostiaguachile"],
  cocteles: ["camaron", "pescado", "mixto"],
  ceviche: ["camaron", "pescado", "mixto"],
  ramen: ["mixto", "camaron"],
  aguachiles: ["negro", "verde"],
  ostiones: ["sencillo", "especial"],
  extras: ["coca", "pepihuates", "clamato"],
};

export function kameSortItems<T extends { name: string; price: number }>(category: string, items: T[]): T[] {
  const order = PAPER_ORDER[kameBlockOf(category)] ?? [];
  const pos = (n: string) => {
    const k = kameKeyOf(n);
    const i = order.findIndex((p) => k.startsWith(p));
    return i < 0 ? 999 : i;
  };
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => pos(a.it.name) - pos(b.it.name) || a.i - b.i)
    .map((x) => x.it);
}

/** Si todos los platillos de la sección dicen lo mismo, su papel lo pone UNA vez bajo el título. */
export function kameSharedDescription(items: { description: string | null }[]): string | null {
  if (items.length < 2) return null;
  const first = items[0]?.description?.trim();
  if (!first) return null;
  return items.every((i) => i.description?.trim() === first) ? first : null;
}

/** "CAMARÓN 1/2" + "CAMARÓN 1L" → un renglón con dos tamaños, como su tabla de CEVICHE. */
const SIZE_RE = /^(.*\S)\s+(1\/2|½|1\s?l|1\s?lt|1\s?litro|chic[oa]|median[oa]|grande)$/i;
export type KameRow<T> = { kind: "single"; item: T } | { kind: "sizes"; base: string; sizes: { label: string; item: T }[] };

export function kameRowsOf<T extends { name: string; price: number }>(items: T[]): KameRow<T>[] {
  const count = new Map<string, number>();
  for (const it of items) {
    const m = SIZE_RE.exec(it.name.trim());
    if (m) count.set(kameKeyOf(m[1]!), (count.get(kameKeyOf(m[1]!)) ?? 0) + 1);
  }
  const rows: KameRow<T>[] = [];
  const byBase = new Map<string, Extract<KameRow<T>, { kind: "sizes" }>>();
  for (const it of items) {
    const m = SIZE_RE.exec(it.name.trim());
    const key = m ? kameKeyOf(m[1]!) : null;
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
    row.sizes.push({ label: m[2]!.replace(/\s+/g, "").toUpperCase(), item: it });
  }
  for (const r of rows) if (r.kind === "sizes") r.sizes.sort((a, b) => a.item.price - b.item.price);
  return rows;
}

/** Calle y colonia, sin CP ni estado: completa no cabe en el teléfono. */
function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return address;
  return [parts[0], parts[1]!.replace(/^\d{4,5}\s+/, "")].join(", ");
}

/** Su papel escribe el precio pelón ("115"); aquí lleva un "$" chiquito para que nadie dude. */
function Price({ value, className = "" }: { value: number; className?: string }) {
  const whole = Number.isInteger(value);
  return (
    <span className={`${KAME_NAME} tabular-nums leading-none text-[#edb64a] ${className}`}>
      {whole ? (
        <>
          <span className="mr-[1px] text-[0.72em] opacity-70">$</span>
          {value}
        </>
      ) : (
        formatPrice(value)
      )}
    </span>
  );
}

/* ─────────────────────────── La franja amarilla ─────────────────────────── */

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="shrink-0">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z" />
    </svg>
  );
}

export function KameHeader({
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
  const name = loading ? "Kame House Cevichería" : restaurantName || "Kame House Cevichería";
  return (
    <header className="kame-band">
      <div className="kame-dotsbg" aria-hidden />
      <div className="kame-rays" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pt-3 sm:px-6 lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:items-end lg:gap-4 lg:px-8 lg:pt-8">
        <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-5 lg:pb-9">
          <div className="kame-logo h-[112px] w-[112px] sm:h-[150px] sm:w-[150px] lg:h-[236px] lg:w-[236px]">
            {/* El anillo de letras que le da la vuelta a su logo (así viene en su portada de Facebook). */}
            <svg className="kame-ring" viewBox="0 0 200 200" aria-hidden>
              <defs>
                <path id="kame-ring-path" d="M100,100 m-90,0 a90,90 0 1,1 180,0 a90,90 0 1,1 -180,0" />
              </defs>
              <text fontSize="11.5" className={KAME_TITLE}>
                <textPath href="#kame-ring-path" textLength="556" lengthAdjust="spacing">
                  CEVICHES ✦ COCTELES ✦ AGUACHILES ✦ RAMEN ✦ OSTIONES ✦
                </textPath>
              </text>
            </svg>
            <Image src="/skins/kame/logo.png" alt={name} width={312} height={312} priority unoptimized />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`${KAME_NAME} text-[11px] leading-tight tracking-[0.16em] text-[#263532]/75 lg:text-[12.5px]`}>{name}</h1>
            <p className="mt-1 text-[16px] font-bold leading-[1.15] text-[#263532] sm:text-[18px] lg:text-[23px]">
              {tagline?.trim() || PAPER_TAGLINE}
            </p>
            {!loading ? (
              <div className="mt-2.5 flex flex-col items-start gap-1.5 lg:mt-4 lg:gap-2.5">
                {schedule ? (
                  <span
                    className={
                      `${KAME_NAME} inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[10.5px] leading-[1.15] tracking-[0.08em] lg:px-3.5 lg:py-[7px] lg:text-[12px] ` +
                      (schedule.open ? "kame-status" : "kame-status kame-status--closed")
                    }
                  >
                    {schedule.open ? <span className="kame-live" aria-hidden /> : null}
                    <span className="translate-y-[1px]">{schedule.label}</span>
                  </span>
                ) : null}
                {address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-[12.5px] font-semibold text-[#263532] underline decoration-[#263532]/35 underline-offset-[3px] hover:decoration-[#263532] lg:text-[14px]"
                  >
                    <PinIcon />
                    <span className="min-w-0 truncate">{shortAddress(address)}</span>
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {/* Sus platillos: el recorte se sale 10 px por abajo para que al flotar nunca se vea la orilla. */}
        <div className="relative -mx-4 -mt-3 sm:-mx-6 lg:mx-0 lg:mt-0">
          <Image
            src="/skins/kame/food.webp"
            alt="Ostiones, coctel, ramen de mariscos y tosticeviche de Kame House"
            width={716}
            height={386}
            priority
            unoptimized
            className="kame-food -mb-[10px] block h-auto w-full"
          />
        </div>
      </div>
    </header>
  );
}

/** Kame no usa portada suelta: su franja amarilla ya es la portada. */
export function KameCover() {
  return null;
}

/* ─────────────────────────── Su hoja ─────────────────────────── */

/** La cinta que corre con SUS secciones (salen del menú, no están escritas). */
function Ticker({ words }: { words: string[] }) {
  if (words.length < 2) return null;
  const run = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-flex items-center gap-[18px]">
          {w}
          <i />
        </span>
      ))}
    </span>
  );
  return (
    <div className="kame-ticker -mx-4 mb-5 py-2 sm:-mx-6 lg:mb-10 lg:py-2.5" role="presentation">
      <div className={`${KAME_TITLE} kame-ticker__track text-[13px] leading-none tracking-[0.14em] text-[#f7cf1d] lg:text-[14px]`}>
        {run(false)}
        {run(true)}
        {run(true)}
        {run(true)}
      </div>
    </div>
  );
}

export function KameSheet({ children, categories = [] }: { children: ReactNode; categories?: string[] }) {
  return (
    <div className="pb-6">
      <Ticker words={categories} />
      <div className="kame-sheet">{children}</div>
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
        "kame-add flex shrink-0 items-center justify-center rounded-full font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fbf3d0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#263532] " +
        (small ? "h-[30px] w-[30px] text-[19px]" : "h-9 w-9 text-[23px]")
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
  small = false,
}: {
  name: string;
  quantity: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  small?: boolean;
}) {
  const h = small ? "h-[30px] w-[26px]" : "h-9 w-8";
  return (
    <div className="kame-stepper flex shrink-0 items-center rounded-full">
      <button type="button" aria-label={`Quitar uno de ${name}`} onClick={onDecrement} className={`flex ${h} items-center justify-center text-lg font-bold`}>
        −
      </button>
      <span className={`${KAME_NAME} min-w-[1.1rem] translate-y-[1px] text-center text-[14px] tabular-nums`}>{quantity}</span>
      <button type="button" aria-label={`Agregar uno de ${name}`} onClick={onIncrement} className={`flex ${h} items-center justify-center text-lg font-bold`}>
        +
      </button>
    </div>
  );
}

/* ─────────────────────────── Sección ─────────────────────────── */

export function KameCategorySection({
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
  /** La descripción que comparten todos los platillos de la sección (va una vez, bajo el título). */
  description?: string | null;
  note?: string | null;
  closed?: boolean;
  collapsed?: boolean;
  itemCount?: number;
  onToggle?: () => void;
}) {
  const id = `menu-cat-${index}`;
  const block = kameBlockOf(category);
  const medal = MEDAL[block];
  const ref = useRef<HTMLElement>(null);

  // Entrada al hacer scroll. Solo se "arma" lo que todavía no está en pantalla; sin IntersectionObserver o con
  // movimiento reducido no se arma nada y la sección se ve de una vez.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("kame-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("kame-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} aria-labelledby={id} data-kame={block} className={closed ? "opacity-60" : undefined}>
      <div className="kame-head flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={id} className={`${KAME_TITLE} kame-title text-[33px] leading-[0.95] tracking-[-0.01em] sm:text-[38px]`}>
              {category}
            </h2>
            {block === "ostiones" ? (
              <span className={`${KAME_TITLE} kame-new px-2.5 pb-[3px] pt-[5px] text-[13px] leading-none tracking-[0.04em]`}>New</span>
            ) : null}
          </div>
          <div className="kame-rule mt-2" aria-hidden />
          {description ? <p className="mt-3 max-w-[30rem] text-[15px] leading-[1.45] text-[#d8b25a]">{description}</p> : null}
          {note ? (
            <p className={`${KAME_NAME} mt-2 text-[11px] tracking-[0.12em] text-[#fbf3d0]/80`}>
              {closed ? "🕒 " : ""}
              {note}
            </p>
          ) : null}
          {closed && onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              className={`${KAME_NAME} mt-2 rounded-full border-2 border-[#f0dc78]/50 px-3.5 pb-1 pt-1.5 text-[11px] tracking-[0.12em] text-[#f0dc78] hover:bg-[#f0dc78]/10`}
            >
              {collapsed ? `Ver los ${itemCount} ▾` : "Ocultar ▴"}
            </button>
          ) : null}
        </div>
        {medal ? (
          <div className="kame-medal h-[84px] w-[84px] sm:h-[104px] sm:w-[104px]" style={{ animationDelay: `${(index % 4) * -1.3}s` }}>
            <Image src={medal.src} alt={medal.alt} width={220} height={220} unoptimized />
          </div>
        ) : null}
      </div>
      {collapsed ? null : <ul className="-mx-2 mt-4 space-y-0.5">{children}</ul>}
    </section>
  );
}

/* ─────────────────────────── Renglones ─────────────────────────── */

/** Un renglón, como su papel: NOMBRE · puntitos · precio · (+). */
export function KameItemRow({
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
  index = 0,
  hideDescription = false,
}: MenuItemCardProps & { index?: number; hideDescription?: boolean }) {
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <Stepper name={name} quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );
  const desc = hideDescription ? null : description?.trim() || null;
  const hint = optionsHint && optionsHint !== "Se arma a tu gusto" ? optionsHint.replace(/^🌶️\s*/, "") : null;
  return (
    <li
      className={"kame-row flex items-center gap-3 px-2 py-[7px] [break-inside:avoid] " + (quantity > 0 ? "kame-row--on" : "")}
      style={{ "--i": index } as CSSProperties}
    >
      <button type="button" onClick={onOpen} aria-label={`Ver ${name}`} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-end gap-2.5">
          <span className={`${KAME_NAME} min-w-0 text-[17px] leading-[1.15] tracking-[0.07em] text-[#f0dc78] sm:text-[18px]`}>{name}</span>
          <span className="kame-leader" aria-hidden />
          <Price value={price} className="shrink-0 text-[19px] sm:text-[20px]" />
        </span>
        {desc ? <span className="mt-1 block max-w-[30rem] pr-6 text-[14.5px] leading-[1.4] text-[#d8b25a]">{desc}</span> : null}
        {!desc && hint ? <span className={`${KAME_NAME} mt-1 block text-[11px] tracking-[0.1em] text-[#d8b25a]`}>{hint}</span> : null}
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={320} height={200} unoptimized className="mt-2 h-28 w-full max-w-[320px] rounded-[14px] object-cover" />
        ) : null}
      </button>
      {control}
    </li>
  );
}

export type KameSizeCell = {
  id: string;
  label: string;
  /** Nombre completo del platillo ("CAMARÓN 1L"): es lo que se lee en el carrito y en los avisos. */
  fullName: string;
  price: number;
  quantity: number;
  onAdd: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onOpen?: () => void;
};

/** Su tabla de CEVICHE: nombre · 1/2 precio · 1L precio. Cada tamaño es su botón. */
export function KameSizeRow({
  name,
  description = null,
  sizes,
  orderingEnabled = true,
  index = 0,
}: {
  name: string;
  description?: string | null;
  sizes: KameSizeCell[];
  orderingEnabled?: boolean;
  index?: number;
}) {
  const any = sizes.some((s) => s.quantity > 0);
  return (
    <li className={"kame-row px-2 py-[7px] [break-inside:avoid] " + (any ? "kame-row--on" : "")} style={{ "--i": index } as CSSProperties}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={sizes[0]?.onOpen}
          aria-label={`Ver ${name}`}
          className={`${KAME_NAME} min-w-0 flex-1 cursor-pointer text-left text-[17px] leading-[1.15] tracking-[0.07em] text-[#f0dc78] sm:text-[18px]`}
        >
          {name}
        </button>
        {sizes.map((s) => (
          <div
            key={s.id}
            className={"kame-size flex shrink-0 items-center gap-1.5 py-[3px] pl-2.5 pr-[3px] " + (s.quantity > 0 ? "kame-size--on" : "")}
          >
            <span className={`${KAME_NAME} translate-y-[1px] text-[12.5px] leading-none tracking-[0.04em] text-[#fbf3d0]`}>{s.label}</span>
            {s.quantity > 0 && orderingEnabled ? null : <Price value={s.price} className="translate-y-[1px] text-[16.5px]" />}
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
      {description ? <span className="mt-1 block max-w-[30rem] text-[14.5px] leading-[1.4] text-[#d8b25a]">{description}</span> : null}
    </li>
  );
}

/** Tarjeta de premios: crema con cabecera amarilla, como su franja. */
export function KamePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kame-card kame-rise mt-10 overflow-hidden" aria-label={title}>
      <h2 className={`${KAME_TITLE} kame-card__head px-5 pb-2.5 pt-3.5 text-[24px] leading-none sm:px-6`}>{title}</h2>
      <div className="px-5 pb-5 pt-4 sm:px-6">{children}</div>
    </section>
  );
}
