"use client";

// /dev/piel/{skin}/flujo — vista previa LOCAL de la ropa del flujo de pago (encabezado, tarjeta, campos, opciones,
// botón) con la piel. El checkout de verdad necesita el doc del local en Firestore; esto no. No existe en producción.
import { flowThemeFor } from "@/components/menu/skins/flowTheme";
import { pielFixture } from "../../fixtures";
import { PreviewTag } from "../PielPreview";

export default function FlujoPreview({ skin }: { skin: string }) {
  const fx = pielFixture(skin);
  if (!fx) return <p className="p-8 text-sm">No hay vista previa para la piel &quot;{skin}&quot;.</p>;
  const th = flowThemeFor(fx.initial.raw);
  const name = typeof fx.initial.raw.name === "string" ? fx.initial.raw.name : "";
  return (
    <div className={th.root} style={th.rootStyle}>
      <PreviewTag />
      {th.Header({ restaurantId: fx.id, restaurantName: name, title: "Confirmar pedido", subtitle: `${name} · Recoger en local`, back: true, page: "checkout" })}
      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        <section className={th.card}>
          <p className={th.cartTitle}>Tu pedido</p>
          <div className={th.cartLine}>
            <div>
              <p className={th.cartName}>Nieve chica</p>
              <p className={th.cartOptions}>Sabor: Queso con fresa</p>
            </div>
            <p className={th.cartSubtotal}>$35</p>
          </div>
          <div className={th.cartLine}>
            <div>
              <p className={th.cartName}>Agua grande</p>
              <p className={th.cartOptions}>Sabor: Horchata</p>
            </div>
            <p className={th.cartSubtotal}>$50</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={th.cartTotalLabel}>Total</span>
            <span className={th.cartTotal}>$85</span>
          </div>
        </section>
        <section className={th.card}>
          <label className={th.label}>
            Tu nombre <span className={th.accent}>*</span>
            <input className={th.input} placeholder="¿A nombre de quién?" />
          </label>
          <label className={`${th.label} mt-4 block`}>
            Tu WhatsApp <span className={th.accent}>*</span>
            <input className={th.input} placeholder="614 000 0000" />
          </label>
        </section>
        <section className={`${th.card} space-y-2`}>
          <p className={th.label}>¿Cómo pagas?</p>
          <button type="button" className={`${th.option(true)} block w-full text-left`}>Efectivo al recoger</button>
          <button type="button" className={`${th.option(false)} block w-full text-left`}>Transferencia</button>
        </section>
        <button type="button" className={th.cta}>Mandar pedido por WhatsApp</button>
      </main>
    </div>
  );
}
