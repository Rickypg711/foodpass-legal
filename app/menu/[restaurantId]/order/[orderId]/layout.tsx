import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: "Pedido",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `Pedido | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    title: `Pedido | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
