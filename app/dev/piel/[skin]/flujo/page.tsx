// /dev/piel/{skin}/flujo — vista previa LOCAL del flujo de pago con una piel. No existe en producción.
import { notFound } from "next/navigation";
import FlujoPreview from "./FlujoPreview";

export default async function PielFlujoPreviewPage({ params }: { params: Promise<{ skin: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { skin } = await params;
  return <FlujoPreview skin={skin} />;
}
