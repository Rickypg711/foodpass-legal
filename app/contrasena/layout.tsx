import type { Metadata } from "next";

// Página a la que llegan los links de correo de Firebase (contraseña nueva,
// verificar correo, recuperar correo) — "Customize action URL" en la consola
// apunta aquí desde el 18-sep-2026. Es de un solo uso por link: jamás se indexa.
export const metadata: Metadata = {
  title: { absolute: "Tu contraseña | Comeleal" },
  robots: { index: false, follow: false },
};

export default function ContrasenaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
