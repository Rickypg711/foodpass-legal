"use client";

// Selector de país del teléfono — bandera + código, como lo hacen los
// formularios buenos (5-sep-2026, pedido de Ricardo viendo el de iClosed).
// Vive junto a un campo de 10 dígitos; el país cambia, los 10 dígitos no.
// Lista corta a propósito: sólo países con número nacional de 10 dígitos
// (ver lib/phone/phoneCountry.ts).

import { PHONE_COUNTRIES } from "@/lib/phone/phoneCountry";

export function PhoneCountrySelect({
  value,
  onChange,
  disabled = false,
  className = "",
  ariaLabel = "País del teléfono",
}: {
  /** Código de país en dígitos ("52", "1", "57"). */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  // DO y US comparten "+1": el <select> necesita un valor único por opción,
  // así que el valor es el índice y el país se traduce al salir.
  const selectedIndex = Math.max(
    0,
    PHONE_COUNTRIES.findIndex((c) => c.code === value),
  );
  return (
    <select
      aria-label={ariaLabel}
      value={String(selectedIndex)}
      disabled={disabled}
      onChange={(e) => {
        const c = PHONE_COUNTRIES[Number(e.target.value)];
        if (c) onChange(c.code);
      }}
      className={`rounded-xl border border-[#1C2526]/12 bg-[#F5F3EF] px-2.5 py-2.5 text-[13px] text-[#1C2526] outline-none focus:border-[#F28C38] disabled:opacity-50 ${className}`}
    >
      {PHONE_COUNTRIES.map((c, i) => (
        <option key={`${c.code}-${c.label}`} value={String(i)}>
          {c.flag} +{c.code} · {c.label}
        </option>
      ))}
    </select>
  );
}
