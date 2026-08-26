import type { Metadata } from "next";

// El demo es privado del prospecto (§6.7): jamás indexable, jamás
// compartible como menú real. El link real (post-claim) es el que se indexa.
export const metadata: Metadata = {
  title: "Tu menú digital — vista previa | Comeleal",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
