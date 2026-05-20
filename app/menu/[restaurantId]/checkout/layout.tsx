import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: "Checkout",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `Checkout | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    title: `Checkout | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
