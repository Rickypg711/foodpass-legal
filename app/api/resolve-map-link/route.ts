import { NextResponse } from "next/server";
import {
  evaluateGeocodeResult,
  expectedCountryFor,
  firstMapsUrlIn,
  isGoogleMapsHost,
  parseLocationLink,
  placeTextFromMapsUrl,
  PIN_FROM_TEXT_PRECISIONS,
} from "@/lib/geocodeRestaurant";

/**
 * Resuelve un link CORTO de Google Maps (maps.app.goo.gl/…) a un pin. SERVIDOR.
 *
 * POR QUÉ EXISTE (5-oct-2026, Kame House): el panel le dice al dueño "abre Google Maps y comparte el link aquí",
 * y el botón Compartir de Maps da SIEMPRE un link corto. Ese link no trae coordenadas en el texto, así que
 * parseLocationLink daba null y el dueño veía "No encontré la ubicación en ese link" con el link correcto en la
 * mano. Diego lo intentó, no pudo, y le escribió a Ricardo. El navegador no puede seguir la redirección (CORS);
 * el servidor sí.
 *
 * Cómo sale el pin, en orden:
 *  1. Se sigue la redirección (solo entre hosts de Google, máx. 5 saltos). Si algún salto trae coordenadas
 *     (!3d!4d, ?q=lat,lng, @lat,lng) → ese es el pin (parseLocationLink, las mismas guardas de siempre).
 *  2. Si el link largo es de un LUGAR sin coordenadas (…/maps/place/Nombre,+Calle+123,+CP+Ciudad/…), el texto del
 *     lugar se geocodifica con las guardas del alta (país esperado, sin coincidencia parcial) y SOLO se acepta
 *     precisión de puerta (ROOFTOP / RANGE_INTERPOLATED): aquí no hay dueño revisando una dirección escrita.
 *
 * LO QUE NO SE HACE, A PROPÓSITO: leer el `center=` de la vista previa de la página de Maps. Se probó con el link
 * de Kame House y ese centro caía a 2.7 km del local (es la cámara, no el pin). Un pin equivocado es peor que
 * sin pin: si no hay coordenadas ni dirección de puerta, se contesta que no y el dueño escribe su dirección.
 */
const MAX_HOPS = 5;
// A propósito NO es un user-agent de navegador completo: con uno de Chrome, maps.app.goo.gl contesta 200 con una
// página que redirige por JavaScript (probado 5-oct); con uno sencillo contesta el 302 que aquí se sigue.
const UA = "Mozilla/5.0";
/** Solo estos hosts son acortadores: al llegar al link largo ya no se pide nada más (la página de Maps pesa). */
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "json_invalido" }, { status: 400 });
  }
  const { link, phone, country } = (body ?? {}) as { link?: string; phone?: string; country?: string };
  const start = firstMapsUrlIn(String(link ?? ""));
  if (!start) {
    return NextResponse.json({ ok: false, reason: "no_es_link_de_maps" }, { status: 400 });
  }

  let current = start;
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const inUrl = parseLocationLink(current);
      if (inUrl) return NextResponse.json({ ok: true, lat: inUrl.lat, lng: inUrl.lng, source: "link_coords" });

      if (!SHORT_HOSTS.has(new URL(current).hostname)) break;
      const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": UA }, cache: "no-store" });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) break;
      const next = new URL(location, current);
      // Jamás salir de Google: el link lo pega un usuario y este fetch corre en nuestro servidor.
      if (next.protocol !== "https:" || !isGoogleMapsHost(next.hostname)) {
        return NextResponse.json({ ok: false, reason: "redireccion_fuera_de_google" });
      }
      current = next.toString();
    }
  } catch (e) {
    console.error("[resolve-map-link] no se pudo seguir el link:", e);
    return NextResponse.json({ ok: false, reason: "link_no_responde" }, { status: 502 });
  }

  const inFinal = parseLocationLink(current);
  if (inFinal) return NextResponse.json({ ok: true, lat: inFinal.lat, lng: inFinal.lng, source: "link_coords" });

  const placeText = placeTextFromMapsUrl(current);
  if (!placeText) return NextResponse.json({ ok: false, reason: "link_sin_ubicacion" });

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.error("[resolve-map-link] GOOGLE_GEOCODING_API_KEY no está configurada");
    return NextResponse.json({ ok: false, reason: "sin_api_key" }, { status: 503 });
  }
  try {
    // Misma llamada que /api/geocode (rama de dirección): país esperado como filtro oficial y SIN language=es.
    const expected = expectedCountryFor({ country: String(country ?? ""), phone: String(phone ?? "") });
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(placeText) +
      (expected ? "&components=country:" + expected : "") +
      "&key=" +
      apiKey;
    const geoData = await (await fetch(url)).json();
    const verdict = evaluateGeocodeResult(geoData, expected, placeText);
    if (!verdict.ok) {
      console.warn("[resolve-map-link] rechazado:", verdict.reason, "lugar:", placeText);
      return NextResponse.json(verdict);
    }
    if (!PIN_FROM_TEXT_PRECISIONS.has(verdict.precision)) {
      console.warn("[resolve-map-link] precisión insuficiente:", verdict.precision, "lugar:", placeText);
      return NextResponse.json({ ok: false, reason: `precision_${verdict.precision}_insuficiente`, formatted: verdict.formatted });
    }
    return NextResponse.json({ ...verdict, source: "place_text" });
  } catch (e) {
    console.error("[resolve-map-link] geocode falló:", e);
    return NextResponse.json({ ok: false, reason: "geocode_exception" }, { status: 502 });
  }
}
