// lib/server/restaurantLanding.ts
//
// Fetch SERVER-SIDE del doc completo del restaurante + su menú vía Firestore
// REST (ambos public-read). Es lo que hace la landing /r/{id} legible para
// crawlers de IA (GPTBot, PerplexityBot, etc.) que NO ejecutan JavaScript:
// el HTML inicial ya trae nombre, horario, menú y precios.
//
// A diferencia de restaurantMetadata.ts (solo stringValue), aquí decodificamos
// el árbol completo de Firestore REST (mapValue/arrayValue/números/bools) para
// poder leer businessHours, firstPurchaseReward y el menú.

import { slugFromRestaurantData } from "@/lib/slug";

const PROJECT_ID = "foodpass-18b33";
const API_KEY = "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk"; // public web config (misma que lib/firebase.ts)
const BASE =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
  `/databases/(default)/documents`;

/** Un valor de Firestore REST → JS plano (recursivo). */
function decodeValue(v: Record<string, unknown>): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) {
    const m = v.mapValue as { fields?: Record<string, Record<string, unknown>> };
    return decodeFields(m.fields);
  }
  if ("arrayValue" in v) {
    const a = v.arrayValue as { values?: Record<string, unknown>[] };
    return Array.isArray(a.values) ? a.values.map(decodeValue) : [];
  }
  return null;
}

/** `fields` de un documento Firestore REST → objeto JS plano. */
export function decodeFields(
  fields: Record<string, Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeValue(v);
  }
  return out;
}

export type LandingFetchResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "error" };

/**
 * Doc completo del restaurante (decodificado). Cache de 5 min: el estado
 * abierto/cerrado NO depende de esto (se evalúa client-side con la hora del
 * visitante); esto solo cachea datos que cambian poco.
 */
export async function fetchRestaurantDocFull(
  restaurantId: string,
): Promise<LandingFetchResult> {
  const id = restaurantId.trim();
  if (!id) return { status: "not_found" };
  try {
    const res = await fetch(
      `${BASE}/restaurants/${encodeURIComponent(id)}?key=${API_KEY}`,
      { next: { revalidate: 300 } },
    );
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error" };
    const json = (await res.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    return { status: "ok", data: decodeFields(json.fields) };
  } catch {
    return { status: "error" };
  }
}

export type LandingMenuItem = {
  name: string;
  description: string | null;
  price: number;
  category: string;
  imageUrl: string | null;
  /** Ventas acumuladas (campo opcional `orderCount`, lo llenará un contador
   *  futuro). 0 cuando no existe — el sort "Los más pedidos" cae a nombre. */
  orderCount: number;
};

/** Menú disponible del restaurante (server-side, para SSR + JSON-LD Menu). */
export async function fetchRestaurantMenuFull(
  restaurantId: string,
): Promise<LandingMenuItem[]> {
  const id = restaurantId.trim();
  if (!id) return [];
  try {
    const res = await fetch(
      `${BASE}/restaurants/${encodeURIComponent(id)}/menu?pageSize=300&key=${API_KEY}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      documents?: { fields?: Record<string, Record<string, unknown>> }[];
    };
    if (!Array.isArray(json.documents)) return [];
    const items: LandingMenuItem[] = [];
    for (const d of json.documents) {
      const data = decodeFields(d.fields);
      const available =
        typeof data.isAvailable === "boolean" ? data.isAvailable : true;
      const name =
        typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
      if (!available || !name) continue;
      const priceRaw = data.price;
      const price =
        typeof priceRaw === "number"
          ? priceRaw
          : typeof priceRaw === "string"
            ? parseFloat(priceRaw)
            : NaN;
      items.push({
        name,
        description:
          typeof data.description === "string" && data.description.trim()
            ? data.description.trim()
            : null,
        price: Number.isFinite(price) ? price : 0,
        category:
          typeof data.category === "string" && data.category.trim()
            ? data.category.trim()
            : "Otros",
        imageUrl:
          typeof data.imageUrl === "string" && data.imageUrl.trim()
            ? data.imageUrl.trim()
            : null,
        orderCount: typeof data.orderCount === "number" ? data.orderCount : 0,
      });
    }
    items.sort((a, b) => {
      const c = a.category.localeCompare(b.category, "es");
      return c !== 0 ? c : a.name.localeCompare(b.name, "es");
    });
    return items;
  } catch {
    return [];
  }
}

/**
 * Menú CRUDO — cada doc decodificado completo, con su id y sin filtrar.
 *
 * Existe para el SSR de /menu/{id}: la vista client mapea con SU PROPIO
 * `mapMenuDoc` (que conoce `optionGroups` y lo que se agregue después), así
 * que el server no debe recortar campos. MISMA URL que
 * fetchRestaurantMenuFull → Next dedupe: un solo viaje a Firestore aunque
 * llamen los dos dentro del mismo request.
 */
export async function fetchRestaurantMenuRawDocs(
  restaurantId: string,
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const id = restaurantId.trim();
  if (!id) return [];
  try {
    const res = await fetch(
      `${BASE}/restaurants/${encodeURIComponent(id)}/menu?pageSize=300&key=${API_KEY}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      documents?: {
        name?: string;
        fields?: Record<string, Record<string, unknown>>;
      }[];
    };
    if (!Array.isArray(json.documents)) return [];
    const docs: { id: string; data: Record<string, unknown> }[] = [];
    for (const d of json.documents) {
      const docId =
        typeof d.name === "string" ? (d.name.split("/").pop() ?? "") : "";
      if (!docId) continue;
      docs.push({ id: docId, data: decodeFields(d.fields) });
    }
    return docs;
  } catch {
    return [];
  }
}

/** Busca un restaurante por su campo `slug` (exacto, ya en minúsculas). */
export async function findRestaurantBySlug(
  slug: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "restaurants" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "slug" },
              op: "EQUAL",
              value: { stringValue: slug },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      document?: { name?: string; fields?: Record<string, Record<string, unknown>> };
    }[];
    const doc = rows.find((r) => r.document)?.document;
    const id = doc?.name?.split("/").pop();
    if (!doc || !id) return null;
    return { id, data: decodeFields(doc.fields) };
  } catch {
    return null;
  }
}

export type ResolvedRestaurant = {
  /** ID real de Firestore (para /menu, analytics, fallback client). */
  id: string;
  data: Record<string, unknown>;
  /** Slug usable del doc, o null. */
  slug: string | null;
  /** Cómo llegó el visitante: por id o por slug. */
  matchedBy: "id" | "slug";
};

/**
 * Resuelve el handle de /r/{handle}: primero como ID (los QR impresos son
 * eternos), luego como slug. El canónico es el slug cuando existe — page.tsx
 * redirige id→slug con esto.
 */
export async function resolveRestaurantHandle(
  handle: string,
): Promise<ResolvedRestaurant | "error" | null> {
  const byId = await fetchRestaurantDocFull(handle);
  if (byId.status === "ok") {
    return {
      id: handle,
      data: byId.data,
      slug: slugFromRestaurantData(byId.data),
      matchedBy: "id",
    };
  }
  if (byId.status === "error") return "error";
  const bySlug = await findRestaurantBySlug(handle.toLowerCase());
  if (bySlug) {
    return {
      id: bySlug.id,
      data: bySlug.data,
      slug: slugFromRestaurantData(bySlug.data),
      matchedBy: "slug",
    };
  }
  return null;
}

/**
 * Rescate de ids con mayúsculas distintas (FB/IG reescriben URLs en
 * minúsculas): busca el id real comparando en lowercase. Server-side espejo
 * del rescate client de /menu.
 */
export async function findRestaurantIdCaseInsensitive(
  restaurantId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId: "restaurants" }], limit: 300 },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { document?: { name?: string } }[];
    const lower = restaurantId.toLowerCase();
    for (const r of rows) {
      const id = r.document?.name?.split("/").pop();
      if (id && id.toLowerCase() === lower) return id;
    }
    return null;
  } catch {
    return null;
  }
}
