import { getDateOnlyWeekday } from "@/lib/date-only";

const SATURDAY = 6;

export const PICKUP_HOURS_SUMMARY =
  "Retiros: lunes a viernes de 11 a 18 h; sábados de 11 a 14 h.";

export function getPickupHoursRangeForDate(value: string | Date | null | undefined) {
  return getDateOnlyWeekday(value) === SATURDAY ? "11 a 14 h" : "11 a 18 h";
}

export function getPickupHoursForDate(value: string | Date | null | undefined) {
  return `Retiro de ${getPickupHoursRangeForDate(value)}`;
}

export function getAvailablePickupCopyForDate(
  value: string | Date | null | undefined,
) {
  return `Disponible (${getPickupHoursRangeForDate(value)})`;
}
