// comeleal.com/{handle} — alias raíz bonito de la página del restaurante.
// "comeleal.com/luzz-pizza" redirige a /r/luzz-pizza (el canónico). Las rutas
// reales del sitio (/precios, /menu, /vendor…) SIEMPRE ganan sobre este
// catch-all — Next resuelve rutas estáticas primero — y además los slugs
// jamás pueden reclamar nombres reservados (lib/slug.ts RESERVED_SLUGS).
// Si el handle no es ningún restaurante → 404 normal.

import { notFound, redirect } from "next/navigation";
import { resolveRestaurantHandle } from "@/lib/server/restaurantLanding";

export default async function RootHandleAlias({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  // Sin pinta de handle (archivos, rutas técnicas) → 404 sin gastar fetch.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,60}$/.test(handle)) {
    notFound();
  }

  const resolved = await resolveRestaurantHandle(handle);
  if (resolved && resolved !== "error") {
    redirect(`/r/${resolved.slug ?? resolved.id}`);
  }

  notFound();
}
