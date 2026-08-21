import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerticalLanding } from "@/components/marketing/VerticalLanding";
import { VERTICALES, verticalBySlug } from "@/lib/marketing/verticals";

/** Estáticas en build: son páginas SEO, no hay razón para renderizarlas por request. */
export function generateStaticParams() {
  return VERTICALES.map((v) => ({ vertical: v.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}): Promise<Metadata> {
  const { vertical } = await params;
  const v = verticalBySlug(vertical);
  if (!v) return {};
  return {
    title: v.title,
    description: v.description,
    alternates: { canonical: `/software-para-restaurantes/${v.slug}` },
    openGraph: {
      title: v.title,
      description: v.description,
      locale: "es_MX",
      type: "website",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const v = verticalBySlug(vertical);
  if (!v) notFound();
  return <VerticalLanding v={v} />;
}
