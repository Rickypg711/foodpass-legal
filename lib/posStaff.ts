// lib/posStaff.ts
//
// Equipo de la caja (estilo Square): perfiles de staff con PIN de 4 dígitos,
// SIN necesidad de cuenta. Viven en restaurants/{rid}/posStaff/{id}.
// El dueño los administra en Configuración; la caja muestra el switcher
// "¿Quién cobra?" y cada orden se estampa con soldBy = {staffId, name}.
// Lectura: associates del venue. Escritura: owner/manager (rules).

export type PosStaffRole = "cajero" | "gerente";

export type PosStaffMember = {
  id: string;
  name: string;
  /** 4 dígitos. Se compara en cliente contra el roster (legible solo por associates). */
  pin: string;
  role: PosStaffRole;
  active: boolean;
};

export type SoldBy = { staffId: string; name: string };

export function parsePosStaff(
  docs: { id: string; data: () => Record<string, unknown> | undefined }[],
): PosStaffMember[] {
  const out: PosStaffMember[] = [];
  for (const d of docs) {
    const m = d.data() ?? {};
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const pin = typeof m.pin === "string" ? m.pin.replace(/\D/g, "") : "";
    if (!name || pin.length !== 4) continue;
    out.push({
      id: d.id,
      name,
      pin,
      role: m.role === "gerente" ? "gerente" : "cajero",
      active: m.active !== false,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function findStaffByPin(
  roster: PosStaffMember[],
  pinDigits: string,
): PosStaffMember | null {
  const pin = pinDigits.replace(/\D/g, "");
  if (pin.length !== 4) return null;
  return roster.find((s) => s.active && s.pin === pin) ?? null;
}
