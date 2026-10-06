// 404 de todo el sitio. Antes no existía: Next mostraba su página en inglés
// ("This page could not be found"). Llega aquí cuando /r o /menu apuntan a un
// restaurante que no existe (6-oct-2026) o a cualquier ruta inventada.
import Link from "next/link";

export const metadata = {
  title: "No encontramos esta página | Comeleal",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] px-6 text-center text-[#1C2526]">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#1C2526]/60">
        Error 404
      </p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
        No encontramos esta página
      </h1>
      <p className="mt-3 max-w-md text-base text-[#1C2526]/80">
        Puede que el link esté mal escrito o que el negocio ya no esté en
        Comeleal. Si venías de un QR, pide al local el link actualizado.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-[#F28C38] px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
