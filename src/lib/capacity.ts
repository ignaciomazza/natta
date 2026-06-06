import { prisma } from "@/lib/prisma";

export type CapacityDay = {
  date: string;
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  bookedUnits: number;
  availableUnits: number;
  minLeadTimeDays: number;
  cutoffHour: number;
  source: "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
};

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function getDefaultMinDate(reference = new Date(), minLeadTimeDays = 2) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + minLeadTimeDays);
  return date;
}

export function getWeekdayFromDateString(date: string) {
  return getDateAtNoon(date).getDay();
}

export async function getCapacityCalendar(input?: {
  from?: string;
  days?: number;
}) {
  const fromDate = input?.from
    ? getDateAtNoon(input.from)
    : getDefaultMinDate(new Date(), 0);
  const days = Math.max(1, Math.min(input?.days ?? 30, 120));

  const dateList = Array.from({ length: days }, (_, index) => {
    const cursor = new Date(fromDate);
    cursor.setDate(fromDate.getDate() + index);
    cursor.setHours(12, 0, 0, 0);
    return toDateOnlyString(cursor);
  });

  const [rules, overrides, orderItems] = await Promise.all([
    prisma.weekdayCapacityRule.findMany(),
    prisma.dateCapacityOverride.findMany({
      where: {
        date: {
          gte: new Date(`${dateList[0]}T00:00:00`),
          lte: new Date(`${dateList[dateList.length - 1]}T23:59:59`),
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: "CANCELLED",
          },
          deliveryDate: {
            gte: new Date(`${dateList[0]}T00:00:00`),
            lte: new Date(`${dateList[dateList.length - 1]}T23:59:59`),
          },
        },
      },
      select: {
        quantity: true,
        order: {
          select: {
            deliveryDate: true,
          },
        },
      },
    }),
  ]);

  const bookedUnitsByDate = new Map<string, number>();
  for (const item of orderItems) {
    const key = toDateOnlyString(item.order.deliveryDate);
    const current = bookedUnitsByDate.get(key) ?? 0;
    bookedUnitsByDate.set(key, current + item.quantity);
  }

  const ruleByWeekday = new Map(rules.map((rule) => [rule.weekday, rule]));
  const overrideByDate = new Map(
    overrides.map((override) => [toDateOnlyString(override.date), override]),
  );

  const calendar: CapacityDay[] = dateList.map((date) => {
    const weekday = getWeekdayFromDateString(date);
    const weekdayRule = ruleByWeekday.get(weekday);
    const override = overrideByDate.get(date);
    const bookedUnits = bookedUnitsByDate.get(date) ?? 0;
    const baseIsOpen = weekdayRule?.isOpen ?? weekday !== 0;
    const baseMaxUnits =
      typeof weekdayRule?.maxUnits === "number" ? weekdayRule.maxUnits : 20;

    const isOpen =
      override?.isClosed === true
        ? false
        : override
          ? true
          : baseIsOpen;

    const maxUnits =
      override?.maxUnits ??
      baseMaxUnits;

    const hasMeaningfulOverride =
      Boolean(override) && (isOpen !== baseIsOpen || maxUnits !== baseMaxUnits);

    const availableUnits = isOpen ? Math.max(0, maxUnits - bookedUnits) : 0;

    return {
      date,
      weekday,
      isOpen,
      maxUnits,
      bookedUnits,
      availableUnits,
      minLeadTimeDays: weekdayRule?.minLeadTimeDays ?? 2,
      cutoffHour: weekdayRule?.cutoffHour ?? 10,
      source: hasMeaningfulOverride ? "override" : "weekday",
      hasOverride: hasMeaningfulOverride,
      overrideNote: hasMeaningfulOverride ? (override?.note ?? null) : null,
    };
  });

  return calendar;
}

export async function validateCapacityForOrder(input: {
  deliveryDate: string;
  requestedUnits: number;
}) {
  const date = input.deliveryDate;
  const weekday = getWeekdayFromDateString(date);

  const [rule, override, existingItems] = await Promise.all([
    prisma.weekdayCapacityRule.findUnique({
      where: { weekday },
    }),
    prisma.dateCapacityOverride.findUnique({
      where: {
        date: getDateAtNoon(date),
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: "CANCELLED",
          },
          deliveryDate: getDateAtNoon(date),
        },
      },
      select: {
        quantity: true,
      },
    }),
  ]);

  const minimumDate = getDefaultMinDate(new Date(), rule?.minLeadTimeDays ?? 2);
  const requestedDate = getDateAtNoon(date);

  if (requestedDate < minimumDate) {
    throw new Error("DATE_TOO_SOON");
  }

  const now = new Date();
  const tomorrow = getDefaultMinDate(new Date(), 1);
  if (date === toDateOnlyString(tomorrow) && now.getHours() >= (rule?.cutoffHour ?? 10)) {
    throw new Error("CUTOFF_REACHED");
  }

  const isOpen =
    override?.isClosed === true
      ? false
      : override
        ? true
        : (rule?.isOpen ?? weekday !== 0);
  if (!isOpen) {
    throw new Error("DATE_CLOSED");
  }

  const maxUnits =
    override?.maxUnits ??
    (typeof rule?.maxUnits === "number" ? rule.maxUnits : 20);

  const bookedUnits = existingItems.reduce((sum, item) => sum + item.quantity, 0);
  const nextUnits = bookedUnits + input.requestedUnits;

  if (nextUnits > maxUnits) {
    throw new Error("CAPACITY_EXCEEDED");
  }

  return {
    maxUnits,
    bookedUnits,
    nextUnits,
  };
}

export function formatDateReadable(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(getDateAtNoon(date));
}
