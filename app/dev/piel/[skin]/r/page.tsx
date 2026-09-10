// /dev/piel/{skin}/r — vista previa LOCAL de la portada (/r) con una piel.
// No existe en producción.
import { notFound } from "next/navigation";
import LandingView from "@/app/r/[restaurantId]/LandingView";
import { pielFixture } from "../../fixtures";
import { PreviewTag } from "../PielPreview";

export default async function PielLandingPreviewPage({ params }: { params: Promise<{ skin: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { skin } = await params;
  const fx = pielFixture(skin);
  if (!fx) notFound();
  return (
    <>
      <PreviewTag />
      <LandingView
        restaurantId={fx.id}
        initial={{ raw: fx.initial.raw, menuPhotos: [], menuPhotosArePopular: false }}
      />
    </>
  );
}
