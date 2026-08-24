import { NextResponse } from "next/server";
import {
  evaluateGeocodeResult,
  expectedCountryFromPhone,
  coordsInAddress,
  MIN_ADDRESS_CHARS,
} from "@/lib/geocodeRestaurant";

/**
 * Geocodifica la dirección de un local. SERVIDOR, no navegador.
 *
 * POR QUÉ ES UNA RUTA Y NO UN fetch DESDE EL CLIENTE:
 *   La versión anterior llamaba a Google desde el navegador con
 *   NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY. Dos problemas:
 *
 *   1. `NEXT_PUBLIC_` mete la llave en el bundle del navegador. Cualquiera la
 *      saca del JS y la usa — y la factura de Google llega a nombre de
 *      Comeleal. Vercel de hecho ya no deja marcar esas variables como
 *      secretas en producción, precisamente por esto.
 *   2. La llave nunca se puso en producción, así que el bloque entero se
 *      saltaba en silencio y los 16 locales creados desde la web quedaron en
 *      lat:0, lng:0 — el Golfo de Guinea — invisibles en la app, que filtra
 *      Recompensas a 20 km.
 *
 * Ahora la llave vive SÓLO en el servidor (GOOGLE_GEOCODING_API_KEY, sin
 * prefijo público) y el navegador nunca la ve.
 *
 * Las guardas viven en lib/geocodeRestaurant.ts y son las MISMAS que usa el
 * backfill del lado Firebase. Un pin equivocado es peor que no tener pin.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "json_invalido" }, { status: 400 });
  }

  const { address, phone } = (body ?? {}) as { address?: string; phone?: string };
  const addr = String(address ?? "").trim();
  const tel = String(phone ?? "").trim();

  if (!addr) {
    return NextResponse.json({ ok: false, reason: "sin_direccion" }, { status: 400 });
  }

  // El dueño escribió coordenadas en el campo de dirección. Pasó de verdad.
  const inline = coordsInAddress(addr);
  if (inline) {
    return NextResponse.json({
      ok: true,
      lat: inline.lat,
      lng: inline.lng,
      precision: "ADDRESS_FIELD_COORDS",
      formatted: addr,
    });
  }

  if (addr.length < MIN_ADDRESS_CHARS) {
    return NextResponse.json({ ok: false, reason: "direccion_muy_corta" });
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    // Explícito y ruidoso: fue exactamente el fallo silencioso que causó
    // los 16 locales en el mar.
    console.error("[geocode] GOOGLE_GEOCODING_API_KEY no está configurada");
    return NextResponse.json({ ok: false, reason: "sin_api_key" }, { status: 503 });
  }

  try {
    // La dirección va TAL CUAL. La versión anterior le pegaba
    // ", Chihuahua, Chihuahua, México" a todo, lo que rompía a los locales de
    // Colombia, Guatemala, Sinaloa, Veracruz y Puebla que ya hay en la base.
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(addr) +
      "&key=" +
      apiKey;
    const res = await fetch(url);
    const geoData = await res.json();
    const verdict = evaluateGeocodeResult(
      geoData,
      expectedCountryFromPhone(tel),
      addr,
    );
    if (!verdict.ok) {
      console.warn("[geocode] rechazado:", verdict.reason, "addr:", addr);
    }
    return NextResponse.json(verdict);
  } catch (e) {
    console.error("[geocode] fallo:", e);
    return NextResponse.json({ ok: false, reason: "geocode_exception" }, { status: 502 });
  }
}
