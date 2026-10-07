// /dev/activacion?rid=… — vista previa LOCAL de la tarjeta "Para que te
// pidan" (activación en tres toques, 6-oct-2026) con un restaurante real de
// pruebas, sin sesión de dueño. No existe en producción.
import { notFound } from "next/navigation";
import { ActivationCard } from "@/components/vendor/ActivationCard";

const DEFAULT_RID = "kdjJsNwriU4AL4528a4d"; // Luzz Pizza, el local de pruebas de Ricardo

export default async function ActivacionPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp: Record<string, string | string[] | undefined> = await (searchParams ?? Promise.resolve({}));
  const rid = typeof sp.rid === "string" && sp.rid ? sp.rid : DEFAULT_RID;
  const variant = sp.v === "done" ? "done" : "panel";
  return (
    <div className="min-h-screen bg-[#FAF9F5] px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <ActivationCard restaurantId={rid} variant={variant} />
      </div>
    </div>
  );
}
