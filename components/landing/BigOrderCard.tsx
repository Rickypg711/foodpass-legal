"use client";

// "¿Pedido grande o evento?" (lib/landing/bigOrderMessage.ts). Cerrado es una
// línea y un botón; abierto, 5 datos y "Mandar por WhatsApp". Solo existe si el
// local tiene WhatsApp: sin él no hay a dónde mandar la cotización.

import { useState } from "react";
import { BIG_ORDER_KINDS, bigOrderMessage } from "@/lib/landing/bigOrderMessage";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { trackWebLandingWhatsappClick } from "@/lib/analytics";

const field =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[15px] text-[#1C2526] outline-none focus:border-[#25D366]";

export function BigOrderCard({
  restaurantId,
  restaurantName,
  whatsapp,
  phoneCountry,
  btnClass,
  textClass,
}: {
  restaurantId: string;
  restaurantName: string;
  whatsapp: string;
  /** Lo que devuelve phoneCountryOf(doc), el mismo que usa el botón de WhatsApp de la portada. */
  phoneCountry: string;
  btnClass: string;
  textClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(BIG_ORDER_KINDS[0]);
  const [date, setDate] = useState("");
  const [people, setPeople] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) {
    return (
      <div>
        <p className={`text-sm leading-relaxed ${textClass}`}>
          Oficina, fiesta, cumpleaños o equipo. Dinos la fecha y para cuántos, y te contestamos por WhatsApp.
        </p>
        <button type="button" onClick={() => setOpen(true)} className={`mt-3 w-full ${btnClass}`}>
          Cotizar un pedido grande
        </button>
      </div>
    );
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = bigOrderMessage({
      restaurantName,
      kind,
      date,
      people: people ? Number.parseInt(people, 10) : null,
      customerName,
      notes,
    });
    trackWebLandingWhatsappClick({ restaurantId, restaurantName });
    window.open(buildWhatsappUrl(whatsapp, text, phoneCountry), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={send} className="space-y-2.5">
      <label className={`block text-[13px] font-semibold ${textClass}`}>
        ¿Para qué es?
        <select className={`mt-1 ${field}`} value={kind} onChange={(e) => setKind(e.target.value)}>
          {BIG_ORDER_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className={`block text-[13px] font-semibold ${textClass}`}>
          ¿Para cuándo?
          <input className={`mt-1 ${field}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={`block text-[13px] font-semibold ${textClass}`}>
          ¿Cuántas personas?
          <input className={`mt-1 ${field}`} type="number" min={5} inputMode="numeric" required placeholder="20" value={people} onChange={(e) => setPeople(e.target.value)} />
        </label>
      </div>
      <label className={`block text-[13px] font-semibold ${textClass}`}>
        Tu nombre
        <input className={`mt-1 ${field}`} autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </label>
      <label className={`block text-[13px] font-semibold ${textClass}`}>
        ¿Algo más? <span className="font-normal opacity-70">(opcional)</span>
        <textarea className={`mt-1 ${field}`} rows={2} placeholder="Sin cebolla, que llegue a las 2, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="submit" className={`w-full ${btnClass}`}>
        💬 Mandar por WhatsApp
      </button>
    </form>
  );
}
