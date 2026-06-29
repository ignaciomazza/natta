const businessTimeZone = "America/Argentina/Buenos_Aires";
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}/;

const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getUtcDate(
  value: string,
  hour = 12,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
}

function getDateOnlyFromParts(parts: Record<string, string>) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getBusinessDateOnlyString(reference = new Date()) {
  return getDateOnlyFromParts(
    Object.fromEntries(
      businessDateFormatter
        .formatToParts(reference)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    ),
  );
}

export function getDateOnlyString(value: string | Date | null | undefined) {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(dateOnlyPattern);
    if (match) return match[0];

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return getDateOnlyString(parsed);
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDateOnlyDays(value: string, days: number) {
  const date = getUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return getDateOnlyString(date);
}

export function getDateOnlyStart(value: string) {
  return getUtcDate(value, 0);
}

export function getDateOnlyEnd(value: string) {
  return getUtcDate(value, 23, 59, 59, 999);
}

export function getDateOnlyRange(from: string, to = from) {
  return {
    gte: getDateOnlyStart(from),
    lte: getDateOnlyEnd(to),
  };
}

export function getDateOnlyWeekday(value: string | Date | null | undefined) {
  const dateOnly = getDateOnlyString(value);
  if (!dateOnly) return null;
  return getUtcDate(dateOnly).getUTCDay();
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
) {
  const dateOnly = getDateOnlyString(value);
  if (!dateOnly) return "";

  return new Intl.DateTimeFormat("es-AR", {
    ...options,
    timeZone: "UTC",
  }).format(getUtcDate(dateOnly));
}
