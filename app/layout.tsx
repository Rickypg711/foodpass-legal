import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { rootMetadata } from "@/lib/siteMetadata";
import { MetaPixelProvider } from "@/components/analytics/MetaPixelProvider";
import { AttributionCapture } from "@/components/analytics/AttributionCapture";
import { InternalBrowserMarker } from "@/components/analytics/InternalBrowserMarker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// La ÚNICA serif del producto (Opción A del panel, 23-sep-2026): nombre del
// local y títulos de sección. Misma familia que la app (GoogleFonts.lora).
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["600"],
});

export const metadata: Metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} antialiased`}
      >
        {children}
        <MetaPixelProvider />
        <AttributionCapture />
        <InternalBrowserMarker />
      </body>
    </html>
  );
}
