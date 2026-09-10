/**
 * Pie del menú público (10-sep-2026): "Hecho con Comeleal · ¿Tienes un
 * restaurante? Crea tu menú gratis". Robado de MenuBot: cada menú que un
 * comensal abre es un anuncio para el dueño de al lado. Discreto: una línea
 * chica al final, nunca compite con el menú ni con el carrito.
 *
 * El link va al demo (la misma puerta del prospecto solo) con utm para saber
 * cuántos dueños llegan por aquí. Piel de siempre y piel Tercera.
 */
import Link from "next/link";
import type { MenuSkinId } from "@/lib/menu/menuSkin";

export const POWERED_BY_HREF =
  "/demo?utm_source=menu&utm_medium=footer&utm_campaign=hecho_con_comeleal";

export function MenuPoweredByFooter({ skin = null }: { skin?: MenuSkinId | null }) {
  const tercera = skin === "tercera";
  return (
    <footer
      className={
        "mt-12 border-t pt-5 text-center text-[12px] leading-relaxed " +
        (tercera
          ? "border-dotted border-[#1a1a1a]/40 text-[#1a1a1a]/70"
          : "border-[#1C2526]/10 text-[#1C2526]/55")
      }
    >
      <p>
        Hecho con{" "}
        <span className={tercera ? "font-bold text-[#1a1a1a]" : "font-semibold text-[#1C2526]/75"}>Comeleal</span>
      </p>
      <p className="mt-1">
        ¿Tienes un restaurante?{" "}
        <Link
          href={POWERED_BY_HREF}
          className={
            "font-semibold underline underline-offset-4 " +
            (tercera ? "text-[#e74b34] decoration-dotted" : "text-[#F28C38] decoration-[#F28C38]/40 hover:decoration-[#F28C38]")
          }
        >
          Crea tu menú gratis →
        </Link>
      </p>
    </footer>
  );
}
