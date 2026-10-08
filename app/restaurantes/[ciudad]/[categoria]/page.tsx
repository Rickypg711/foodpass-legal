// /restaurantes/{ciudad}/{categoria} — ej. /restaurantes/chihuahua/tacos.
// Robo #10 a Owner (sus /tags/birria), en versión honesta: "Tacos en
// Chihuahua", sin "los mejores" ni "cerca de mí". Solo locales activos con
// menú real, y la página solo existe con 2 o más (si no, 404: nada de
// páginas flacas). No promete puntos: hay locales con premios apagados.
//
// SERVER component con ISR de 1 hora, igual que el directorio.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import { buildCategoryCityTitle, categoryHeading } from "@/lib/landingContent";
import { fetchCategoryCityPage, fetchCategoryCityPages } from "../../_lib/categoryPages";

export const revalidate = 3600;

type Params = Promise<{ ciudad: string; categoria: string }>;

export async function generateStaticParams() {
  const pages = await fetchCategoryCityPages();
  return pages.map((p) => ({ ciudad: p.citySlug, categoria: p.categorySlug }));
}

function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ciudad, categoria } = await params;
  const page = await fetchCategoryCityPage(ciudad, categoria);
  if (!page) return { title: "Restaurantes", robots: { index: false } };
  const title = buildCategoryCityTitle(page.category, page.city);
  const names = page.restaurants.slice(0, 3).map((r) => r.name);
  const description =
    `${categoryHeading(page.category)} en ${page.city} con menú en línea: ${namesList(names)}. ` +
    `Mira precios y horario, y haz tu pedido directo al restaurante.`;
  return {
    title,
    description,
    alternates: { canonical: `/restaurantes/${page.citySlug}/${page.categorySlug}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description },
    twitter: { title: `${title} | ${SITE_NAME}`, description },
  };
}

export default async function CategoryCityPage({ params }: { params: Params }) {
  const { ciudad, categoria } = await params;
  const page = await fetchCategoryCityPage(ciudad, categoria);
  if (!page) notFound();

  const heading = `${categoryHeading(page.category)} en ${page.city}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: heading,
    numberOfItems: page.restaurants.length,
    itemListElement: page.restaurants.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/r/${r.handle}`,
      name: r.name,
    })),
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <section className="px-5 pb-10 pt-14 text-center">
        <p className="text-[12px] font-semibold text-[#1C2526]/50">
          <Link href="/restaurantes" className="hover:text-[#B05E14]">
            Restaurantes
          </Link>
          {" / "}
          {page.city}
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {heading}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#1C2526]/60">
          {page.restaurants.length} lugares con su menú en Comeleal. Toca uno para ver
          precios, horario y pedir directo al restaurante.
        </p>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {page.restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/r/${r.handle}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
              style={{ border: "1px solid rgba(28,37,38,0.07)" }}
            >
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.imageUrl}
                  alt={`Foto de ${r.name}`}
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-36 w-full items-center justify-center text-4xl"
                  style={{ background: "rgba(242,140,56,0.08)" }}
                >
                  🍽️
                </div>
              )}
              <div className="p-4">
                <p className="text-[16px] font-bold group-hover:text-[#B05E14]">{r.name}</p>
                {r.description ? (
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#1C2526]/60">
                    {r.description}
                  </p>
                ) : null}
                {r.address ? (
                  <p className="mt-2 text-[12px] text-[#1C2526]/45">📍 {r.address}</p>
                ) : null}
                <p className="mt-2 text-[12px] text-[#1C2526]/45">
                  {r.menuItemCount === 1 ? "1 platillo" : `${r.menuItemCount} platillos`} en su menú
                </p>
                <p className="mt-3 text-[13px] font-bold text-[#F28C38]">Ver menú →</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-center text-[13px]">
          <Link href="/restaurantes" className="font-semibold text-[#B05E14] hover:underline">
            Ver todos los restaurantes
          </Link>
        </p>
      </section>
    </div>
  );
}
