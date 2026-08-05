"use client";

// /r/{id} — la página pública del restaurante (su "mini-sitio" gratis).
// TODO auto-generado con datos que YA existen: logo/banner, descripción,
// horario, dirección, teléfono/WhatsApp y fotos del menú. CERO UI nueva de
// edición — el dueño la alimenta desde Configuración y el menú, como siempre.
// Es el link para bio de Instagram / Google Maps; el QR de mesa sigue en
// /menu/{id} (ahí nadie quiere una landing antes del menú).

import { collection, getDocs } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
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
  type WeeklyScheduleRow,
} from "@/lib/schedule";

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
  schedule: ScheduleStatus | null;
  weekly: WeeklyScheduleRow[] | null;
};

type MenuPhoto = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
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
  const categories = Array.isArray(data.categories)
    ? (data.categories as unknown[])
        .map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter(Boolean)
    : [];
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
    schedule: scheduleStatus(data),
    weekly: weeklySchedule(data),
  };
}

/** Hasta 6 platillos CON foto para el carrusel "Del menú". */
function mapMenuPhotos(
  docs: { id: string; data: Record<string, unknown> }[],
): MenuPhoto[] {
  const out: MenuPhoto[] = [];
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
    out.push({ id: d.id, name, price: Number.isFinite(price) ? price : 0, imageUrl });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return out.slice(0, 6);
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#1C2526]/8 bg-white/85 p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-bold tracking-tight text-[#1C2526]">
        <span className="h-4 w-1 rounded-full bg-[#F28C38]" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function RestaurantLandingPage() {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<LandingRestaurant | null>(null);
  const [menuPhotos, setMenuPhotos] = useState<MenuPhoto[]>([]);

  useEffect(() => {
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
          const match = allSnap.docs.find(
            (d) => d.id.toLowerCase() === restaurantId.toLowerCase(),
          );
          if (match) {
            window.location.replace(`/r/${match.id}`);
            return;
          }
          setError("No encontramos este restaurante");
          setLoading(false);
          return;
        }

        const mapped = mapRestaurant(rSnap.data() as Record<string, unknown>);
        setRestaurant(mapped);

        // Fotos del menú — best-effort: si falla, la landing vive sin carrusel.
        try {
          const menuSnap = await getDocs(collection(db, "restaurants", restaurantId, "menu"));
          if (!cancelled) {
            setMenuPhotos(
              mapMenuPhotos(
                menuSnap.docs.map((d) => ({
                  id: d.id,
                  data: d.data() as Record<string, unknown>,
                })),
              ),
            );
          }
        } catch {
          /* opcional */
        }

        if (!cancelled) {
          trackWebLandingView({ restaurantId, restaurantName: mapped.name });
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
  }, [restaurantId]);

  const menuHref = `/menu/${encodeURIComponent(restaurantId)}`;
  const name = restaurant?.name ?? "";
  const whatsappHref = restaurant?.whatsapp
    ? buildWhatsappUrl(
        restaurant.whatsapp,
        `Hola ${name}, vi su página en Comeleal y quiero hacer un pedido 🙌`,
      )
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF7F2] via-[#F5EDE2] to-[#F0E3D2] text-[#1C2526]">
      {/* ---- HERO ---- */}
      <header className="relative overflow-hidden bg-[#141414]">
        {restaurant?.bannerUrl ? (
          <>
            <Image
              src={restaurant.bannerUrl}
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
        ) : (
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
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                {loading ? "…" : name || "Restaurante"}
              </h1>
              {restaurant && restaurant.categories.length > 0 ? (
                <p className="mt-1 truncate text-sm capitalize text-white/60">
                  {restaurant.categories.slice(0, 3).join(" · ").toLowerCase()}
                </p>
              ) : null}
            </div>
          </div>
          {restaurant ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <p className="inline-flex max-w-full items-center rounded-full border border-[#F28C38]/35 bg-[#F28C38]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB366]">
                🔥 Recompensas en Comeleal
              </p>
              {restaurant.schedule ? <ScheduleChip schedule={restaurant.schedule} /> : null}
            </div>
          ) : null}
        </div>
        <div
          className="h-px bg-gradient-to-r from-transparent via-[#F28C38]/50 to-transparent"
          aria-hidden
        />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-4 sm:px-6 sm:pt-5 lg:max-w-4xl">
        {loading && (
          <p className="rounded-2xl border border-[#1C2526]/8 bg-white/80 px-4 py-6 text-center text-sm text-[#1C2526]/70">
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
            {/* ---- ACCIONES ---- */}
            <div className="space-y-2.5">
              <Link
                href={menuHref}
                onClick={() => trackWebLandingMenuClick({ restaurantId, restaurantName: name })}
                className="block min-h-12 rounded-xl bg-[#F28C38] py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#d67428]"
              >
                🍽 Ver menú y ordenar
              </Link>
              <div className="grid grid-cols-2 gap-2.5">
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackWebLandingWhatsappClick({ restaurantId, restaurantName: name })
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/25 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    💬 WhatsApp
                  </a>
                ) : null}
                {restaurant.phone ? (
                  <a
                    href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1C2526]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2]"
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
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#1C2526]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] " +
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
              <p className="rounded-2xl border border-[#1C2526]/8 bg-white/85 p-4 text-sm leading-relaxed text-[#1C2526]/80 shadow-sm sm:p-5">
                {restaurant.description}
              </p>
            ) : null}

            {/* ---- DEL MENÚ (fotos) ---- */}
            {menuPhotos.length > 0 ? (
              <SectionCard title="Del menú">
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {menuPhotos.map((item) => (
                    <Link
                      key={item.id}
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
                      <p className="mt-1.5 truncate text-xs font-semibold text-[#1C2526]">
                        {item.name}
                      </p>
                      <p className="text-xs font-medium text-[#F28C38]">
                        {formatPrice(item.price)}
                      </p>
                    </Link>
                  ))}
                </div>
                <Link
                  href={menuHref}
                  onClick={() => trackWebLandingMenuClick({ restaurantId, restaurantName: name })}
                  className="mt-2 inline-block text-sm font-semibold text-[#F28C38] underline-offset-2 hover:underline"
                >
                  Ver menú completo →
                </Link>
              </SectionCard>
            ) : null}

            {/* ---- HORARIO ---- */}
            {restaurant.weekly ? (
              <SectionCard title="Horario">
                <ul className="space-y-1.5">
                  {restaurant.weekly.map((row) => (
                    <li
                      key={row.day}
                      className={
                        "flex items-center justify-between rounded-lg px-2 py-1 text-sm " +
                        (row.isToday
                          ? "bg-[#F28C38]/10 font-semibold text-[#1C2526]"
                          : "text-[#1C2526]/70")
                      }
                    >
                      {/* capitalize SOLO en el día — sobre toda la fila convertía "8:00 am" en "8:00 Am" */}
                      <span className="capitalize">
                        {row.day}
                        {row.isToday ? " · hoy" : ""}
                      </span>
                      <span className={row.hours === "Cerrado" ? "text-[#1C2526]/45" : ""}>
                        {row.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}

            {/* ---- UBICACIÓN ---- */}
            {restaurant.address ? (
              <SectionCard title="Ubicación">
                <p className="text-sm leading-relaxed text-[#1C2526]/80">{restaurant.address}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-[#F28C38] underline-offset-2 hover:underline"
                >
                  Abrir en Google Maps →
                </a>
              </SectionCard>
            ) : null}

            {/* ---- RECOMPENSAS / APP ---- */}
            <div className="rounded-2xl border border-[#F28C38]/20 bg-white/90 p-4 shadow-sm sm:p-5">
              <MenuAppRewardsCta
                restaurantId={restaurantId}
                restaurantName={name}
                variant="browse"
                firstVisitRewardLabel={restaurant.firstVisitReward}
              />
            </div>

            {/* ---- FIRMA (el loop viral: cada página vende Comeleal) ---- */}
            <p className="pt-2 text-center text-xs text-[#1C2526]/50">
              Página creada con{" "}
              <Link
                href="/para-restaurantes"
                className="font-semibold text-[#F28C38] underline-offset-2 hover:underline"
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
