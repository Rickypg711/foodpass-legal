// /dev/piel/{skin} — vista previa LOCAL del menú con una piel, con datos de
// muestra (app/dev/piel/fixtures.ts). No existe en producción.
import { notFound } from "next/navigation";
import PielPreview from "./PielPreview";

export default async function PielPreviewPage({ params }: { params: Promise<{ skin: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { skin } = await params;
  return <PielPreview skin={skin} />;
}
