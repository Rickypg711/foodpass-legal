"use client";

/**
 * Tarjeta de "Compartir menú" con la ropa de la piel del local (7-oct-2026, Ricardo: "lo mismo para todos los
 * menús premium"). Es lo que se comparte como imagen y lo que se imprime desde el panel.
 *
 * CÓMO ESCALA: no se dibuja una tarjeta por piel. Cada piel ya trae su portada (el `Header` de su LandingTheme,
 * el mismo de su página /r) y sus tarjetas (`card`, `cardTitle`, `text`). Aquí se arma: su portada arriba y abajo
 * una tarjeta suya con "Escanea y pide", el QR en la tinta de la piel y el link. Piel nueva con LandingTheme =
 * tarjeta gratis. El Manantial tiene la suya a mano (ManantialShareCard) y no pasa por aquí.
 *
 * Regla de promesas: la línea de puntos solo sale si el local tiene premios (`hasRewards`), igual que el menú.
 */
import type { ReactNode } from "react";
import type { MenuSkinId } from "@/lib/menu/menuSkin";
import { landingThemeFor } from "@/components/menu/skins/landingTheme";

/** Tinta del QR por piel: el color oscuro de su papel (tiene que leerse con la cámara sobre blanco). */
export const SKIN_QR_INK: Partial<Record<MenuSkinId, string>> = {
  pecado: "#8f151a",
  tercera: "#1a1a1a",
  negroblanco: "#0b0b0b",
  blooms: "#6d2f47",
  mixteco: "#234933",
  laspic: "#141414",
  tortasperras: "#8f0d19",
  igo: "#0b652a",
  omu: "#151311",
  fresheria: "#56052d",
  kame: "#263532",
  suadero: "#612f18",
  manantial: "#3d2a6e",
};

export function SkinShareCard({
  skin,
  name,
  logoUrl,
  tagline = null,
  qr,
  linkText,
  hasRewards,
}: {
  skin: MenuSkinId;
  name: string;
  logoUrl: string | null;
  tagline?: string | null;
  qr: ReactNode;
  linkText: string;
  hasRewards: boolean;
}) {
  const t = landingThemeFor(skin);
  return (
    <div
      className={`${t.root} overflow-hidden rounded-[20px] text-center`}
      // La raíz de cada piel es de página completa (min-h-screen, fondo fijo): aquí es una tarjeta.
      // translateZ(0): lo `position: fixed` de una piel (el filo rosa de Blooms) queda DENTRO de la tarjeta y no
      // se pinta en la orilla del panel.
      style={{ minHeight: 0, backgroundAttachment: "scroll", transform: "translateZ(0)" }}
    >
      {t.Header ? (
        <div className="pointer-events-none">
          {t.Header({ loading: false, restaurantName: name, logoUrl, tagline, schedule: null, address: null, secondarySubtitle: null })}
        </div>
      ) : null}
      <div className="px-4 pb-5 pt-4">
        <div className={t.card}>
          {t.cardTitle("Escanea y pide")}
          <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.6)]">{qr}</div>
          <p className={`mt-3 text-[13.5px] font-bold tabular-nums ${t.text}`}>{linkText}</p>
          {hasRewards ? <p className={`mt-1.5 text-[12px] font-semibold leading-4 ${t.textSoft}`}>Con cada compra juntas puntos. Da tu número al pagar.</p> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta de MESA con la ropa de la piel (7-oct-2026, Ricardo: "esto también premium"). Va dos por hoja y se
 * recorta, así que no lleva la portada completa: el papel de la piel, el nombre del local en el título de sus
 * tarjetas, "Mesa N" grande, el QR en su tinta y "Escanea y ordena". Los locales SIN piel siguen con la tarjeta de
 * siempre (ya está pegada en mesas reales).
 */
export function SkinTableCard({
  skin,
  name,
  mesa,
  qr,
  loyaltyLive,
}: {
  skin: MenuSkinId;
  name: string;
  mesa: string;
  qr: ReactNode;
  loyaltyLive: boolean;
}) {
  const t = landingThemeFor(skin);
  return (
    <div className={`${t.root} h-full overflow-hidden rounded-2xl p-2.5`} style={{ minHeight: 0, backgroundAttachment: "scroll", transform: "translateZ(0)" }}>
      <div className={`${t.card} flex h-full flex-col items-center text-center`}>
        {/* El letrero de la piel lleva "Mesa N" (corto, siempre cabe); el nombre del local va chico arriba, como en
            la tarjeta de siempre. Con el nombre en el letrero, "Tacos de Suadero La Familia" salía en 5 renglones. */}
        <p className={`mb-1.5 w-full truncate text-[11px] font-bold uppercase tracking-widest ${t.textSoft}`}>{name}</p>
        {/* El título de algunas pieles se sale del plato con margen negativo (Suadero -mt-9): aquí se neutraliza
            para que no tape el nombre, y "Mesa 1" no se parte. */}
        <div className="[&>*]:mt-0! [&>*]:mb-2! [&>*]:whitespace-nowrap [&_*]:whitespace-nowrap">{t.cardTitle(mesa)}</div>
        <div className="mt-1 rounded-xl bg-white p-2 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.6)]">{qr}</div>
        <p className={`mt-3 text-[13px] font-black ${t.link.replace(/underline\S*|decoration-\S+/g, "")}`}>Escanea y ordena</p>
        <p className={`mt-0.5 text-[11px] leading-snug ${t.textSoft}`}>{loyaltyLive ? "Pide desde tu teléfono y acumula puntos" : "Pide desde tu teléfono"}</p>
      </div>
    </div>
  );
}
