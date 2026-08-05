// /r/{id} — página pública del restaurante. SERVER component: el doc y el
// menú se leen aquí (Firestore REST, public-read) y viajan como props → el
// HTML inicial trae TODO el contenido. Google indexa igual, pero los
// crawlers de IA (GPTBot, PerplexityBot…) NO ejecutan JS — esto es lo que
// los deja leer nombre, horario, menú y precios.
//
// Si el fetch server-side falla (red), LandingView recibe initial=null y
// hace el fetch client-side de respaldo — la página nunca muere por esto.

import { redirect } from "next/navigation";
import {
  fetchRestaurantMenuFull,
  findRestaurantIdCaseInsensitive,
  resolveRestaurantHandle,
} from "@/lib/server/restaurantLanding";
import LandingView, { type LandingInitialData } from "./LandingView";

export default async function RestaurantLandingPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  // El handle puede ser el ID de Firestore (QRs impresos, eternos) o el slug
  // bonito (comeleal.com/r/luzz-pizza). Canónico = slug cuando existe.
  const { restaurantId: handle } = await params;

  const resolved = await resolveRestaurantHandle(handle);

  if (resolved === null) {
    // Ni id ni slug → rescate de ids reescritos en minúsculas (FB/IG).
    const realId = await findRestaurantIdCaseInsensitive(handle);
    if (realId && realId !== handle) {
      redirect(`/r/${realId}`);
    }
    // De plano no existe → la vista client muestra "No encontramos…".
    return <LandingView restaurantId={handle} initial={null} />;
  }

  if (resolved === "error") {
    // Falla de red server-side → respaldo client (mismo camino que /menu).
    return <LandingView restaurantId={handle} initial={null} />;
  }

  // Canónico: si llegó por ID y el restaurante YA tiene slug → redirige a la
  // URL bonita (los dos funcionan; Google y los shares consolidan en una).
  if (resolved.matchedBy === "id" && resolved.slug && resolved.slug !== handle) {
    redirect(`/r/${resolved.slug}`);
  }
  // Slug con mayúsculas raras → normaliza.
  if (resolved.matchedBy === "slug" && resolved.slug && handle !== resolved.slug) {
    redirect(`/r/${resolved.slug}`);
  }

  const restaurantId = resolved.id;
  const docResult = { data: resolved.data };
  const menu = await fetchRestaurantMenuFull(restaurantId);

  // Patrón Metro Pizza: si hay datos de ventas (orderCount, contador futuro),
  // el carrusel se vuelve "Los más pedidos" — la prueba social vende sola.
  // Sin datos: orden por nombre y título neutro "Del menú".
  const withPhoto = menu.filter((i) => i.imageUrl);
  const hasSales = withPhoto.some((i) => i.orderCount > 0);
  const sorted = hasSales
    ? [...withPhoto].sort((a, b) => b.orderCount - a.orderCount)
    : withPhoto;

  const initial: LandingInitialData = {
    raw: docResult.data,
    menuPhotos: sorted
      .slice(0, 6)
      .map((i) => ({ name: i.name, price: i.price, imageUrl: i.imageUrl as string })),
    menuPhotosArePopular: hasSales,
  };

  return <LandingView restaurantId={restaurantId} initial={initial} />;
}
