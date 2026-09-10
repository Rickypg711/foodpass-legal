"use client";

// Vista de la landing /r/{id}. El fetch normal ocurre en el SERVIDOR
// (page.tsx) y llega por props → el HTML inicial ya trae todo el contenido
// (crawlers de IA sin JS lo leen completo). Si el server no pudo (error de
// red), `initial` viene null y esta vista hace el fetch client-side de
// respaldo (mismo camino que /menu).
//
// Lo ÚNICO que se calcula client-side siempre: el chip abierto/cerrado y el
// resaltado de "hoy" — dependen de la hora LOCAL del visitante (el server
// corre en UTC; evaluarlo ahí mentiría ~6 horas al día).

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { brandThemeFromRestaurant, taglineFromRestaurant, inkAlpha } from "@/lib/brand/brandColor";
import { collection, getDocs } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { RewardLadder, hasRewardLadder } from "@/components/loyalty/RewardLadder";
import {
  trackWebLandingMenuClick,
  trackWebLandingView,
  trackWebLandingWhatsappClick,
} from "@/lib/analytics";
import { getFirebaseDb } from "@/lib/firebase";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { formatPrice } from "@/lib/priceFormat";
import { getRestaurantSnapOnce } from "@/lib/restaurantDocCache";
import { getRestaurantBannerUrl, getRestaurantImageUrl } from "@/lib/restaurantImage";
import {
  scheduleStatus,
  weeklySchedule,
  type ScheduleStatus,
} from "@/lib/schedule";
import { buildFaq, buildSeoParagraph, cityForRestaurant, seoCategories } from "@/lib/landingContent";
import { parseRewardTiers } from "@/lib/loyalty/rewardCatalog";
import { earnPolicyFromRestaurant, earnRuleLine } from "@/lib/loyalty/earnPolicy";
import { phoneCountryOf } from "@/lib/phone/phoneCountry";
import { menuSkinFromRestaurant } from "@/lib/menu/menuSkin";
import { landingThemeFor, type LandingTheme } from "@/components/menu/skins/landingTheme";

export type LandingMenuPhoto = {
  name: string;
  price: number;
  imageUrl: string;
};

export type LandingInitialData = {
  /** Doc del restaurante ya decodificado a JS plano (server-side). */
  raw: Record<string, unknown>;
  menuPhotos: LandingMenuPhoto[];
  /** true cuando menuPhotos viene ordenado por ventas reales (orderCount). */
  menuPhotosArePopular: boolean;
};

type LandingRestaurant = {
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  categories: string[];
  firstVisitReward: string | null;
  /** Historia del restaurante (campo opcional `story` — patrón "Our Story"
   *  de Owner/Metro Pizza). Null cuando el dueño no la ha escrito. */
  story: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function mapRestaurant(data: Record<string, unknown>): LandingRestaurant {
  const fpr = data.firstPurchaseReward;
  let firstVisitReward: string | null = null;
  if (fpr && typeof fpr === "object") {
    const m = fpr as Record<string, unknown>;
    if (m.enabled === true) {
      firstVisitReward = str(m.menuItemName) ?? str(m.description);
    }
  }
  // Sin comodines ("Otro"): ni en chips, ni en FAQ, ni en el párrafo SEO.
  const categories = seoCategories(
    Array.isArray(data.categories)
      ? (data.categories as unknown[]).map((c) => (typeof c === "string" ? c.trim() : ""))
      : [],
  );
  return {
    name: str(data.name) ?? "Restaurante",
    description: str(data.description),
    logoUrl: getRestaurantImageUrl(data),
    bannerUrl: getRestaurantBannerUrl(data),
    address: str(data.address),
    phone: str(data.phone),
    whatsapp: str(data.whatsapp),
    categories,
    firstVisitReward,
    story: str(data.story),
  };
}

/** Hasta 6 platillos CON foto para el carrusel (camino client de respaldo).
 *  Con datos de ventas (orderCount) → "Los más pedidos"; sin datos → nombre. */
function mapMenuPhotos(
  docs: { data: Record<string, unknown> }[],
): { photos: LandingMenuPhoto[]; popular: boolean } {
  const out: (LandingMenuPhoto & { orderCount: number })[] = [];
  for (const d of docs) {
    const available =
      typeof d.data.isAvailable === "boolean" ? d.data.isAvailable : true;
    const imageUrl = str(d.data.imageUrl);
    const name = str(d.data.name);
    if (!available || !imageUrl || !name) continue;
    const priceRaw = d.data.price;
    const price =
      typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string"
          ? parseFloat(priceRaw)
          : NaN;
    out.push({
      name,
      price: Number.isFinite(price) ? price : 0,
      imageUrl,
      orderCount: typeof d.data.orderCount === "number" ? d.data.orderCount : 0,
    });
  }
  const popular = out.some((i) => i.orderCount > 0);
  out.sort((a, b) =>
    popular ? b.orderCount - a.orderCount : a.name.localeCompare(b.name, "es"),
  );
  return {
    photos: out.slice(0, 6).map(({ name, price, imageUrl }) => ({ name, price, imageUrl })),
    popular,
  };
}

function ScheduleChip({ schedule }: { schedule: ScheduleStatus }) {
  return (
    <p
      className={
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold " +
        (schedule.open
          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
          : "border-red-400/40 bg-red-400/15 text-red-300")
      }
    >
      {schedule.open ? "🟢" : "🔴"} {schedule.label}
    </p>
  );
}

function SectionCard({
  title,
  theme,
  children,
}: {
  title: string;
  theme: LandingTheme;
  children: React.ReactNode;
}) {
  return (
    <section className={theme.card}>
      {theme.cardTitle(title)}
      {children}
    </section>
  );
}

export default function LandingView({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: LandingInitialData | null;
}) {
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(
    initial?.raw ?? null,
  );
  const [menuPhotos, setMenuPhotos] = useState<LandingMenuPhoto[]>(
    initial?.menuPhotos ?? [],
  );
  const [menuPhotosArePopular, setMenuPhotosArePopular] = useState(
    initial?.menuPhotosArePopular ?? false,
  );
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);

  // Hora LOCAL del visitante — solo después de montar (SSR corre en UTC y
  // renderizar "abierto/cerrado" o "hoy" ahí daría datos falsos + mismatch).
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [todayIdx, setTodayIdx] = useState<number | null>(null);
  useEffect(() => {
    if (!rdata) return;
    setSchedule(scheduleStatus(rdata));
    setTodayIdx((new Date().getDay() + 6) % 7);
  }, [rdata]);

  // Refresh vivo del doc aunque el server SÍ entregó datos: el SSR se cachea
  // (revalidate 300) y el chip abierto/cerrado no puede mentir 5 minutos —
  // p. ej. el dueño acaba de tocar "Cerrar por hoy" (manualCloseUntil). El
  // contenido SSR queda para SEO/primer paint; esto solo corrige lo vivo.
  useEffect(() => {
    if (initial === null || !restaurantId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getRestaurantSnapOnce(restaurantId);
        if (!cancelled && snap.exists()) {
          setRdata(snap.data() as Record<string, unknown>);
        }
      } catch {
        // sin red o sin permiso: nos quedamos con el SSR (mejor que nada)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, restaurantId]);

  // Respaldo client-side cuando el server no entregó datos.
  useEffect(() => {
    if (initial !== null) return;
    if (!restaurantId) {
      setError("Falta el id del restaurante");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirebaseDb();
        const rSnap = await getRestaurantSnapOnce(restaurantId);
        if (cancelled) return;
        if (!rSnap.exists()) {
          // Mismo rescate que /menu: ids con mayúsculas/minúsculas distintas.
          const allSnap = await getDocs(collection(db, "restaurants"));
          const wanted = restaurantId.toLowerCase();
          const match = allSnap.docs.find((d) => {
            if (d.id.toLowerCase() === wanted) return true;
            const s = (d.data() as Record<string, unknown>).slug;
            return typeof s === "string" && s.trim().toLowerCase() === wanted;
          });
          if (match) {
            window.location.replace(`/r/${match.id}`);
            return;
          }
          setError("No encontramos este restaurante");
          setLoading(false);
          return;
        }

        setRdata(rSnap.data() as Record<string, unknown>);

        try {
          const menuSnap = await getDocs(
            collection(db, "restaurants", restaurantId, "menu"),
          );
          if (!cancelled) {
            const { photos, popular } = mapMenuPhotos(
              menuSnap.docs.map((d) => ({
                data: d.data() as Record<string, unknown>,
              })),
            );
            setMenuPhotos(photos);
            setMenuPhotosArePopular(popular);
          }
        } catch {
          /* opcional */
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error al cargar la página");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial, restaurantId]);

  const restaurant = useMemo(() => (rdata ? mapRestaurant(rdata) : null), [rdata]);
  const weekly = useMemo(() => (rdata ? weeklySchedule(rdata) : null), [rdata]);

  const name = restaurant?.name ?? "";

  // FAQ + párrafo SEO con los MISMOS datos que el schema del layout.
  const faq = useMemo(() => {
    if (!restaurant || !rdata) return [];
    return buildFaq({
      loyaltyLive: restaurantPromisesPoints(rdata ?? undefined),
      name: restaurant.name,
      categories: restaurant.categories,
      address: restaurant.address,
      city: cityForRestaurant(rdata),
      hoursText: weekly ? weekly.map((r) => `${r.day} ${r.hours}`).join(" · ") : null,
      topItems: menuPhotos.slice(0, 3).map((p) => p.name),
      firstVisitReward: restaurant.firstVisitReward,
      earnRule: earnRuleLine(earnPolicyFromRestaurant(rdata)),
      rewardExamples: parseRewardTiers(rdata.rewardTiers)
        .slice(0, 3)
        .map((t) => `${t.name} (${t.points} ⭐)`),
    });
  }, [restaurant, rdata, weekly, menuPhotos]);
  const seoParagraph = restaurant
    ? buildSeoParagraph(restaurant.name, restaurant.categories, restaurant.address, restaurantPromisesPoints(rdata ?? undefined), cityForRestaurant(rdata))
    : null;

  // Vista registrada una vez que hay datos (server o client).
  useEffect(() => {
    if (restaurant && restaurantId) {
      trackWebLandingView({ restaurantId, restaurantName: restaurant.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, restaurant?.name]);

  const menuHref = `/menu/${encodeURIComponent(restaurantId)}`;
  const whatsappHref = restaurant?.whatsapp
    ? buildWhatsappUrl(
        restaurant.whatsapp,
        `Hola ${name}, vi su página en Comeleal y quiero hacer un pedido 🙌`,
        phoneCountryOf(rdata),
      )
    : null;

  // Sin banner configurado → la mejor foto del menú como hero (que la página
  // nunca se vea vacía).
  const heroUrl = restaurant?.bannerUrl ?? menuPhotos[0]?.imageUrl ?? null;

  // Color de marca y lema impreso (8-sep). Con foto de portada el hero sigue
  // oscuro (la foto manda); sin portada, el color del local pinta el hero.
  const brand = brandThemeFromRestaurant(rdata ?? undefined);
  const tagline = taglineFromRestaurant(rdata ?? undefined);
  const heroBg = heroUrl ? "#141414" : brand.bg;
  const heroInk = heroUrl ? "#FFFFFF" : brand.ink;
  // Piel del local (10-sep): una piel = las dos páginas. Sin piel, el tema
  // DEFAULT es la portada de siempre byte por byte.
  const theme = landingThemeFor(menuSkinFromRestaurant(rdata ?? undefined));
  return (
    <div className={theme.root}>
      {/* ---- HERO ---- */}
      {theme.Header ? (
        theme.Header({
          loading,
          restaurantName: name,
          logoUrl: restaurant?.logoUrl ?? null,
          tagline,
          schedule,
          address: restaurant?.address ?? null,
          secondarySubtitle:
            restaurant && restaurant.categories.length > 0
              ? restaurant.categories.slice(0, 3).join(" · ").toLowerCase()
              : null,
        })
      ) : (
      <header className="relative overflow-hidden" style={{ background: heroBg }}>
        {heroUrl ? (
          <>
            <Image
              src={heroUrl}
              alt=""
              fill
              unoptimized
              className="object-cover opacity-45"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/55 to-[#141414]/25"
              aria-hidden
            />
          </>
        ) : brand.custom ? null : (
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(242,140,56,0.22),transparent_55%)]"
            aria-hidden
          />
        )}
        <div className="relative mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-14 lg:max-w-4xl">
          <div className="flex items-end gap-4">
            {restaurant?.logoUrl ? (
              <Image
                src={restaurant.logoUrl}
                alt=""
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lg ring-2 ring-white/20"
              />
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#F28C38]/15 text-3xl ring-2 ring-white/10"
                aria-hidden
              >
                🍽
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl" style={{ color: heroInk }}>
                {loading ? "…" : name || "Restaurante"}
              </h1>
              {tagline ? (
                <p className="mt-0.5 text-sm font-semibold italic" style={{ color: inkAlpha(heroInk, 0.8) }}>
                  {tagline}
                </p>
              ) : null}
              {restaurant && restaurant.categories.length > 0 ? (
                <p className="mt-1 truncate text-sm capitalize" style={{ color: inkAlpha(heroInk, 0.6) }}>
                  {restaurant.categories.slice(0, 3).join(" · ").toLowerCase()}
                </p>
              ) : null}
            </div>
          </div>
          {restaurant ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {/* Regla del 5-sep: sin premio no se promete nada (8-sep). */}
              {restaurantPromisesPoints(rdata ?? undefined) ? (
                <p className="inline-flex max-w-full items-center rounded-full border border-[#F28C38]/35 bg-[#F28C38]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB366]">
                  🔥 Recompensas en Comeleal
                </p>
              ) : null}
              {schedule ? <ScheduleChip schedule={schedule} /> : null}
            </div>
          ) : null}
        </div>
        <div
          className="h-px bg-gradient-to-r from-transparent via-[#F28C38]/50 to-transparent"
          aria-hidden
        />
      </header>
      )}

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-4 sm:px-6 sm:pt-5 lg:max-w-4xl">
        {loading && (
          <p className={theme.loading}>
            Cargando…
          </p>
        )}

        {!loading && error && (
          <p className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
            {error}
          </p>
        )}

        {!loading && !error && restaurant && (
          <>
            {/* ---- ACCIONES ----
                 CTA sticky (patrón Metro Pizza: el botón de ordenar NUNCA
                 sale de pantalla). position:sticky, cero JS. OJO: debe ser
                 hijo DIRECTO de <main> — sticky solo vive dentro de los
                 límites de su padre; anidado en el div de acciones dejaba de
                 pegarse dos renglones después. */}
            <div className="sticky top-3 z-30">
              <Link
                href={menuHref}
                onClick={() => trackWebLandingMenuClick({ restaurantId, restaurantName: name })}
                className={theme.cta}
              >
                🍽 Ver menú y ordenar
              </Link>
            </div>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackWebLandingWhatsappClick({ restaurantId, restaurantName: name })
                    }
                    className={theme.btnWhatsapp}
                  >
                    💬 WhatsApp
                  </a>
                ) : null}
                {restaurant.phone ? (
                  <a
                    href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
                    className={theme.btnNeutral}
                  >
                    📞 Llamar
                  </a>
                ) : null}
                {restaurant.address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      theme.btnNeutral + " " +
                      (!whatsappHref !== !restaurant.phone ? "" : "col-span-2")
                    }
                  >
                    📍 Cómo llegar
                  </a>
                ) : null}
              </div>
            </div>

            {/* ---- DESCRIPCIÓN ---- */}
            {restaurant.description ? (
              <p className={theme.descriptionCard}>
                {restaurant.description}
              </p>
            ) : null}

            {/* ---- DEL MENÚ (fotos) — "Los más pedidos" con datos de ventas ---- */}
            {menuPhotos.length > 0 ? (
              <SectionCard theme={theme} title={menuPhotosArePopular ? "Los más pedidos 🔥" : "Del menú"}>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {menuPhotos.map((item, i) => (
                    <Link
                      key={`${item.name}-${i}`}
                      href={menuHref}
                      onClick={() =>
                        trackWebLandingMenuClick({ restaurantId, restaurantName: name })
                      }
                      className="w-36 shrink-0"
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={144}
                        height={112}
                        unoptimized
                        className="h-28 w-36 rounded-xl object-cover shadow-sm"
                      />
                      <p className={`mt-1.5 truncate text-xs font-semibold ${theme.photoName}`}>
                        {item.name}
                      </p>
                      <p className={`text-xs font-medium ${theme.photoPrice}`}>
                        {formatPrice(item.price)}
                      </p>
                    </Link>
                  ))}
                </div>
                <Link
                  href={menuHref}
                  onClick={() => trackWebLandingMenuClick({ restaurantId, restaurantName: name })}
                  className={`mt-2 inline-block text-sm ${theme.link}`}
                >
                  Ver menú completo →
                </Link>
              </SectionCard>
            ) : null}

            {/* ---- PREMIOS FANTASMA (robo #1 de la APP de Owner/Metro
                 Pizza): la escalera completa de premios visible SIN sesión,
                 en gris con candado y su costo en ⭐ — deseo antes que
                 fricción. Sale en el HTML del SSR → los motores de IA citan
                 los premios concretos. ---- */}
            {rdata && hasRewardLadder(rdata) ? (
              <SectionCard theme={theme} title="Premios por regresar ⭐">
                <RewardLadder
                  restaurantData={rdata}
                  menuItems={menuPhotos.map((p) => ({
                    name: p.name,
                    imageUrl: p.imageUrl,
                  }))}
                />
                {restaurantPromisesPoints(rdata ?? undefined) ? (
                  <Link
                    href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
                    className={`mt-3 inline-block text-sm ${theme.link}`}
                  >
                    ¿Ya has comprado aquí? Ver mis puntos →
                  </Link>
                ) : null}
              </SectionCard>
            ) : null}

            {/* ---- HORARIO ---- */}
            {weekly ? (
              <SectionCard theme={theme} title="Horario">
                <ul className="space-y-1.5">
                  {weekly.map((row, idx) => {
                    const isToday = todayIdx === idx;
                    return (
                      <li
                        key={row.day}
                        className={
                          "flex items-center justify-between rounded-lg px-2 py-1 text-sm " +
                          (isToday ? theme.todayRow : theme.row)
                        }
                      >
                        {/* capitalize SOLO en el día — sobre la fila convertía "8:00 am" en "8:00 Am" */}
                        <span className="capitalize">
                          {row.day}
                          {isToday ? " · hoy" : ""}
                        </span>
                        <span className={row.hours === "Cerrado" ? theme.closedText : ""}>
                          {row.hours}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            ) : null}

            {/* ---- UBICACIÓN ---- */}
            {restaurant.address ? (
              <SectionCard theme={theme} title="Ubicación">
                <p className={`text-sm leading-relaxed ${theme.text}`}>{restaurant.address}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 inline-block text-sm ${theme.link}`}
                >
                  Abrir en Google Maps →
                </a>
              </SectionCard>
            ) : null}

            {/* ---- NUESTRA HISTORIA (patrón "Our Story" de Metro Pizza:
                 storytelling real = retención emocional; solo si el dueño
                 escribió el campo opcional `story`). ---- */}
            {restaurant.story ? (
              <SectionCard theme={theme} title="Nuestra historia">
                <p className={`whitespace-pre-line text-sm leading-relaxed ${theme.text}`}>
                  {restaurant.story}
                </p>
              </SectionCard>
            ) : null}

            {/* ---- BLOQUE SEO (patrón Metro "Las Vegas Pizza Delivery"):
                 párrafo con las palabras que la gente busca + el pitch de
                 ordenar directo. Texto plano, indexable, sin estorbar. ---- */}
            {seoParagraph ? (
              <p className={`px-1 text-[13px] leading-relaxed ${theme.seoText}`}>
                {seoParagraph}{" "}
                <Link
                  href={menuHref}
                  onClick={() => trackWebLandingMenuClick({ restaurantId, restaurantName: name })}
                  className={theme.link}
                >
                  Ordenar ahora →
                </Link>
              </p>
            ) : null}

            {/* ---- PREGUNTAS FRECUENTES (FAQPage schema en el layout con las
                 MISMAS respuestas — <details> nativo: funciona sin JS) ---- */}
            {faq.length > 0 ? (
              <SectionCard theme={theme} title="Preguntas frecuentes">
                <div className="space-y-1">
                  {faq.map((f) => (
                    <details
                      key={f.q}
                      className={`group rounded-xl px-3 py-2 ${theme.faqOpen}`}
                    >
                      <summary className="cursor-pointer list-none text-sm font-semibold marker:content-none">
                        <span className={`mr-1.5 inline-block transition-transform group-open:rotate-90 ${theme.faqChevron}`}>
                          ›
                        </span>
                        {f.q}
                      </summary>
                      <p className={`mt-1.5 pl-4 text-sm leading-relaxed ${theme.faqAnswer}`}>
                        {f.a}
                      </p>
                    </details>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ---- RECOMPENSAS / APP ----
                 Sin envoltura: el componente ya trae su propia tarjeta. Antes
                 iba dentro de otra y se veía doble borde. */}
            <MenuAppRewardsCta
              restaurantId={restaurantId}
              restaurantName={name}
              variant="browse"
              firstVisitRewardLabel={restaurant.firstVisitReward}
              loyaltyLive={restaurantPromisesPoints(rdata ?? undefined)}
              skin={menuSkinFromRestaurant(rdata ?? undefined)}
            />

            {/* ---- FIRMA (el loop viral: cada página vende Comeleal) ---- */}
            <p className={`pt-2 text-center text-xs ${theme.signature}`}>
              Página creada con{" "}
              <Link
                href="/para-restaurantes"
                className={theme.signatureLink}
              >
                Comeleal
              </Link>{" "}
              — para que tus clientes regresen.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
