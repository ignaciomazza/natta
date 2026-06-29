const SATURDAY = 6;

export const PICKUP_HOURS_SUMMARY =
  "Retiros: lunes a viernes de 11 a 18 h; sábados de 11 a 14 h.";

function toPickupDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date =
    typeof value === "string"
      ? new Date(value.includes("T") ? value : `${value}T12:00:00`)
      : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getPickupHoursRangeForDate(value: string | Date | null | undefined) {
  const date = toPickupDate(value);

  return date?.getDay() === SATURDAY ? "11 a 14 h" : "11 a 18 h";
}

export function getPickupHoursForDate(value: string | Date | null | undefined) {
  return `Retiro de ${getPickupHoursRangeForDate(value)}`;
}

export function getAvailablePickupCopyForDate(
  value: string | Date | null | undefined,
) {
  return `Disponible (${getPickupHoursRangeForDate(value)})`;
}
