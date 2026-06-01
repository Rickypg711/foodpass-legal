import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { rootMetadata } from "@/lib/siteMetadata";
import { MetaPixelProvider } from "@/components/analytics/MetaPixelProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <MetaPixelProvider />
      </body>
    </html>
  );
}
