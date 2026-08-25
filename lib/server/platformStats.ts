// Robo #3 a Biomenus — con la regla al revés: ellos ponen "+2€ por mesa" y
// abajo confiesan "ilustrativo". Aquí el número del titular es REAL y VIVO:
// se calcula contra Firestore al render (cache 1 h). Si el fetch falla, se
// devuelve null y la sección NO se pinta — jamás un número de folleto.

const PROJECT_ID = "foodpass-18b33";
const API_KEY = "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk"; // public web config
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export type PlatformStats = {
  activeRestaurants: number;
  dishesOnline: number;
};

async function aggregateCount(
  path: string,
  body: Record<string, unknown>,
): Promise<number | null> {
  try {
    const res = await fetch(`${DOCS}${path}:runAggregationQuery?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{
      result?: { aggregateFields?: { n?: { integerValue?: string } } };
    }>;
    const raw = json?.[0]?.result?.aggregateFields?.n?.integerValue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function listActiveRestaurantIds(): Promise<string[] | null> {
  try {
    const res = await fetch(`${DOCS}:runQuery?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "restaurants" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "isSetupComplete" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
          select: { fields: [{ fieldPath: "__name__" }] },
          limit: 300,
        },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ document?: { name?: string } }>;
    const ids = rows
      .map((r) => r.document?.name?.split("/").pop() ?? "")
      .filter(Boolean);
    return ids;
  } catch {
    return null;
  }
}

/**
 * Locales activos + platillos en línea, calculados en vivo. La agregación de
 * grupo (`collectionGroup menu`) está cerrada por reglas para anónimos, así
 * que se suma menú por menú de los locales ACTIVOS — que además es el número
 * honesto: platillos que un comensal puede ver HOY, no basura de cuentas
 * incompletas.
 */
export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  const ids = await listActiveRestaurantIds();
  if (!ids || ids.length === 0) return null;
  const counts = await Promise.all(
    ids.map((id) =>
      aggregateCount(`/restaurants/${encodeURIComponent(id)}`, {
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: "menu" }] },
          aggregations: [{ count: {}, alias: "n" }],
        },
      }),
    ),
  );
  let dishes = 0;
  for (const c of counts) {
    if (c == null) return null; // un fallo = sin número; nunca un número a medias
    dishes += c;
  }
  return { activeRestaurants: ids.length, dishesOnline: dishes };
}
