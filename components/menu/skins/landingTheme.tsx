"use client";

/**
 * Tema de la PORTADA (/r/{id}) por piel (10-sep-2026).
 *
 * Regla: una piel = las dos páginas. El QR abre /menu, pero el link que el
 * dueño pega en su bio y manda por WhatsApp es /r; si la portada sale con el
 * header negro de Comeleal y el menú con el papel del local, se sienten dos
 * productos. Aquí vive SOLO la ropa: LandingView conserva su estructura
 * (CTA pegajoso, WhatsApp, Llamar, Cómo llegar, premios, horario, FAQ) y
 * lee las clases de este tema. Sin piel, `DEFAULT` es exactamente lo que la
 * portada usaba antes.
 */

import type { ReactNode } from "react";
import type { MenuSkinId } from "@/lib/menu/menuSkin";
import type { ScheduleStatus } from "@/lib/schedule";
import { PECADO_ROOT_CLASS, PecadoHeader } from "@/components/menu/skins/pecado";
import { TERCERA_ROOT_CLASS, TerceraHeader } from "@/components/menu/skins/tercera";
import { NB_MONO, NB_ROOT_CLASS, NBDots, NegroBlancoHeader } from "@/components/menu/skins/negroblanco";
import { BL_ROOT_CLASS, BloomsHeader } from "@/components/menu/skins/blooms";

export type LandingHeaderProps = {
  loading: boolean;
  restaurantName: string;
  logoUrl: string | null;
  tagline?: string | null;
  schedule?: ScheduleStatus | null;
  address?: string | null;
  /** "mariscos · cantina" — las categorías del local. */
  secondarySubtitle?: string | null;
};

export type LandingTheme = {
  root: string;
  /** null = el hero de siempre (negro / color de marca). */
  Header: ((p: LandingHeaderProps) => ReactNode) | null;
  cta: string;
  btnWhatsapp: string;
  btnNeutral: string;
  descriptionCard: string;
  card: string;
  /** Título de cada tarjeta (SectionCard). */
  cardTitle: (title: string) => ReactNode;
  link: string;
  text: string;
  textSoft: string;
  todayRow: string;
  row: string;
  closedText: string;
  faqOpen: string;
  faqChevron: string;
  faqAnswer: string;
  seoText: string;
  signature: string;
  signatureLink: string;
  loading: string;
  photoName: string;
  photoPrice: string;
};

const DEFAULT: LandingTheme = {
  root: "min-h-screen bg-gradient-to-b from-[#FAF7F2] via-[#F5EDE2] to-[#F0E3D2] text-[#1C2526]",
  Header: null,
  cta: "block min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-center text-base font-semibold text-[#1C2526] shadow-md ring-1 ring-black/5 transition-colors hover:bg-[#d67428]",
  btnWhatsapp:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/25 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100",
  btnNeutral:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1C2526]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2]",
  descriptionCard: "rounded-2xl border border-[#1C2526]/8 bg-white/85 p-4 text-sm leading-relaxed text-[#1C2526]/80 shadow-sm sm:p-5",
  card: "rounded-2xl border border-[#1C2526]/8 bg-white/85 p-4 shadow-sm sm:p-5",
  cardTitle: (title) => (
    <h2 className="mb-3 flex items-center gap-2.5 text-base font-bold tracking-tight text-[#1C2526]">
      <span className="h-4 w-1 rounded-full bg-[#F28C38]" aria-hidden />
      {title}
    </h2>
  ),
  link: "font-semibold text-[#F28C38] underline-offset-2 hover:underline",
  text: "text-[#1C2526]/80",
  textSoft: "text-[#1C2526]/70",
  todayRow: "bg-[#F28C38]/10 font-semibold text-[#1C2526]",
  row: "text-[#1C2526]/70",
  closedText: "text-[#1C2526]/45",
  faqOpen: "open:bg-[#FAF7F2]",
  faqChevron: "text-[#F28C38]",
  faqAnswer: "text-[#1C2526]/75",
  seoText: "text-[#1C2526]/55",
  signature: "text-[#1C2526]/50",
  signatureLink: "font-semibold text-[#F28C38] underline-offset-2 hover:underline",
  loading: "rounded-2xl border border-[#1C2526]/8 bg-white/80 px-4 py-6 text-center text-sm text-[#1C2526]/70",
  photoName: "text-[#1C2526]",
  photoPrice: "text-[#F28C38]",
};

/** Pecado Escondido: hoja crema sobre su rojo, botones rojos 3D, píldoras. */
const PECADO_NAME = "[font-family:var(--pc-name),'Arial_Narrow',sans-serif]";
const PECADO: LandingTheme = {
  root: PECADO_ROOT_CLASS,
  Header: (p) => <PecadoHeader {...p} />,
  cta: `${PECADO_NAME} block min-h-12 rounded-full bg-[#a61c21] py-3.5 text-center text-[19px] font-extrabold uppercase tracking-wide text-[#ffeecf] shadow-[0_4px_0_#7a1014] transition-transform hover:scale-[1.01] active:translate-y-[2px] active:shadow-none`,
  btnWhatsapp: `${PECADO_NAME} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#ffeecf] bg-[#ffeecf] px-3 py-2.5 text-[15px] font-extrabold uppercase tracking-wide text-[#a61c21] transition-colors hover:bg-[#fbe3b8]`,
  btnNeutral: `${PECADO_NAME} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#ffeecf] bg-transparent px-3 py-2.5 text-[15px] font-extrabold uppercase tracking-wide text-[#ffeecf] transition-colors hover:bg-[#ffeecf]/15`,
  descriptionCard: "rounded-[22px] bg-[#ffeecf] p-4 text-[13.5px] font-medium leading-relaxed text-[#a61c21]/90 shadow-[0_12px_32px_rgba(60,10,5,0.28)] sm:p-5",
  card: "rounded-[28px] bg-[#ffeecf] px-4 pt-5 pb-5 shadow-[0_12px_32px_rgba(60,10,5,0.28)] sm:px-6",
  cardTitle: (title) => (
    <h2 className={`${PECADO_NAME} mx-auto mb-4 flex w-full max-w-md items-center justify-center rounded-full border-2 border-[#a61c21] px-4 py-1.5 text-[17px] font-extrabold uppercase leading-none tracking-[0.05em] text-[#a61c21] sm:text-[19px]`}>
      {title}
    </h2>
  ),
  link: "font-bold text-[#a61c21] underline decoration-[#a61c21]/40 underline-offset-4",
  text: "text-[#a61c21]/90 font-medium",
  textSoft: "text-[#a61c21]/80",
  todayRow: "bg-[#fbaa19]/45 font-bold text-[#a61c21]",
  row: "text-[#a61c21]/80",
  closedText: "text-[#a61c21]/45",
  faqOpen: "open:bg-[#a61c21]/[0.06]",
  faqChevron: "text-[#a61c21]",
  faqAnswer: "text-[#a61c21]/85",
  seoText: "text-[#ffeecf]/80",
  signature: "text-[#ffeecf]/80",
  signatureLink: "font-bold text-[#fbaa19] underline decoration-[#fbaa19]/50 underline-offset-4",
  loading: "rounded-[22px] bg-[#ffeecf] px-4 py-6 text-center text-sm text-[#a61c21]/80",
  photoName: "text-[#a61c21]",
  photoPrice: "text-[#a61c21]/80",
};

/** Café de la Tercera: salmón, paneles durazno, botón negro, títulos bubble. */
const TZ_BUBBLE = "[font-family:var(--tz-bubble),Impact,sans-serif] tracking-wide";
const TZ_PIXEL = "[font-family:var(--tz-pixel),monospace] tracking-tight";
const TERCERA: LandingTheme = {
  root: TERCERA_ROOT_CLASS,
  Header: (p) => <TerceraHeader {...p} />,
  cta: `${TZ_BUBBLE} block min-h-12 rounded-full border-[3px] border-[#1a1a1a] bg-[#1a1a1a] py-3 text-center text-[18px] uppercase text-[#fbddd5] transition-transform hover:scale-[1.01] active:scale-[0.99]`,
  btnWhatsapp: `${TZ_PIXEL} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#00b044]/25 px-3 py-2.5 text-[12px] uppercase text-[#1a1a1a] transition-colors hover:bg-[#00b044]/40`,
  btnNeutral: `${TZ_PIXEL} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#1a1a1a] bg-[#fbddd5] px-3 py-2.5 text-[12px] uppercase text-[#1a1a1a] transition-colors hover:bg-[#fac6b8]`,
  descriptionCard: "rounded-[28px] bg-[#fbddd5] p-4 text-[14px] leading-relaxed text-[#1a1a1a]/85 sm:p-5",
  card: "rounded-[28px] bg-[#fbddd5] px-4 pt-5 pb-4 sm:px-6",
  cardTitle: (title) => (
    <h2 className={`${TZ_BUBBLE} mb-3 text-[26px] uppercase leading-none text-[#ee892f] sm:text-[30px]`}>{title}</h2>
  ),
  link: "font-bold text-[#e74b34] underline decoration-dotted underline-offset-4",
  text: "text-[#1a1a1a]/85",
  textSoft: "text-[#1a1a1a]/75",
  todayRow: "bg-[#fbb2a3] font-bold text-[#1a1a1a]",
  row: "text-[#1a1a1a]/75",
  closedText: "text-[#1a1a1a]/45",
  faqOpen: "open:bg-[#fac6b8]",
  faqChevron: "text-[#e74b34]",
  faqAnswer: "text-[#1a1a1a]/80",
  seoText: "text-[#1a1a1a]/70",
  signature: "text-[#1a1a1a]/70",
  signatureLink: "font-bold text-[#e74b34] underline decoration-dotted underline-offset-4",
  loading: "rounded-[28px] bg-[#fbddd5] px-4 py-6 text-center text-sm text-[#1a1a1a]/75",
  photoName: "text-[#1a1a1a]",
  photoPrice: "text-[#e74b34]",
};

/** Negro Blanco Café: el encabezado negro con su disco, tarjetas blancas
 *  sobre la retícula del pegboard, botón píldora negro, detalles en mono. */
const NEGROBLANCO: LandingTheme = {
  root: NB_ROOT_CLASS,
  Header: (p) => <NegroBlancoHeader {...p} />,
  cta: "block min-h-12 rounded-full bg-[#0b0b0b] py-3.5 text-center text-[16px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_34px_-14px_rgba(0,0,0,0.7)] transition-transform hover:scale-[1.01] active:scale-[0.99]",
  btnWhatsapp: `${NB_MONO} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#0b0b0b] bg-white px-3 py-2.5 text-[11.5px] uppercase tracking-[0.12em] text-[#0b0b0b] transition-colors hover:bg-[#0b0b0b] hover:text-white`,
  btnNeutral: `${NB_MONO} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#0b0b0b]/25 bg-white/60 px-3 py-2.5 text-[11.5px] uppercase tracking-[0.12em] text-[#0b0b0b] transition-colors hover:border-[#0b0b0b]`,
  descriptionCard: "rounded-[28px] bg-white p-5 text-[15px] leading-relaxed tracking-[-0.01em] text-[#0b0b0b]/80 ring-1 ring-[#0b0b0b]/[0.07] sm:p-6",
  card: "rounded-[32px] bg-white px-5 pt-5 pb-5 ring-1 ring-[#0b0b0b]/[0.07] sm:px-7 sm:pt-6",
  cardTitle: (title) => (
    <h2 className="mb-4 flex items-center gap-3">
      <NBDots />
      <span className="text-[26px] font-semibold lowercase leading-none tracking-[-0.045em] text-[#0b0b0b]">{title}</span>
    </h2>
  ),
  link: "font-semibold text-[#0b0b0b] underline decoration-[#0b0b0b]/30 underline-offset-4 hover:decoration-[#0b0b0b]",
  text: "text-[#0b0b0b]/80",
  textSoft: "text-[#0b0b0b]/65",
  todayRow: "bg-[#0b0b0b] font-semibold text-white",
  row: "text-[#0b0b0b]/70",
  closedText: "text-[#0b0b0b]/40",
  faqOpen: "open:bg-[#0b0b0b]/[0.04]",
  faqChevron: "text-[#0b0b0b]",
  faqAnswer: "text-[#0b0b0b]/75",
  seoText: "text-[#0b0b0b]/55",
  signature: `${NB_MONO} text-[11px] uppercase tracking-[0.14em] text-[#0b0b0b]/50`,
  signatureLink: "font-semibold text-[#0b0b0b] underline decoration-[#0b0b0b]/30 underline-offset-4",
  loading: "rounded-[28px] bg-white px-4 py-6 text-center text-sm text-[#0b0b0b]/60 ring-1 ring-[#0b0b0b]/[0.07]",
  photoName: "text-[#0b0b0b]",
  photoPrice: `${NB_MONO} text-[#0b0b0b]/60`,
};

/** Blooms Coffee & Mocktails: rubor de acuarela, tarjetas blancas con su franja rosa, botón rosa, títulos anchos. */
const BLOOMS: LandingTheme = {
  root: BL_ROOT_CLASS,
  Header: (p) => <BloomsHeader {...p} />,
  cta: "block min-h-12 rounded-full bg-[#ff5c9a] py-3.5 text-center text-[15px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_-12px_rgba(255,92,154,0.95)] transition-transform hover:scale-[1.01] active:scale-[0.99]",
  btnWhatsapp: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#1c1a1b] bg-white px-3 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1c1a1b] transition-colors hover:bg-[#1c1a1b] hover:text-white",
  btnNeutral: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#ff5c9a]/40 bg-white px-3 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1c1a1b] transition-colors hover:border-[#ff5c9a]",
  descriptionCard: "rounded-[24px] border-l-[10px] border-[#ff5c9a] bg-white p-5 text-[14.5px] font-medium leading-relaxed text-[#6d2f47] shadow-[0_18px_44px_-30px_rgba(232,64,127,0.6)]",
  card: "rounded-[28px] border-l-[10px] border-[#ff5c9a] bg-white px-5 pt-5 pb-5 shadow-[0_18px_44px_-30px_rgba(232,64,127,0.6)] sm:px-7",
  cardTitle: (title) => (
    <h2 className="mb-4 border-y-2 border-[#1c1a1b] py-2 text-[20px] font-black uppercase tracking-[0.08em] text-[#1c1a1b]">
      <span className="text-[#ff5c9a]">{title.slice(0, Math.max(2, Math.round(title.length * 0.42)))}</span>
      {title.slice(Math.max(2, Math.round(title.length * 0.42)))}
    </h2>
  ),
  link: "font-extrabold text-[#e8407f] underline decoration-[#ff5c9a]/40 underline-offset-4",
  text: "font-medium text-[#1c1a1b]/80",
  textSoft: "text-[#6d2f47]/75",
  todayRow: "bg-[#ff5c9a] font-extrabold text-white",
  row: "text-[#1c1a1b]/75",
  closedText: "text-[#1c1a1b]/40",
  faqOpen: "open:bg-[#ff5c9a]/[0.06]",
  faqChevron: "text-[#ff5c9a]",
  faqAnswer: "text-[#6d2f47]/85",
  seoText: "text-[#6d2f47]/65",
  signature: "text-[11px] font-bold uppercase tracking-[0.12em] text-[#6d2f47]/70",
  signatureLink: "font-extrabold text-[#e8407f] underline decoration-[#ff5c9a]/40 underline-offset-4",
  loading: "rounded-[24px] bg-white px-4 py-6 text-center text-sm text-[#6d2f47]/70",
  photoName: "text-[#1c1a1b]",
  photoPrice: "font-extrabold text-[#e8407f]",
};

export function landingThemeFor(skin: MenuSkinId | null): LandingTheme {
  if (skin === "pecado") return PECADO;
  if (skin === "tercera") return TERCERA;
  if (skin === "negroblanco") return NEGROBLANCO;
  if (skin === "blooms") return BLOOMS;
  return DEFAULT;
}
