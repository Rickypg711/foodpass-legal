// lib/businessDay.ts
//
// JORNADA COMERCIAL — el "hoy" real de un restaurante no termina a
// medianoche: termina cuando cierra. Un local que abre 4 PM y cierra 2 AM
// sigue en LA MISMA jornada a la 1 AM; cortar a las 00:00 le "borra" el día
// al dueño a media operación (bug real de Luzz/Pecado, jul 2026).
//
// Solución estándar de la industria (Square/Toast): un CORTE fijo de jornada
// en la madrugada. Todo lo que pasa entre medianoche y el corte pertenece a
// la jornada anterior. Default: 4 AM — después del cierre de bares (2-3 AM)
// y antes del desayuno más temprano (6-7 AM).
//
// PARIDAD: espejo exacto de FOODPASS lib/utils/business_day.dart. Cualquier
// cambio se hace en ambos lados. Tiempos en hora local del dispositivo
// (misma convención que businessHours).

export const BUSINESS_DAY_CUTOFF_HOUR = 4;

/** Corte efectivo para un venue: campo opcional `businessDayCutoffHour`
 * clampeado a 0-11; default 4 AM. Sin migración: ausente = 4. */
export function resolveBusinessDayCutoffHour(
  restaurantData: Record<string, unknown> | undefined | null,
): number {
  const raw = restaurantData?.businessDayCutoffHour;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const v = Math.trunc(raw);
    if (v >= 0 && v <= 11) return v;
  }
  return BUSINESS_DAY_CUTOFF_HOUR;
}

/** Inicio de la jornada EN CURSO en `at` (default: ahora).
 * A las 3:59 AM con corte 4 → ayer a las 4:00 AM (misma jornada).
 * A las 4:00 AM con corte 4 → hoy a las 4:00 AM (jornada nueva). */
export function businessDayStart(
  at: Date = new Date(),
  cutoffHour: number = BUSINESS_DAY_CUTOFF_HOUR,
): Date {
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate(), cutoffHour);
  if (at.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

/** Inicio de la jornada `daysAgo` jornadas atrás (0 = la actual).
 * Para rangos "últimos 7 días" usar daysAgo = 6 (incluye la actual). */
export function businessDayStartDaysAgo(
  daysAgo: number,
  at: Date = new Date(),
  cutoffHour: number = BUSINESS_DAY_CUTOFF_HOUR,
): Date {
  const d = businessDayStart(at, cutoffHour);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Llave `y-m-d` de la jornada a la que pertenece `moment` — la llave
 * correcta para agrupar ventas/visitas por día: una venta a la 1 AM cae en
 * la jornada de AYER, no en la fecha calendario de hoy. Mismo formato que
 * las llaves de buckets existentes en Reportes. */
export function businessDayKey(
  moment: Date,
  cutoffHour: number = BUSINESS_DAY_CUTOFF_HOUR,
): string {
  const d = businessDayStart(moment, cutoffHour);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
