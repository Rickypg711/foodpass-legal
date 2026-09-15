"use client";

/**
 * Tema del FLUJO DE PAGO por piel (15-sep-2026, pedido de Ricardo con La Fresheria).
 *
 * POR QUÉ: las pieles vestían el menú, sus hojas y la portada, pero al picar "Ver carrito" el comensal caía en el
 * naranja de Comeleal: checkout, página del pedido y "Mis puntos" no leían `menuSkin`. Es el momento de más
 * confianza (nombre, teléfono, cómo paga) y el hueco más visible de la piel que se cobra.
 *
 * CÓMO ESCALA (Ricardo, 15-sep: "que sirva para todos los menús"):
 *  - Las tres páginas y sus componentes toman TODAS sus clases de un `FlowTheme`. Nunca traen un color escrito.
 *  - `DEFAULT_FLOW` es el naranja de siempre, byte por byte: un local sin piel se ve igual que ayer.
 *  - Una piel NO escribe 40 clases: declara sus FICHAS (`FlowTokens`: fondo, papel, tinta, acento, borde, radio,
 *    fuentes) y `buildFlowTheme` arma el tema con un solo juego de clases que leen variables CSS
 *    (`--flow-accent`, `--flow-paper`…). El encabezado de marca es genérico (logo + título en su fuente) y una
 *    piel puede traer el suyo. Piel nueva = ~10 líneas en `FLOW_BY_SKIN`. Piel sin fichas → DEFAULT.
 *  - Cero lógica de cobro cambia aquí: solo ropa.
 */

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { menuSkinFromRestaurant, type MenuSkinId } from "@/lib/menu/menuSkin";
import { FR_NAME, FR_ROOT_CLASS, FR_SCRIPT } from "@/components/menu/skins/fresheria";

export type FlowHeaderProps = {
  restaurantId: string;
  restaurantName: string;
  logoUrl?: string | null;
  /** "Confirmar pedido" · el nombre del local (pedido) · "⭐ Mis puntos". */
  title: string;
  /** "{nombre} · Recoger en local" · "Tu pedido y tus puntos". */
  subtitle?: string | null;
  /** Flecha de regreso al menú. */
  back?: boolean;
  /** Qué página es: el tema de siempre pinta cada una distinto (negro en checkout, naranja en pedido y puntos). */
  page: "checkout" | "order" | "puntos";
};

export type FlowTheme = {
  /** Fondo y tinta de toda la página. */
  root: string;
  rootStyle?: CSSProperties;
  Header: (p: FlowHeaderProps) => ReactNode;
  /** Tarjeta blanca con sombra (checkout) y tarjeta plana (pedido, puntos). */
  card: string;
  cardFlat: string;
  /** Renglones del carrito del checkout. */
  cartList: string;
  cartTitle: string;
  cartLine: string;
  cartName: string;
  cartOptions: string;
  cartMuted: string;
  cartRemove: string;
  cartSubtotal: string;
  stepper: string;
  stepperMinus: string;
  stepperPlus: string;
  cartNote: string;
  cartTotalLabel: string;
  cartTotal: string;
  /** Etiquetas y textos. */
  label: string;
  hint: string;
  muted: string;
  mutedSoft: string;
  /** Acento: asteriscos, opciones elegidas, total, estado. */
  accent: string;
  accentStyle: CSSProperties;
  /** Cajas suaves: preview de puntos, mesa, banner de puntos. */
  softBox: string;
  tableBox: string;
  tableBoxStyle?: CSSProperties;
  highlightBox: string;
  /** Campos. */
  input: string;
  inputSmall: string;
  inputCode: string;
  /** Opciones (forma de pago, recoger/domicilio). */
  option: (on: boolean) => string;
  optionSub: string;
  /** Botones. */
  cta: string;
  btn: string;
  btnOutline: string;
  link: string;
  linkMuted: string;
  /** Página del pedido. */
  statusStyle: CSSProperties;
  pin: string;
  staffBox: string;
  staffLink: string;
  modifiers: string;
  /** Barra de progreso del upsell. */
  progressBar: string;
  /** Esqueleto de carga. */
  skeletonBlock: string;
  /** Tinta base: las páginas le pegan la opacidad (`${th.ink}/60`). */
  ink: string;
  /** Rayas entre bloques y anillo suave del logo. */
  divider: string;
  dividerAccent: string;
  ringSoft: string;
  /** Página plana (pedido, puntos): el de siempre es liso, no degradado. */
  rootFlat: string;
  rootFlatStyle?: CSSProperties;
  /** Campo sin margen ni anillo (puntos). */
  inputPlain: string;
  /** Botón chico del upsell y botón de contorno con acento (Ver mis puntos). */
  btnSmall: string;
  btnOutlineAccent: string;
  /** Tarjeta de puntos por teléfono y cajas del upsell. */
  pointsCard: string;
  upsellBox: string;
  upsellBoxStrong: string;
  /** Acento oscuro del upsell y sus chips. */
  accentDeep: string;
  accentDeepStyle: CSSProperties;
  chip: string;
  chipHot: string;
};

/* Tailwind solo compila lo que ve escrito: las opacidades que las páginas le pegan a `ink` y a los bordes.
   text-(--flow-ink)/35 text-(--flow-ink)/40 text-(--flow-ink)/45 text-(--flow-ink)/50 text-(--flow-ink)/55
   text-(--flow-ink)/60 text-(--flow-ink)/65 text-(--flow-ink)/70 text-(--flow-ink)/75 text-(--flow-ink)/80
   border-(--flow-border)/40 border-(--flow-border)/50 border-(--flow-border)/70 ring-(--flow-border)/50 */

/* ─────────────────────────── El naranja de siempre (byte por byte) ─────────────────────────── */

function DefaultHeader({ restaurantId, restaurantName, logoUrl, title, subtitle, back = true, page }: FlowHeaderProps) {
  if (page === "checkout") {
    return (
      <header className="relative overflow-hidden bg-[#141414] shadow-md">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(242,140,56,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-3xl items-center gap-3.5 px-4 py-4 sm:px-6 lg:max-w-4xl">
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}`}
            aria-label="Volver al menú"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
          >
            ←
          </Link>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg ring-2 ring-white/15"
            />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F28C38]/15 text-xl ring-2 ring-white/10"
              aria-hidden
            >
              🍽
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-white">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-white/55">{subtitle}</p> : null}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#F28C38]/50 to-transparent" aria-hidden />
      </header>
    );
  }
  return (
    <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
      <div className="mx-auto flex max-w-md items-center gap-3">
        {back && page === "puntos" ? (
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}`}
            aria-label="Volver al menú"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white"
          >
            ←
          </Link>
        ) : null}
        {page === "order" ? (
          logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-md ring-2 ring-white/25" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl" aria-hidden>
              🍽
            </div>
          )
        ) : null}
        <div className="min-w-0">
          <h1 className={page === "order" ? "truncate text-lg font-bold leading-tight text-white" : "text-lg font-bold text-white"}>
            {title}
          </h1>
          {subtitle ? <p className="text-xs text-white/75">{subtitle}</p> : null}
        </div>
        {/* `restaurantName` viaja por si un tema lo quiere pintar aparte; el de siempre lo lleva en el título. */}
        <span className="sr-only">{restaurantName}</span>
      </div>
    </header>
  );
}

export const DEFAULT_FLOW: FlowTheme = {
  root: "min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F0E3D2] text-[#1C2526]",
  Header: (p) => <DefaultHeader {...p} />,
  card: "rounded-2xl bg-white p-4 shadow-sm",
  cardFlat: "rounded-xl bg-white p-4",
  cartList: "mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm",
  cartTitle: "pb-1 text-sm font-semibold text-[#1C2526]/70",
  cartLine: "border-b border-black/5 pb-3 last:border-0",
  cartName: "text-[15px] font-semibold leading-snug text-[#1C2526]",
  cartOptions: "mt-0.5 text-xs font-medium text-[#F28C38]",
  cartMuted: "mt-0.5 text-xs text-[#1C2526]/55",
  cartRemove: "mt-1 text-xs font-medium text-[#1C2526]/45 underline underline-offset-2 transition-colors hover:text-red-700",
  cartSubtotal: "text-sm font-bold tabular-nums text-[#1C2526]",
  stepper: "flex items-center rounded-full border border-[#1C2526]/10 bg-[#FAF7F2]",
  stepperMinus: "flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-[#1C2526] transition-colors hover:bg-white",
  stepperPlus: "flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-[#F28C38] transition-colors hover:bg-white",
  cartNote:
    "mt-2 w-full rounded-xl border border-[#1C2526]/10 bg-[#FAF7F2] px-3 py-2 text-[13px] text-[#1C2526] placeholder-[#1C2526]/35 outline-none transition-colors focus:border-[#F28C38] focus:bg-white",
  cartTotalLabel: "text-base font-bold text-[#1C2526]",
  cartTotal: "text-lg font-bold tabular-nums text-[#F28C38]",
  label: "text-sm font-semibold",
  hint: "mt-0.5 block text-xs text-[#1C2526]/55",
  muted: "text-[#1C2526]/70",
  mutedSoft: "text-[#1C2526]/55",
  accent: "text-[#F28C38]",
  accentStyle: { color: "#F28C38" },
  softBox: "rounded-xl bg-[#F28C38]/10",
  tableBox: "rounded-2xl p-4",
  tableBoxStyle: { background: "rgba(242,140,56,0.08)", border: "1px solid rgba(242,140,56,0.35)" },
  highlightBox: "rounded-2xl border border-[#F28C38]/35 bg-[#FFF3E8] p-4 text-center",
  input:
    "mt-2.5 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-[#1C2526]/35 focus:border-[#F28C38] focus:bg-white focus:ring-2 focus:ring-[#F28C38]/25",
  inputSmall: "mt-1.5 w-28 rounded-xl border border-[#1C2526]/15 bg-white px-3 py-2 text-[15px] outline-none focus:border-[#F28C38]",
  inputCode: "rounded-xl border border-[#1C2526]/15 bg-[#FAF7F2] px-3 py-2.5 text-center font-bold outline-none focus:border-[#F28C38]",
  option: (on) =>
    on ? "border-[#F28C38] bg-[#FFF3E8] ring-2 ring-[#F28C38]/25" : "border-[#1C2526]/12 bg-[#FAF7F2] hover:border-[#F28C38]/50",
  optionSub: "text-xs text-[#1C2526]/55",
  cta: "min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-base font-bold text-[#1C2526] shadow-md transition-colors hover:bg-[#d67428] disabled:opacity-60",
  btn: "rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-[#1C2526] shadow-sm transition-colors hover:bg-[#d67428] disabled:opacity-50",
  btnOutline:
    "rounded-xl border border-[#F28C38]/50 bg-white px-4 py-2.5 text-sm font-bold text-[#1C2526] transition-colors hover:bg-[#FFF3E8] disabled:opacity-50",
  link: "text-sm font-semibold text-[#F28C38] underline",
  linkMuted: "text-sm text-[#1C2526]/70 underline",
  statusStyle: { color: "#F28C38" },
  pin: "text-3xl font-bold tracking-widest",
  staffBox: "block rounded-xl border-2 border-[#F28C38] bg-[#FFF3E8] p-4 text-sm text-[#1C2526]",
  staffLink: "mt-2 font-semibold text-[#F28C38]",
  modifiers: "block text-xs text-[#F28C38]",
  progressBar: "h-full rounded-full bg-[#F28C38] shadow-[0_0_8px_rgba(242,140,56,0.6)] transition-[width] duration-700 ease-out",
  skeletonBlock: "rounded-xl bg-white p-4",
  ink: "text-[#1C2526]",
  divider: "border-[#1C2526]/8",
  dividerAccent: "border-[#F28C38]/15",
  ringSoft: "ring-[#1C2526]/10",
  rootFlat: "min-h-screen text-[#1C2526]",
  rootFlatStyle: { backgroundColor: "#F0E3D2" },
  inputPlain: "rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-[15px] outline-none focus:border-[#F28C38]",
  btnSmall: "rounded-lg bg-[#F28C38] px-4 py-2 text-sm font-semibold text-[#1C2526]",
  btnOutlineAccent: "rounded-xl border border-[#F28C38] bg-white px-5 py-2 text-sm font-bold text-[#F28C38] disabled:opacity-50",
  pointsCard: "rounded-2xl border border-[#F28C38]/35 bg-white p-4",
  upsellBox: "mb-4 rounded-xl border border-[#F28C38]/40 bg-[#FFF3E8] p-4",
  upsellBoxStrong: "mb-4 rounded-xl border border-[#F28C38] bg-[#FFF3E8] p-4",
  accentDeep: "text-[#B05E14]",
  accentDeepStyle: { color: "#B05E14" },
  chip: "rounded-full bg-[#F28C38]/15 px-3 py-1 text-xs font-semibold text-[#B05E14]",
  chipHot: "rounded-full bg-gradient-to-r from-[#F28C38] to-[#E85D75] px-3 py-1 text-xs font-bold text-[#1C2526]",
};

/* ─────────────────────────── Fichas por piel → tema con variables CSS ─────────────────────────── */

/**
 * Lo que una piel declara. Colores en hex; el resto son clases de Tailwind que YA existen en el bundle (las
 * fuentes vienen de la piel del menú, que ya las carga con next/font).
 */
export type FlowTokens = {
  /** Fondo de la página, papel de las tarjetas y tinta del texto. */
  bg: string;
  paper: string;
  ink: string;
  /** Acento (botones, elegido, total), su tinta encima y su tono al pasar el mouse. */
  accent: string;
  accentInk: string;
  accentHover: string;
  /** Borde de tarjetas, campos y píldoras. */
  border: string;
  /** Esquinas: "full" = píldoras (Fresheria); "xl" = redondeado normal. */
  radius: "full" | "xl";
  /** Radio de las tarjetas (clase Tailwind). */
  cardRadius: string;
  /** Sombra de las tarjetas (clase Tailwind), "" = ninguna. */
  cardShadow?: string;
  /** Clases de fuente: cuerpo (va en el root), nombres/botones, títulos de portada. */
  fontBody: string;
  fontName: string;
  fontDisplay: string;
  /** Clase raíz extra de la piel (carga sus fuentes y su CSS), p. ej. FR_ROOT_CLASS. */
  rootClass?: string;
  /** Logo estático de la piel para el encabezado (si no, el logoUrl del local). */
  logo?: { src: string; width: number; height: number };
  /** Encabezado propio; sin él se usa el genérico (tarjeta con logo, título en fontDisplay). */
  Header?: (p: FlowHeaderProps) => ReactNode;
};

/** Encabezado genérico de marca: tarjeta de papel con el logo, el título en la fuente de portada y la flecha. */
function BrandedHeader(tokens: FlowTokens, p: FlowHeaderProps) {
  const { restaurantId, restaurantName, logoUrl, back = true } = p;
  const logo = tokens.logo ?? (logoUrl ? { src: logoUrl, width: 96, height: 96 } : null);
  // La página del pedido manda el nombre del local como título; con el logo arriba se repetiría, así que el
  // subtítulo ("Tu pedido y tus puntos") sube a título.
  const title = p.title === restaurantName && p.subtitle ? p.subtitle : p.title;
  const subtitle = title === p.subtitle ? null : p.subtitle;
  const r = tokens.radius === "full" ? "rounded-full" : "rounded-xl";
  return (
    <header className="px-3 pt-3 sm:px-6 sm:pt-5">
      <div className={`${tokens.cardRadius} ${tokens.cardShadow ?? ""} mx-auto max-w-md border-2 border-(--flow-border) bg-(--flow-paper) px-4 pb-4 pt-4 text-center`}>
        <div className="relative">
          {back ? (
            <Link
              href={`/menu/${encodeURIComponent(restaurantId)}`}
              aria-label="Volver al menú"
              className={`absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center ${r} border-[1.5px] border-(--flow-border) bg-(--flow-paper) text-lg text-(--flow-ink) transition-colors hover:bg-(--flow-accent) hover:text-(--flow-accent-ink)`}
            >
              ←
            </Link>
          ) : null}
          {logo ? (
            <Image src={logo.src} alt={restaurantName} width={logo.width} height={logo.height} unoptimized priority className={tokens.logo ? "mx-auto h-[64px] w-auto" : "mx-auto h-[64px] w-[64px] rounded-2xl object-cover"} />
          ) : null}
        </div>
        <h1 className={`${tokens.fontDisplay} mt-1 text-(--flow-ink)`}>{title}</h1>
        {subtitle ? <p className={`${tokens.fontName} mt-1 text-[13px] uppercase tracking-[0.12em] text-(--flow-ink)/70`}>{subtitle}</p> : null}
        <div className="mx-auto mt-2 h-[2px] w-16 bg-(--flow-accent)" aria-hidden />
      </div>
    </header>
  );
}

/** Arma el tema completo desde las fichas. Todas las clases son estáticas y leen variables CSS del root. */
export function buildFlowTheme(t: FlowTokens): FlowTheme {
  const r = t.radius === "full" ? "rounded-full" : "rounded-xl";
  const card = `${t.cardRadius} ${t.cardShadow ?? ""} border-[1.5px] border-(--flow-border) bg-(--flow-paper)`;
  const field =
    `${r} border-[1.5px] border-(--flow-border) bg-(--flow-paper) text-(--flow-ink) outline-none transition-colors placeholder:text-(--flow-ink)/35 focus:border-(--flow-accent) focus:ring-2 focus:ring-(--flow-accent)/25`;
  const rootStyle: CSSProperties = {
      ["--flow-bg" as string]: t.bg,
      ["--flow-paper" as string]: t.paper,
      ["--flow-ink" as string]: t.ink,
      ["--flow-accent" as string]: t.accent,
      ["--flow-accent-ink" as string]: t.accentInk,
      ["--flow-accent-hover" as string]: t.accentHover,
      ["--flow-border" as string]: t.border,
  };
  return {
    root: `${t.rootClass ?? ""} ${t.fontBody} min-h-screen bg-(--flow-bg) text-(--flow-ink)`,
    rootStyle,
    rootFlatStyle: rootStyle,
    Header: t.Header ?? ((p) => BrandedHeader(t, p)),
    card: `${card} p-4`,
    cardFlat: `${card} p-4`,
    cartList: `${card} mb-4 flex flex-col gap-3 p-4`,
    cartTitle: `${t.fontDisplay} pb-1 text-(--flow-ink)`,
    cartLine: "border-b border-(--flow-border)/40 pb-3 last:border-0",
    cartName: `${t.fontName} text-[17px] leading-snug text-(--flow-ink)`,
    cartOptions: "mt-0.5 text-xs font-medium text-(--flow-accent)",
    cartMuted: "mt-0.5 text-xs text-(--flow-ink)/55",
    cartRemove: "mt-1 text-xs font-medium text-(--flow-ink)/45 underline underline-offset-2 transition-colors hover:text-(--flow-accent)",
    cartSubtotal: `${t.fontName} text-[16px] tabular-nums text-(--flow-ink)`,
    stepper: `flex items-center ${r} border-[1.5px] border-(--flow-border) bg-(--flow-paper)`,
    stepperMinus: "flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-(--flow-ink) transition-colors hover:bg-(--flow-bg)",
    stepperPlus: "flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-(--flow-accent) transition-colors hover:bg-(--flow-bg)",
    cartNote: `mt-2 w-full ${r} border-[1.5px] border-(--flow-border)/70 bg-(--flow-bg) px-3.5 py-2 text-[13px] text-(--flow-ink) placeholder:text-(--flow-ink)/35 outline-none transition-colors focus:border-(--flow-accent) focus:bg-(--flow-paper)`,
    cartTotalLabel: `${t.fontName} text-[18px] text-(--flow-ink)`,
    cartTotal: `${t.fontName} inline-flex ${r} border-[1.5px] border-(--flow-border) bg-(--flow-paper) px-4 py-0.5 text-[18px] tabular-nums text-(--flow-ink)`,
    label: `${t.fontName} text-[16px] text-(--flow-ink)`,
    hint: "mt-0.5 block text-xs text-(--flow-ink)/60",
    muted: "text-(--flow-ink)/70",
    mutedSoft: "text-(--flow-ink)/55",
    accent: "text-(--flow-accent)",
    accentStyle: { color: t.accent },
    softBox: `${t.cardRadius} border border-(--flow-border)/50 bg-(--flow-bg)`,
    tableBox: `${card} p-4`,
    highlightBox: `${card} p-4 text-center`,
    input: `mt-2.5 w-full ${field} px-4 py-3 text-[15px]`,
    inputSmall: `mt-1.5 w-28 ${field} px-3 py-2 text-[15px]`,
    inputCode: `${field} px-3 py-2.5 text-center font-bold`,
    option: (on) =>
      on
        ? "border-(--flow-accent) bg-(--flow-accent) text-(--flow-accent-ink) ring-2 ring-(--flow-accent)/25"
        : "border-(--flow-border) bg-(--flow-paper) text-(--flow-ink) hover:border-(--flow-accent)",
    optionSub: "text-xs opacity-70",
    cta: `${t.fontName} min-h-12 ${r} bg-(--flow-accent) py-3.5 text-[17px] tracking-[0.02em] text-(--flow-accent-ink) shadow-[0_14px_30px_-16px_var(--flow-accent)] transition-colors hover:bg-(--flow-accent-hover) disabled:opacity-60`,
    btn: `${t.fontName} ${r} bg-(--flow-accent) px-4 py-2.5 text-[15px] text-(--flow-accent-ink) shadow-sm transition-colors hover:bg-(--flow-accent-hover) disabled:opacity-50`,
    btnOutline: `${t.fontName} ${r} border-[1.5px] border-(--flow-border) bg-(--flow-paper) px-4 py-2.5 text-[15px] text-(--flow-ink) transition-colors hover:border-(--flow-accent) disabled:opacity-50`,
    link: "text-sm font-semibold text-(--flow-accent) underline decoration-(--flow-accent)/40 underline-offset-4",
    linkMuted: "text-sm text-(--flow-ink)/70 underline decoration-(--flow-border)/70 underline-offset-4",
    statusStyle: { color: t.accent },
    pin: `${t.fontName} text-3xl tracking-widest text-(--flow-ink)`,
    staffBox: `${card} block border-2 border-(--flow-accent) p-4 text-sm text-(--flow-ink)`,
    staffLink: "mt-2 font-semibold text-(--flow-accent)",
    modifiers: "block text-xs text-(--flow-accent)",
    progressBar: "h-full rounded-full bg-(--flow-accent) transition-[width] duration-700 ease-out",
    skeletonBlock: `${card} p-4`,
    ink: "text-(--flow-ink)",
    divider: "border-(--flow-border)/40",
    dividerAccent: "border-(--flow-border)/40",
    ringSoft: "ring-(--flow-border)/50",
    rootFlat: `${t.rootClass ?? ""} ${t.fontBody} min-h-screen bg-(--flow-bg) text-(--flow-ink)`,
    inputPlain: `${field} px-4 py-3 text-[15px]`,
    btnSmall: `${t.fontName} ${r} bg-(--flow-accent) px-4 py-2 text-sm text-(--flow-accent-ink)`,
    btnOutlineAccent: `${t.fontName} ${r} border-[1.5px] border-(--flow-accent) bg-(--flow-paper) px-5 py-2 text-[15px] text-(--flow-accent) disabled:opacity-50`,
    pointsCard: `${card} p-4`,
    upsellBox: `${card} mb-4 p-4`,
    upsellBoxStrong: `${card} mb-4 border-(--flow-accent) p-4`,
    accentDeep: "text-(--flow-accent)",
    accentDeepStyle: { color: t.accent },
    chip: "rounded-full bg-(--flow-accent)/15 px-3 py-1 text-xs font-semibold text-(--flow-accent)",
    chipHot: "rounded-full bg-(--flow-accent) px-3 py-1 text-xs font-bold text-(--flow-accent-ink)",
  };
}

/* ─────────────────────────── Fichas de cada piel ─────────────────────────── */

/** La Fresheria: su PDF rosa con marco dorado, cursiva vino, píldoras y magenta (components/menu/skins/fresheria.tsx). */
const FRESHERIA_TOKENS: FlowTokens = {
  bg: "#feeef8",
  paper: "#fffbfd",
  ink: "#56052d",
  accent: "#cb0465",
  accentInk: "#fffbfd",
  accentHover: "#a80353",
  border: "#9e6036",
  radius: "full",
  cardRadius: "rounded-[22px]",
  cardShadow: "shadow-[0_22px_44px_-34px_rgba(86,5,45,0.45)]",
  fontBody: "[font-family:var(--fr-sans),Poppins,system-ui,sans-serif]",
  fontName: FR_NAME,
  fontDisplay: `${FR_SCRIPT} text-[38px] leading-none`,
  rootClass: FR_ROOT_CLASS,
  logo: { src: "/skins/fresheria/logo.png", width: 1200, height: 673 },
};

/**
 * Piel → fichas. Para vestir el flujo de otra piel: agrega su renglón aquí con sus colores (los del propio papel,
 * como en su `.css`), sus clases de fuente (las que ya exporta su `skins/{piel}.tsx`) y su logo estático.
 */
const FLOW_BY_SKIN: Partial<Record<MenuSkinId, FlowTokens>> = {
  fresheria: FRESHERIA_TOKENS,
};

const BUILT = new Map<MenuSkinId, FlowTheme>();

/** El tema del flujo para este local. Sin piel, o piel sin fichas todavía → el de siempre. */
export function flowThemeFor(raw: Record<string, unknown> | null | undefined): FlowTheme {
  const skin = menuSkinFromRestaurant(raw);
  const tokens = skin ? FLOW_BY_SKIN[skin] : undefined;
  if (!skin || !tokens) return DEFAULT_FLOW;
  let built = BUILT.get(skin);
  if (!built) {
    built = buildFlowTheme(tokens);
    BUILT.set(skin, built);
  }
  return built;
}
