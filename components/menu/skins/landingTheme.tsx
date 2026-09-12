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
import { MX_DISPLAY, MX_ROOT_CLASS, MixtecoHeader } from "@/components/menu/skins/mixteco";
import { LP_ROOT_CLASS, LP_SERIF, LaspicHeader } from "@/components/menu/skins/laspic";
import { TP_DISPLAY, TP_ROOT_CLASS, TortasHeader } from "@/components/menu/skins/tortasperras";
import { IGO_DISPLAY, IGO_NAME, IGO_ROOT_CLASS, IGOHeader } from "@/components/menu/skins/igo";

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

/** Mixteco: su portada verde con la frase y el logo, tarjetas crema como sus hojas, botón crema de molde. */
const MIXTECO: LandingTheme = {
  root: MX_ROOT_CLASS,
  Header: (p) => <MixtecoHeader {...p} />,
  cta: `${MX_DISPLAY} block min-h-12 rounded-full bg-[#f6f5e0] py-3.5 text-center text-[16px] uppercase tracking-[0.12em] text-[#234933] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8)] transition-transform hover:scale-[1.01] active:scale-[0.99]`,
  btnWhatsapp: `${MX_DISPLAY} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#f6f5e0] bg-[#6cbd8c]/15 px-3 py-2.5 text-[12px] uppercase tracking-[0.12em] text-[#f6f5e0] transition-colors hover:bg-[#6cbd8c]/30`,
  btnNeutral: `${MX_DISPLAY} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-[#f6f5e0]/35 bg-transparent px-3 py-2.5 text-[12px] uppercase tracking-[0.12em] text-[#f6f5e0] transition-colors hover:border-[#f6f5e0]`,
  descriptionCard: "mx-sheet rounded-[6px] p-5 text-[15.5px] leading-relaxed text-[#1f3a2b]/85 sm:p-6",
  card: "mx-sheet rounded-[6px] px-5 pt-5 pb-5 sm:px-7 sm:pt-6",
  cardTitle: (title) => (
    <h2 className={`${MX_DISPLAY} mb-4 text-[20px] uppercase tracking-[0.1em] text-[#234933] sm:text-[22px]`}>{title}</h2>
  ),
  link: "font-semibold text-[#2f7a50] underline decoration-[#2f7a50]/35 underline-offset-4",
  text: "text-[#1f3a2b]/85",
  textSoft: "text-[#1f3a2b]/70",
  todayRow: "bg-[#234933] font-semibold text-[#f6f5e0]",
  row: "text-[#1f3a2b]/75",
  closedText: "text-[#1f3a2b]/40",
  faqOpen: "open:bg-[#234933]/[0.06]",
  faqChevron: "text-[#234933]",
  faqAnswer: "text-[#1f3a2b]/80",
  seoText: "text-[#cfe3cb]/75",
  signature: "text-[#cfe3cb]/70",
  signatureLink: "font-semibold text-[#9fd6b3] underline decoration-[#9fd6b3]/40 underline-offset-4",
  loading: "mx-sheet rounded-[6px] px-4 py-6 text-center text-sm text-[#1f3a2b]/70",
  photoName: "text-[#1f3a2b]",
  photoPrice: `${MX_DISPLAY} tracking-[0.12em] text-[#557061]`,
};

/** LasPic: su fachada (ajedrez, "Las Pic" en serif rojo) y tarjetas blancas como su papel, títulos serif con punto. */
const LASPIC: LandingTheme = {
  root: LP_ROOT_CLASS,
  Header: (p) => <LaspicHeader {...p} />,
  cta: "block min-h-12 rounded-full bg-[#141414] py-3.5 text-center text-[14px] font-semibold uppercase tracking-[0.16em] text-[#fbf8f2] shadow-[0_14px_30px_-16px_rgba(0,0,0,0.8)] transition-transform hover:scale-[1.01] active:scale-[0.99]",
  btnWhatsapp:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#141414] bg-[#fffdf8] px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#fffdf8]",
  btnNeutral:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#141414]/30 bg-transparent px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#141414] transition-colors hover:border-[#141414]",
  descriptionCard: "lp-sheet rounded-[4px] p-5 text-[15.5px] leading-relaxed text-[#141414]/80 sm:p-6",
  card: "lp-sheet rounded-[4px] px-5 pt-5 pb-5 sm:px-7 sm:pt-6",
  cardTitle: (title) => (
    <h2 className={`${LP_SERIF} mb-4 inline-block border-b border-[#141414] pb-1 text-[28px] leading-none text-[#141414]`}>
      {title.replace(/\s*[⭐🔥]\s*$/u, "")}.
    </h2>
  ),
  link: "font-semibold text-[#d23f2c] underline decoration-[#d23f2c]/35 underline-offset-4",
  text: "text-[#141414]/80",
  textSoft: "text-[#141414]/65",
  todayRow: "bg-[#141414] font-semibold text-[#fbf8f2]",
  row: "text-[#141414]/75",
  closedText: "text-[#141414]/40",
  faqOpen: "open:bg-[#141414]/[0.04]",
  faqChevron: "text-[#d23f2c]",
  faqAnswer: "text-[#141414]/75",
  seoText: "text-[#141414]/55",
  signature: "text-[#141414]/55",
  signatureLink: "font-semibold text-[#d23f2c] underline decoration-[#d23f2c]/35 underline-offset-4",
  loading: "lp-sheet rounded-[4px] px-4 py-6 text-center text-sm text-[#141414]/60",
  photoName: "text-[#141414]",
  photoPrice: "font-medium text-[#141414]/70",
};

/** Tortas Perras: su portada roja y el papel hueso con los óvalos de sus títulos. */
const TORTASPERRAS: LandingTheme = {
  root: TP_ROOT_CLASS,
  Header: (p) => <TortasHeader {...p} />,
  cta: `${TP_DISPLAY} block min-h-12 rounded-full bg-[#cf1225] py-3.5 text-center text-[16px] uppercase tracking-[0.08em] text-[#f4f1ea] shadow-[0_14px_30px_-16px_rgba(120,10,15,0.9)] transition-transform hover:scale-[1.01] active:scale-[0.99]`,
  btnWhatsapp:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#cf1225] bg-transparent px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#cf1225] transition-colors hover:bg-[#cf1225] hover:text-[#f4f1ea]",
  btnNeutral:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#2b2a28]/30 bg-transparent px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2b2a28] transition-colors hover:border-[#2b2a28]",
  descriptionCard: "tp-sheet rounded-[4px] p-5 text-[15.5px] leading-relaxed text-[#2b2a28]/85 sm:p-6",
  card: "tp-sheet rounded-[4px] px-5 pt-5 pb-5 sm:px-7 sm:pt-6",
  cardTitle: (title) => (
    <h2 className="mb-4 text-center">
      <span className={`${TP_DISPLAY} tp-oval inline-block px-7 py-1.5 text-[24px] uppercase leading-[1.15] tracking-[0.03em] text-[#cf1225]`}>
        {title.replace(/\s*[⭐🔥]\s*$/u, "")}
      </span>
    </h2>
  ),
  link: "font-bold text-[#cf1225] underline decoration-[#cf1225]/35 underline-offset-4",
  text: "text-[#2b2a28]/85",
  textSoft: "text-[#2b2a28]/65",
  todayRow: "bg-[#cf1225] font-semibold text-[#f4f1ea]",
  row: "text-[#2b2a28]/75",
  closedText: "text-[#2b2a28]/40",
  faqOpen: "open:bg-[#cf1225]/[0.05]",
  faqChevron: "text-[#cf1225]",
  faqAnswer: "text-[#2b2a28]/75",
  seoText: "text-[#2b2a28]/55",
  signature: "text-[#2b2a28]/55",
  signatureLink: "font-bold text-[#cf1225] underline decoration-[#cf1225]/35 underline-offset-4",
  loading: "tp-sheet rounded-[4px] px-4 py-6 text-center text-sm text-[#2b2a28]/60",
  photoName: "text-[#2b2a28]",
  photoPrice: "font-semibold text-[#2b2a28]/70",
};

/** IGO: su hoja blanca con marco verde, el higo grabado y los títulos con las letras gordas. */
const IGO: LandingTheme = {
  root: IGO_ROOT_CLASS,
  Header: (p) => <IGOHeader {...p} />,
  cta: `${IGO_NAME} block min-h-12 rounded-full bg-[#0b652a] py-3.5 text-center text-[16px] font-medium uppercase tracking-[0.06em] text-[#f7f8f8] shadow-[0_14px_30px_-16px_rgba(11,101,42,0.9)] transition-transform hover:scale-[1.01] active:scale-[0.99]`,
  btnWhatsapp:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#0b652a] bg-transparent px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#0b652a] transition-colors hover:bg-[#0b652a] hover:text-[#f7f8f8]",
  btnNeutral:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#2b2b2b]/30 bg-transparent px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#2b2b2b] transition-colors hover:border-[#2b2b2b]",
  descriptionCard: "igo-sheet igo-frame rounded-[2px] p-5 text-[15.5px] leading-relaxed text-[#2b2b2b]/85 sm:p-6",
  card: "igo-sheet igo-frame rounded-[2px] px-5 pt-5 pb-5 sm:px-7 sm:pt-6",
  cardTitle: (title) => (
    <h2 className={`${IGO_DISPLAY} mb-4 block text-center text-[24px] uppercase leading-none text-[#0b652a]`}>
      {title.replace(/\s*[⭐🔥]\s*$/u, "")}
    </h2>
  ),
  link: "font-bold text-[#0b652a] underline decoration-[#0b652a]/35 underline-offset-4",
  text: "text-[#2b2b2b]/85",
  textSoft: "text-[#2b2b2b]/65",
  todayRow: "bg-[#0b652a] font-semibold text-[#f7f8f8]",
  row: "text-[#2b2b2b]/75",
  closedText: "text-[#2b2b2b]/40",
  faqOpen: "open:bg-[#0b652a]/[0.05]",
  faqChevron: "text-[#0b652a]",
  faqAnswer: "text-[#2b2b2b]/75",
  seoText: "text-[#2b2b2b]/55",
  signature: "text-[#2b2b2b]/55",
  signatureLink: "font-bold text-[#0b652a] underline decoration-[#0b652a]/35 underline-offset-4",
  loading: "igo-sheet igo-frame rounded-[2px] px-4 py-6 text-center text-sm text-[#2b2b2b]/60",
  photoName: "text-[#2b2b2b]",
  photoPrice: "font-semibold text-[#2b2b2b]/70",
};

export function landingThemeFor(skin: MenuSkinId | null): LandingTheme {
  if (skin === "igo") return IGO;
  if (skin === "tortasperras") return TORTASPERRAS;
  if (skin === "laspic") return LASPIC;
  if (skin === "mixteco") return MIXTECO;
  if (skin === "pecado") return PECADO;
  if (skin === "tercera") return TERCERA;
  if (skin === "negroblanco") return NEGROBLANCO;
  if (skin === "blooms") return BLOOMS;
  return DEFAULT;
}
