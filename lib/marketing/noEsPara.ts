// "¿Para quién NO es Comeleal?" (8-oct-2026, idea del estudio de Owner.com:
// decir de frente para quién no es). Solo límites reales, revisados contra el
// código ese día:
//  - Sucursales: cada una es su propia cuenta (lib/marketing/verticals.ts FAQ
//    de sucursales; runbook "una cuenta = un restaurante").
//  - WhatsApp: no hay API; el dueño lo manda a mano (WinbackTodayList,
//    lib/receiptWhatsapp.ts, scripts/validate-no-automatic-whatsapp.mjs).
//  - Página web: sale del menú con un diseño ya hecho; el dueño sube logo y
//    fotos (app/vendor/configuracion), no arma la página pieza por pieza.
//  - Equipo: no vendemos equipo (app/hardware).
// Lo usan /precios (FAQ + JSON-LD) y /software-para-restaurantes.

export const NO_ES_PARA: { t: string; d: string }[] = [
  {
    t: "Si quieres ver todas tus sucursales juntas en una sola pantalla",
    d: "Hoy cada sucursal es su propia cuenta, con su menú, su Caja y sus reportes.",
  },
  {
    t: "Si quieres que los WhatsApp a tus clientes salgan solos",
    d: "Comeleal te dice a quién escribirle y te deja el mensaje escrito. Tú lo mandas desde tu celular.",
  },
  {
    t: "Si quieres diseñar tu página web a tu gusto, pieza por pieza",
    d: "Tu página sale de tu menú con un diseño ya hecho. Tú pones tu logo y tus fotos.",
  },
  {
    t: "Si necesitas que te vendan y te instalen el equipo",
    d: "No vendemos equipo. Funciona en el celular, la tablet o la computadora que ya tienes, y te decimos qué impresora sirve.",
  },
];

export const NO_ES_PARA_FAQ = {
  q: "¿Para quién NO es Comeleal?",
  a: NO_ES_PARA.map((x) => `${x.t}. ${x.d}`).join(" "),
};
