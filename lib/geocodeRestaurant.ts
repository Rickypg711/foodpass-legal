// lib/geocodeRestaurant.ts
//
// NULL ISLAND FIX — 24-ago-2026.
//
// Espejo EXACTO de las guardas de
// FOODPASS/functions/admin/backfill/backfill-restaurant-geocode.js.
// Si cambias una regla aquí, cámbiala allá.
//
// QUÉ PASÓ:
//   16 de 28 restaurantes estaban en lat:0, lng:0 — los 16 creados por
//   `web_signup`, o sea por este flujo. 0,0 es un punto en el Golfo de Guinea.
//   La app filtra Recompensas a 20 km, así que TODOS quedaban invisibles.
//   Sushin-Gón y Spicy & Sweet, activos y completos, no aparecían.
//
// POR QUÉ:
//   1. El bloque de geocodificación depende de NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY,
//      que NO estaba en el entorno de producción de Vercel → se saltaba entero.
//   2. Le pegaba ", Chihuahua, Chihuahua, México" a TODA dirección. Ya hay
//      locales en Colombia, Guatemala, Sinaloa, Veracruz y Puebla.
//   3. Fallaba en silencio (console.warn) y nadie se enteraba nunca.
//
// LA REGLA QUE IMPORTA: un pin equivocado es PEOR que no tener pin. Un local
// mal ubicado sigue invisible, pero además ya nadie lo nota. Ante la duda, se
// deja sin coordenadas y se marca para revisión.

export type GeocodeVerdict =
  | {ok: true; lat: number; lng: number; precision: string; formatted: string}
  | {ok: false; reason: string; formatted?: string};

/** Precisiones que sirven para el pin de un local. */
const GOOD_LOCATION_TYPES = new Set([
  'ROOFTOP',
  'RANGE_INTERPOLATED',
  'GEOMETRIC_CENTER',
]);

/** Direcciones demasiado pobres para intentarlo siquiera. */
export const MIN_ADDRESS_CHARS = 8;

/**
 * ¿La dirección ya ES un par de coordenadas?
 * Caso real: un dueño pegó "18.9849690, -98.2506580" en el campo de dirección.
 * El formulario pidió lo que no era y tiró lo que sí servía.
 */
export function coordsInAddress(
  address: string,
): {lat: number; lng: number} | null {
  const m = String(address || '')
    .trim()
    .match(/^(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return {lat, lng};
}

/**
 * Coordenadas desde un LINK de ubicación pegado por el dueño — la vía para
 * un puesto sin ficha de Google (27-ago, caso Null Island): WhatsApp y
 * Google Maps comparten links con el lat/lng del GPS adentro. Acepta:
 *   - https://maps.google.com/?q=28.73,-106.12   (WhatsApp "Enviar ubicación")
 *   - https://www.google.com/maps/@28.73,-106.12,17z
 *   - .../maps/place/...!3d28.73!4d-106.12
 *   - "28.73, -106.12" pelón (coordsInAddress)
 * Rechaza Null Island y fuera de rango. null = no se entendió — JAMÁS
 * adivinar: un pin equivocado es peor que sin pin.
 */
export function parseLocationLink(
  text: string,
): {lat: number; lng: number} | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const direct = coordsInAddress(raw);
  if (direct) return direct;

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const check = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
    return {lat, lng};
  };

  // !3dLAT!4dLNG — el pin exacto del lugar en links largos de Google Maps
  // (va ANTES que @: el @ de esos links es el centro de la CÁMARA, no el pin).
  let m = decoded.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return check(Number(m[1]), Number(m[2]));

  // ?q=LAT,LNG — el formato del "Enviar mi ubicación" de WhatsApp.
  m = decoded.match(/[?&]q=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return check(Number(m[1]), Number(m[2]));

  // /@LAT,LNG — centro del mapa (aceptable cuando el dueño centró su local).
  m = decoded.match(/@(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return check(Number(m[1]), Number(m[2]));

  return null;
}

/**
 * País esperado, deducido del teléfono.
 *
 * Sin esto se escribe basura con toda confianza: "el centro" de un local de
 * GUATEMALA geocodifica a El Centro, California; "Av 5a #210" de uno de
 * Delicias, Chihuahua, geocodifica a Maracanaú, BRASIL — ambos con precisión
 * ROOFTOP.
 */
export function expectedCountryFromPhone(phone: string): string | null {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.startsWith('+')) {
    if (digits.startsWith('502')) return 'GT';
    if (digits.startsWith('57')) return 'CO';
    if (digits.startsWith('52')) return 'MX';
    if (digits.startsWith('1')) return 'US';
    return null;
  }
  if (digits.length === 10) return 'MX';
  return null;
}

function countryOfResult(result: {
  address_components?: Array<{types?: string[]; short_name?: string}>;
}): string | null {
  const comps = result?.address_components || [];
  const c = comps.find((k) => (k.types || []).includes('country'));
  return c?.short_name ?? null;
}

/**
 * ¿Google entendió, o adivinó? Sólo se aplica a `partial_match`.
 *
 * Caso real: "Leona vicario centro" (tel 998 = Cancún) devolvió una calle del
 * Centro de CDMX con precisión ROOFTOP — mismo país, así que la guarda de país
 * no lo atrapa, pero está a 1,600 km. En cambio "Av. Tecnológico #11901, Col.
 * Deportistas, Chihuahua, Chih." también viene partial_match (por el "#") y SÍ
 * es correcto: el resultado conserva "Chihuahua".
 */
export function resultKeepsInputTokens(
  address: string,
  formatted: string,
): boolean {
  const norm = (t: string) =>
    t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const target = norm(String(formatted || ''));
  const tokens = norm(String(address || ''))
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  if (tokens.length === 0) return false;
  return tokens.some((t) => target.includes(t));
}

/** Evalúa la respuesta cruda de Google. Pura: testeable sin red. */
export function evaluateGeocodeResult(
  geoData: {
    status?: string;
    results?: Array<{
      geometry?: {location?: {lat: number; lng: number}; location_type?: string};
      formatted_address?: string;
      partial_match?: boolean;
      address_components?: Array<{types?: string[]; short_name?: string}>;
    }>;
  } | null,
  expectedCountry: string | null,
  addressAsked: string,
): GeocodeVerdict {
  if (!geoData || geoData.status !== 'OK') {
    return {ok: false, reason: `status_${geoData?.status ?? 'no_response'}`};
  }
  const r = (geoData.results || [])[0];
  const loc = r?.geometry?.location;
  if (!r || !loc) return {ok: false, reason: 'sin_geometry'};
  const {lat, lng} = loc;
  if (lat === 0 && lng === 0) return {ok: false, reason: 'devolvio_0_0'};

  const precision = r.geometry?.location_type || 'UNKNOWN';
  const formatted = r.formatted_address || '';
  const gotCountry = countryOfResult(r);

  if (expectedCountry && gotCountry && gotCountry !== expectedCountry) {
    return {
      ok: false,
      reason: `pais_no_coincide (tel ${expectedCountry}, Google ${gotCountry})`,
      formatted,
    };
  }

  // APPROXIMATE = centro de ciudad o de estado. NO sirve: "Chihuahua, Chih."
  // cae en el centroide del ESTADO, a ~32 km de la ciudad — fuera del radio
  // de 20 km de Recompensas. Seguiría invisible.
  if (!GOOD_LOCATION_TYPES.has(precision)) {
    return {ok: false, reason: `precision_${precision}_insuficiente`, formatted};
  }

  if (r.partial_match === true && !resultKeepsInputTokens(addressAsked, formatted)) {
    return {ok: false, reason: 'partial_match_sin_coincidencia', formatted};
  }

  return {ok: true, lat, lng, precision, formatted};
}

/**
 * Geocodifica la dirección de un local recién creado.
 *
 * OJO: la dirección va TAL CUAL. La versión anterior le pegaba
 * ", Chihuahua, Chihuahua, México" a todo, lo que rompía a cualquiera fuera
 * de Chihuahua — y ya hay locales en Colombia, Guatemala y media república.
 */
export async function geocodeRestaurantAddress(args: {
  address: string;
  phone: string;
  apiKey: string | undefined;
}): Promise<GeocodeVerdict> {
  const address = String(args.address || '').trim();
  if (!args.apiKey) return {ok: false, reason: 'sin_api_key'};

  const inline = coordsInAddress(address);
  if (inline) {
    return {
      ok: true,
      lat: inline.lat,
      lng: inline.lng,
      precision: 'ADDRESS_FIELD_COORDS',
      formatted: address,
    };
  }
  if (address.length < MIN_ADDRESS_CHARS) {
    return {ok: false, reason: 'direccion_muy_corta'};
  }

  const url =
    'https://maps.googleapis.com/maps/api/geocode/json?address=' +
    encodeURIComponent(address) +
    '&key=' +
    args.apiKey;
  const res = await fetch(url);
  const geoData = await res.json();
  return evaluateGeocodeResult(
    geoData,
    expectedCountryFromPhone(args.phone),
    address,
  );
}
