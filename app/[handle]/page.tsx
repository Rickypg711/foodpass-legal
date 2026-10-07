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
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await (searchParams ?? Promise.resolve({}));
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") u.set(k, v);
  }
  const qs = u.toString() ? `?${u.toString()}` : "";

  // Sin pinta de handle (archivos, rutas técnicas) → 404 sin gastar fetch.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,60}$/.test(handle)) {
    notFound();
  }

  const resolved = await resolveRestaurantHandle(handle);
  if (resolved && resolved !== "error") {
    redirect(`/r/${resolved.slug ?? resolved.id}${qs}`);
  }

  notFound();
}
