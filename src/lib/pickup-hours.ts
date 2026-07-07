import { getDateOnlyWeekday } from "@/lib/date-only";

export type PickupHoursWindow = {
  pickupStartMinutes?: number | null;
  pickupEndMinutes?: number | null;
};

export type PickupHoursDay = PickupHoursWindow & {
  date?: string | Date | null;
  isOpen?: boolean | null;
  weekday?: number | null;
};

const SATURDAY = 6;
const SUNDAY = 0;

export const DEFAULT_PICKUP_START_MINUTES = 11 * 60;
export const DEFAULT_PICKUP_END_MINUTES = 18 * 60;
export const DEFAULT_SATURDAY_PICKUP_END_MINUTES = 14 * 60;

export const PICKUP_HOURS_SUMMARY =
  "Retiros: lunes a viernes de 11 a 18 h; sábados de 11 a 14 h.";

export function getDefaultPickupWindowForWeekday(
  weekday: number | null | undefined,
) {
  return {
    pickupStartMinutes: DEFAULT_PICKUP_START_MINUTES,
    pickupEndMinutes:
      weekday === SATURDAY
        ? DEFAULT_SATURDAY_PICKUP_END_MINUTES
        : DEFAULT_PICKUP_END_MINUTES,
  };
}

export function minutesToTimeInput(minutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatPickupMinutes(minutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return mins === 0
    ? String(hours)
    : `${hours}:${String(mins).padStart(2, "0")}`;
}

export function getPickupWindowForDate(
  value: string | Date | null | undefined,
  window?: PickupHoursWindow | null,
) {
  const weekday = getDateOnlyWeekday(value);
  const fallback = getDefaultPickupWindowForWeekday(weekday);

  return {
    pickupStartMinutes:
      typeof window?.pickupStartMinutes === "number"
        ? window.pickupStartMinutes
        : fallback.pickupStartMinutes,
    pickupEndMinutes:
      typeof window?.pickupEndMinutes === "number"
        ? window.pickupEndMinutes
        : fallback.pickupEndMinutes,
  };
}

export function getPickupHoursRangeForDate(
  value: string | Date | null | undefined,
  window?: PickupHoursWindow | null,
) {
  const resolved = getPickupWindowForDate(value, window);
  return `${formatPickupMinutes(resolved.pickupStartMinutes)} a ${formatPickupMinutes(
    resolved.pickupEndMinutes,
  )} h`;
}

export function getPickupHoursForDate(
  value: string | Date | null | undefined,
  window?: PickupHoursWindow | null,
) {
  return `Retiro de ${getPickupHoursRangeForDate(value, window)}`;
}

export function getAvailablePickupCopyForDate(
  value: string | Date | null | undefined,
  window?: PickupHoursWindow | null,
) {
  return `Disponible (${getPickupHoursRangeForDate(value, window)})`;
}

const weekdayNames = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];

function getWeekdayRangeLabel(start: number, end: number) {
  return `${formatPickupMinutes(start)} a ${formatPickupMinutes(end)} h`;
}

function compressWeekdayLabels(weekdays: number[]) {
  const order = [1, 2, 3, 4, 5, 6, SUNDAY];
  const sorted = [...weekdays].sort(
    (left, right) => order.indexOf(left) - order.indexOf(right),
  );
  const labels: string[] = [];
  let index = 0;

  while (index < sorted.length) {
    const start = sorted[index];
    let end = start;

    while (
      order.indexOf(sorted[index + 1]) === order.indexOf(end) + 1 &&
      sorted[index + 1] !== SUNDAY
    ) {
      index += 1;
      end = sorted[index];
    }

    labels.push(
      start === end
        ? weekdayNames[start]
        : `${weekdayNames[start]} a ${weekdayNames[end]}`,
    );
    index += 1;
  }

  return labels.join(", ");
}

export function getPickupHoursSummaryFromRules(rules: PickupHoursDay[]) {
  if (!rules.length) return PICKUP_HOURS_SUMMARY;

  const groups = new Map<string, number[]>();
  for (const weekday of [1, 2, 3, 4, 5, 6, SUNDAY]) {
    const rule = rules.find((item) => item.weekday === weekday);
    const isOpen = rule ? rule.isOpen !== false : weekday !== SUNDAY;
    if (!isOpen) continue;

    const fallback = getDefaultPickupWindowForWeekday(weekday);
    const start = rule?.pickupStartMinutes ?? fallback.pickupStartMinutes;
    const end = rule?.pickupEndMinutes ?? fallback.pickupEndMinutes;
    const key = `${start}-${end}`;
    groups.set(key, [...(groups.get(key) ?? []), weekday]);
  }

  const segments = [...groups.entries()]
    .map(([key, weekdays]) => {
      const [start, end] = key.split("-").map(Number);
      return `${compressWeekdayLabels(weekdays)} de ${getWeekdayRangeLabel(
        start,
        end,
      )}`;
    })
    .filter(Boolean);

  return segments.length
    ? `Retiros: ${segments.join("; ")}.`
    : "Retiros: consultar disponibilidad.";
}
