// /restaurantes — el directorio público (robo #9 a Biomenus, su "Bioniverse"):
// la base instalada como activo de adquisición. Cada local activo es una
// tarjeta hacia su página /r/{handle}, con schema ItemList para que Google
// entienda que esto es un directorio de restaurantes reales de Chihuahua.
//
// SERVER component: HTML completo para crawlers, cache 1h. El MAPA llega
// cuando existan direcciones reales + Places API (PENDIENTES.md) — un mapa
// con pines en Null Island es peor que no tener mapa.

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import { fetchDirectoryRestaurants } from "@/lib/server/restaurantDirectory";

export const metadata: Metadata = {
  title: "Restaurantes en Chihuahua con menú en línea y recompensas",
  description:
    "Descubre restaurantes locales de Chihuahua en Comeleal: mira su menú con fotos y precios, pide en línea o por WhatsApp, y junta puntos con cada compra.",
  alternates: { canonical: "/restaurantes" },
  openGraph: {
    title: `Restaurantes en Chihuahua | ${SITE_NAME}`,
    description:
      "Menús con fotos y precios, pedidos en línea y recompensas en tus lugares favoritos de Chihuahua.",
  },
};

export default async function RestaurantDirectoryPage() {
  const restaurants = await fetchDirectoryRestaurants();

  const itemListJsonLd =
    restaurants.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Restaurantes en Comeleal — Chihuahua",
          numberOfItems: restaurants.length,
          itemListElement: restaurants.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/r/${r.handle}`,
            name: r.name,
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

      <section className="px-5 pb-10 pt-14 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F28C38]">
          Directorio local
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          Restaurantes de Chihuahua en Comeleal
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#1C2526]/60">
          Menú con fotos y precios, pedidos en línea y puntos en cada compra.
          Toca un lugar para ver su carta.
        </p>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {restaurants.length === 0 ? (
            <p className="col-span-full text-center text-[14px] text-[#1C2526]/50">
              No pudimos cargar el directorio — intenta de nuevo en un momento.
            </p>
          ) : (
            restaurants.map((r) => (
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
                  <p className="text-[16px] font-bold group-hover:text-[#B05E14]">
                    {r.name}
                  </p>
                  {r.categories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.categories.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize text-[#B05E14]"
                          style={{ background: "rgba(242,140,56,0.1)" }}
                        >
                          {c.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.description ? (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#1C2526]/60">
                      {r.description}
                    </p>
                  ) : null}
                  {r.address ? (
                    <p className="mt-2 text-[12px] text-[#1C2526]/45">📍 {r.address}</p>
                  ) : null}
                  <p className="mt-3 text-[13px] font-bold text-[#F28C38]">
                    Ver menú y premios →
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
