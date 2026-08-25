"use client";

// Robo #5: los dos botones de servicio dentro del aviso de mesa. Un tap y el
// equipo lo ve en la Caja; 30 s de cooldown por botón para que un viernes
// lleno no se vuelva una metralleta de timbres.

import { useEffect, useState } from "react";
import {
  sendServiceRequest,
  serviceRequestCooldownMs,
  type ServiceRequestType,
} from "@/lib/order/serviceRequests";

const LABELS: Record<ServiceRequestType, { idle: string; sent: string }> = {
  call_waiter: { idle: "🛎️ Llamar al mesero", sent: "🛎️ Mesero avisado" },
  ask_bill: { idle: "🧾 Pedir la cuenta", sent: "🧾 Cuenta pedida" },
};

function ServiceButton({
  restaurantId,
  tableNumber,
  type,
}: {
  restaurantId: string;
  tableNumber: string;
  type: ServiceRequestType;
}) {
  const [cooldownMs, setCooldownMs] = useState(0);
  const [justSent, setJustSent] = useState(false);

  // El contador vive aunque recarguen la página (sessionStorage).
  useEffect(() => {
    setCooldownMs(serviceRequestCooldownMs(restaurantId, tableNumber, type));
    const t = setInterval(() => {
      setCooldownMs(serviceRequestCooldownMs(restaurantId, tableNumber, type));
    }, 1000);
    return () => clearInterval(t);
  }, [restaurantId, tableNumber, type]);

  const coolingDown = cooldownMs > 0;
  const label = justSent || coolingDown ? LABELS[type].sent : LABELS[type].idle;

  return (
    <button
      type="button"
      disabled={coolingDown}
      onClick={async () => {
        const result = await sendServiceRequest({ restaurantId, tableNumber, type });
        if (result === "sent") {
          setJustSent(true);
          setCooldownMs(serviceRequestCooldownMs(restaurantId, tableNumber, type));
        }
      }}
      className="flex-1 rounded-xl px-3 py-2 text-[12px] font-bold transition-all disabled:opacity-60"
      style={
        coolingDown || justSent
          ? { background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.55)" }
          : { background: "#F28C38", color: "#1C2526" }
      }
    >
      {label}
      {coolingDown ? ` · ${Math.ceil(cooldownMs / 1000)}s` : ""}
    </button>
  );
}

export function TableServiceButtons({
  restaurantId,
  tableNumber,
}: {
  restaurantId: string;
  tableNumber: string;
}) {
  if (!restaurantId || !tableNumber) return null;
  return (
    <div className="mt-2 flex gap-2">
      <ServiceButton restaurantId={restaurantId} tableNumber={tableNumber} type="call_waiter" />
      <ServiceButton restaurantId={restaurantId} tableNumber={tableNumber} type="ask_bill" />
    </div>
  );
}
