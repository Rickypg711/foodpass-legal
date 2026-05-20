import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: "Menú",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `Menú | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    title: `Menú | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
