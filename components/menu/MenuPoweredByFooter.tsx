/**
 * Pie del menú público (10-sep-2026): "Hecho con Comeleal · ¿Tienes un
 * restaurante? Crea tu menú gratis". Robado de MenuBot: cada menú que un
 * comensal abre es un anuncio para el dueño de al lado. Discreto: una línea
 * chica al final, nunca compite con el menú ni con el carrito.
 *
 * El link va al demo (la misma puerta del prospecto solo) con utm para saber
 * cuántos dueños llegan por aquí. Piel de siempre y piel Tercera.
 *
 * utm_content = el local que abrió el comensal (slug o id de la URL), robado
 * del "Powered by Last" de last.shop (utm_adname=Pizza Radical, 10-sep-2026):
 * así sabemos QUÉ menú nos trajo a cada dueño, no solo cuántos. El formulario
 * del prospecto ya guarda utm_content (parseUtmsFromSearch).
 */
import Link from "next/link";
import type { MenuSkinId } from "@/lib/menu/menuSkin";

export const POWERED_BY_HREF =
  "/demo?utm_source=menu&utm_medium=footer&utm_campaign=hecho_con_comeleal";

/** Link del pie con el local que lo mostró; sin local, el link de siempre. */
export function poweredByHref(restaurantId?: string | null): string {
  const id = (restaurantId ?? "").trim().slice(0, 80);
  return id ? `${POWERED_BY_HREF}&utm_content=${encodeURIComponent(id)}` : POWERED_BY_HREF;
}

export function MenuPoweredByFooter({
  skin = null,
  restaurantId = null,
}: {
  skin?: MenuSkinId | null;
  restaurantId?: string | null;
}) {
  const tercera = skin === "tercera";
  const pecado = skin === "pecado";
  const href = poweredByHref(restaurantId);
  return (
    <footer
      className={
        "mt-12 border-t pt-5 text-center text-[12px] leading-relaxed " +
        (tercera
          ? "border-dotted border-[#1a1a1a]/40 text-[#1a1a1a]/70"
          : pecado
            ? "border-[#ffeecf]/35 text-[#ffeecf]/85"
            : "border-[#1C2526]/10 text-[#1C2526]/55")
      }
    >
      <p>
        Hecho con{" "}
        <span className={tercera ? "font-bold text-[#1a1a1a]" : pecado ? "font-bold text-[#ffeecf]" : "font-semibold text-[#1C2526]/75"}>Comeleal</span>
      </p>
      <p className="mt-1">
        ¿Tienes un restaurante?{" "}
        <Link
          href={href}
          className={
            "font-semibold underline underline-offset-4 " +
            (tercera
              ? "text-[#e74b34] decoration-dotted"
              : pecado
                ? "text-[#fbaa19] decoration-[#fbaa19]/50 hover:decoration-[#fbaa19]"
                : "text-[#F28C38] decoration-[#F28C38]/40 hover:decoration-[#F28C38]")
          }
        >
          Crea tu menú gratis →
        </Link>
      </p>
    </footer>
  );
}
