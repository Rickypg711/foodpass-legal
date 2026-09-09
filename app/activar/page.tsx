import Link from "next/link";
import Image from "next/image";
import { ActivarModal } from "@/components/home/ActivarModal";

export default async function ActivarPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  // ?modo=entrar: quien llega por "Entrar", por el rebote de /vendor sin
  // sesión o por "Cerrar sesión" YA tiene cuenta → formulario en iniciar sesión.
  const { modo } = await searchParams;
  const initialMode = modo === "entrar" ? "signin" : "signup";
  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Minimal nav */}
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/comeleal-app-icon.png"
              alt="Comeleal"
              width={32}
              height={32}
              className="h-8 w-8 rounded-[8px] ring-1 ring-white/15"
            />
            <span className="text-base font-bold text-white">Comeleal</span>
          </Link>
          <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Inline (non-modal) signup flow */}
      <main className="px-4 py-12">
        <ActivarModal asModal={false} initialMode={initialMode} />
      </main>
    </div>
  );
}
