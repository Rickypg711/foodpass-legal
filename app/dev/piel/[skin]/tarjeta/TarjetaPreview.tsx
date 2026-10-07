"use client";

// /dev/piel/{skin}/tarjeta — vista previa LOCAL de la tarjeta de "Compartir menú" del panel con la piel, y la
// imagen PNG que sale al compartir/imprimir (html-to-image, igual que MenuShareModal). No existe en producción.
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { ManantialShareCard, ManantialTableCard } from "@/components/menu/skins/manantial";
import { SKIN_QR_INK, SkinShareCard, SkinTableCard } from "@/components/menu/skins/SkinShareCard";
import { menuSkinFromRestaurant } from "@/lib/menu/menuSkin";

const NAMES: Record<string, string> = {
  tercera: "Café de la Tercera", pecado: "Pecado Escondido", negroblanco: "Negro Blanco Café", blooms: "Blooms",
  mixteco: "Mixteco", laspic: "LasPic", tortasperras: "Pinches Tortas Perras", igo: "IGO Pizzeria", omu: "Omu Balls & Sushi",
  fresheria: "La Fresheria", kame: "Kame House", suadero: "Tacos de Suadero La Familia",
};

export default function TarjetaPreview({ skin }: { skin: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState<string | null>(null);
  const id = menuSkinFromRestaurant({ menuSkin: skin });
  if (!id) return <p className="p-8 text-sm">No existe la piel &quot;{skin}&quot;.</p>;
  const qr = <QRCodeSVG value="https://comeleal.com/menu/preview" size={176} fgColor={SKIN_QR_INK[id] ?? "#1C2526"} bgColor="#FFFFFF" />;
  return (
    <div className="flex min-h-screen flex-wrap items-start justify-center gap-8 bg-neutral-100 p-6">
      <div className="w-[340px]">
        <div ref={ref}>
          {id === "manantial" ? (
            <ManantialShareCard name="El Manantial" hasRewards={false} linkText="comeleal.com/menu/el-manantial" qr={qr} />
          ) : (
            <SkinShareCard skin={id} name={NAMES[id] ?? "Mi local"} logoUrl={null} hasRewards={false} linkText={`comeleal.com/menu/${id}`} qr={qr} />
          )}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white"
          onClick={async () => ref.current && setPng(await toPng(ref.current, { pixelRatio: 3, cacheBust: true }))}
        >
          Generar PNG
        </button>
      </div>
      <div className="grid w-[420px] grid-cols-2 gap-4">
        {["Mesa 1", "Mesa 2"].map((m) => {
          const tq = <QRCodeSVG value="https://comeleal.com/menu/preview?mesa=1" size={132} fgColor={SKIN_QR_INK[id] ?? "#1C2526"} bgColor="#FFFFFF" />;
          return id === "manantial" ? (
            <ManantialTableCard key={m} name="El Manantial" mesa={m} qr={tq} loyaltyLive={false} />
          ) : (
            <SkinTableCard key={m} skin={id} name={NAMES[id] ?? "Mi local"} mesa={m} qr={tq} loyaltyLive={false} />
          );
        })}
      </div>
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="PNG de la tarjeta" className="w-[340px] rounded-xl border border-neutral-300" />
      ) : null}
    </div>
  );
}
