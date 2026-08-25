// /menu/{id} — la CARTA (el destino de cada QR impreso). SERVER component:
// el doc y el menú CRUDO se leen aquí (Firestore REST, public-read, cache
// 5 min) y viajan como props → el primer paint ya trae la carta completa
// (nombres, precios, categorías) en vez de "Cargando menú…". Es el robo #1 a
// Biomenus aplicado a la superficie que más importa: el comensal en el 4G de
// la taquería ve platillos al instante, y Google y los crawlers de IA (que no
// ejecutan JS) leen el menú entero del HTML.
//
// Si el fetch server falla (red), MenuView recibe initial=null y se comporta
// EXACTO como antes (spinner + fetch client) — la página nunca muere por esto.
// El carrito, el chip abierto/cerrado (hora LOCAL del visitante) y la captura
// de ?mesa= siguen siendo 100% client, igual que siempre.

import { redirect } from "next/navigation";
import {
  fetchRestaurantMenuRawDocs,
  findRestaurantIdCaseInsensitive,
  resolveRestaurantHandle,
} from "@/lib/server/restaurantLanding";
import MenuView, { type MenuInitialData } from "./MenuView";

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId: handle } = await params;

  const resolved = await resolveRestaurantHandle(handle);

  if (resolved === null) {
    // Ni id ni slug → rescate de ids reescritos en minúsculas (FB/IG).
    const realId = await findRestaurantIdCaseInsensitive(handle);
    if (realId && realId !== handle) {
      redirect(`/menu/${realId}`);
    }
    // De plano no existe → la vista client muestra "No encontramos este menú".
    return <MenuView restaurantId={handle} initial={null} />;
  }

  if (resolved === "error") {
    // Falla de red server-side → respaldo client (flujo clásico, intacto).
    return <MenuView restaurantId={handle} initial={null} />;
  }

  // Slug bonito → redirige al ID real. Es lo MISMO que ya hacía el rescate
  // client (`window.location.replace`), pero sin el flash: los links internos
  // del menú, el carrito y los providers trabajan con el id, y el QR codifica
  // el id A PROPÓSITO (memoria dos-ligas: no unificar con el slug).
  if (resolved.id !== handle) {
    redirect(`/menu/${resolved.id}`);
  }

  const menu = await fetchRestaurantMenuRawDocs(resolved.id);
  const initial: MenuInitialData = { raw: resolved.data, menu };

  return <MenuView restaurantId={resolved.id} initial={initial} />;
}
