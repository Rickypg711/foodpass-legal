"use client";

// /dev/piel/{skin}/tarjeta — vista previa LOCAL de la tarjeta de "Compartir menú" del panel con la piel, y la
// imagen PNG que sale al compartir/imprimir (html-to-image, igual que MenuShareModal). No existe en producción.
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { ManantialShareCard } from "@/components/menu/skins/manantial";

export default function TarjetaPreview({ skin }: { skin: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState<string | null>(null);
  if (skin !== "manantial") return <p className="p-8 text-sm">Esta piel no trae tarjeta propia.</p>;
  return (
    <div className="flex min-h-screen flex-wrap items-start justify-center gap-8 bg-neutral-100 p-6">
      <div className="w-[340px]">
        <div ref={ref}>
          <ManantialShareCard
            name="El Manantial"
            hasRewards={false}
            linkText="comeleal.com/menu/el-manantial"
            qr={<QRCodeSVG value="https://comeleal.com/menu/EAaj6MyzncMUNTNQVDQy" size={176} fgColor="#3d2a6e" bgColor="#FFFFFF" />}
          />
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white"
          onClick={async () => ref.current && setPng(await toPng(ref.current, { pixelRatio: 3, cacheBust: true }))}
        >
          Generar PNG
        </button>
      </div>
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="PNG de la tarjeta" className="w-[340px] rounded-xl border border-neutral-300" />
      ) : null}
    </div>
  );
}
