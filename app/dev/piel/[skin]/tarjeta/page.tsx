// /dev/piel/{skin}/tarjeta — vista previa LOCAL de la tarjeta de compartir con la piel. No existe en producción.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import TarjetaPreview from "./TarjetaPreview";

export default async function PielTarjetaPreviewPage({ params }: { params: Promise<{ skin: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { skin } = await params;
  return (
    <Suspense>
      <TarjetaPreview skin={skin} />
    </Suspense>
  );
}
