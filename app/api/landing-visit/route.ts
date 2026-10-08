import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";

/**
 * POST /api/landing-visit  { restaurantId, source }
 *
 * Contador de visitas por link compartido por el DUEÑO (6-oct-2026, la
 * recompensa de la activación en tres toques): cuando alguien abre
 * /r/{slug}?utm_source=whatsapp|instagram|google|perfil&utm_medium=owner_share, la
 * portada avisa aquí una vez por sesión y se suma 1 en
 * restaurants/{id}/private/stats.linkVisits.{source} (+ total). Lo escribe
 * el Admin SDK: las reglas no dejan que un navegador anónimo escriba nada.
 * Con eso el panel puede decir "4 abrieron tu link", que es lo que vuelve
 * hábito el toque 1 (Hooked: recompensa variable).
 *
 * No guarda nada de la persona: ni IP, ni agente, ni teléfono. Solo un +1.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
// "perfil" = el link copiado que pega en Facebook/Instagram/WhatsApp/Google
// (uno para los cuatro). instagram|google se aceptan por los links ya pegados.
// "bolsa" (8-oct-2026): escaneos de la tarjeta impresa de Rappi/DiDi (lib/order/entrySource.ts).
export const LANDING_VISIT_SOURCES = ["whatsapp", "instagram", "google", "perfil", "bolsa"] as const;

export async function POST(request: Request) {
  let body: { restaurantId?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const source = typeof body.source === "string" ? body.source : "";
  if (!ID_RE.test(restaurantId) || !(LANDING_VISIT_SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  try {
    const db = getFirebaseAdminDb();
    const rest = await db.doc(`restaurants/${restaurantId}`).get();
    if (!rest.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await db.doc(`restaurants/${restaurantId}/private/stats`).set(
      {
        // La tarjeta impresa NO suma al total: "total" son los links que compartió el dueño.
        linkVisits: source === "bolsa"
          ? { bolsa: FieldValue.increment(1) }
          : { [source]: FieldValue.increment(1), total: FieldValue.increment(1) },
        linkVisitsUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
