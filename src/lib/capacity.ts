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
  flavors: FlavorCapacityDay[];
};

export type FlavorCapacityDay = {
  flavorId: string;
  flavorSlug: string;
  flavorName: string;
  isClosed: boolean;
  maxUnits: number | null;
  weekdayMaxUnits: number | null;
  bookedUnits: number;
  availableUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
};

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMissingTableError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return code === "P2021";
}

export function isCapacitySchemaUnavailableError(error: unknown) {
  if (isMissingTableError(error)) return true;
  if (!(error instanceof TypeError)) return false;
  return error.message.includes("Cannot read properties of undefined");
}

export async function withMissingCapacityTableFallback<T>(
  query: () => Promise<T>,
  fallback: T,
) {
  try {
    return await query();
  } catch (error) {
    if (isCapacitySchemaUnavailableError(error)) {
      return fallback;
    }
    throw error;
  }
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

  const [rules, overrides, flavorRules, flavorOverrides, activeFlavors, orderItems] =
    await Promise.all([
    prisma.weekdayCapacityRule.findMany(),
    prisma.dateCapacityOverride.findMany({
      where: {
        date: {
          gte: new Date(`${dateList[0]}T00:00:00`),
          lte: new Date(`${dateList[dateList.length - 1]}T23:59:59`),
        },
      },
    }),
    withMissingCapacityTableFallback(
      () => prisma.weekdayFlavorCapacityRule.findMany(),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.dateFlavorCapacityOverride.findMany({
        where: {
          date: {
            gte: new Date(`${dateList[0]}T00:00:00`),
            lte: new Date(`${dateList[dateList.length - 1]}T23:59:59`),
          },
        },
      }),
      [],
    ),
    prisma.flavor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
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
        flavorId: true,
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
  const bookedUnitsByDateAndFlavor = new Map<string, number>();
  for (const item of orderItems) {
    const key = toDateOnlyString(item.order.deliveryDate);
    const current = bookedUnitsByDate.get(key) ?? 0;
    bookedUnitsByDate.set(key, current + item.quantity);

    const flavorKey = `${key}::${item.flavorId}`;
    const currentFlavor = bookedUnitsByDateAndFlavor.get(flavorKey) ?? 0;
    bookedUnitsByDateAndFlavor.set(flavorKey, currentFlavor + item.quantity);
  }

  const ruleByWeekday = new Map(rules.map((rule) => [rule.weekday, rule]));
  const overrideByDate = new Map(
    overrides.map((override) => [toDateOnlyString(override.date), override]),
  );
  const flavorRuleByWeekdayAndFlavor = new Map(
    flavorRules.map((rule) => [`${rule.weekday}::${rule.flavorId}`, rule]),
  );
  const flavorOverrideByDateAndFlavor = new Map(
    flavorOverrides.map((override) => [
      `${toDateOnlyString(override.date)}::${override.flavorId}`,
      override,
    ]),
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
    const flavors: FlavorCapacityDay[] = activeFlavors.map((flavor) => {
      const flavorKey = `${date}::${flavor.id}`;
      const weekdayFlavorRule = flavorRuleByWeekdayAndFlavor.get(
        `${weekday}::${flavor.id}`,
      );
      const flavorOverride = flavorOverrideByDateAndFlavor.get(flavorKey);
      const flavorBookedUnits = bookedUnitsByDateAndFlavor.get(flavorKey) ?? 0;
      const hasFlavorOverride =
        Boolean(flavorOverride) &&
        (flavorOverride?.isClosed === true ||
          flavorOverride?.maxUnits !== null ||
          Boolean(flavorOverride?.note));
      const weekdayMaxUnits = weekdayFlavorRule?.maxUnits ?? null;
      const flavorIsClosed = !isOpen || flavorOverride?.isClosed === true;
      const flavorMaxUnits = flavorIsClosed
        ? 0
        : (flavorOverride?.maxUnits ?? weekdayMaxUnits);
      const flavorAvailableUnits = flavorMaxUnits === null
        ? null
        : Math.max(0, flavorMaxUnits - flavorBookedUnits);

      return {
        flavorId: flavor.id,
        flavorSlug: flavor.slug,
        flavorName: flavor.name,
        isClosed: flavorIsClosed,
        maxUnits: flavorMaxUnits,
        weekdayMaxUnits,
        bookedUnits: flavorBookedUnits,
        availableUnits: flavorIsClosed ? 0 : flavorAvailableUnits,
        source: hasFlavorOverride
          ? "override"
          : weekdayMaxUnits !== null
            ? "weekday"
            : "none",
        hasOverride: hasFlavorOverride,
        overrideNote: hasFlavorOverride ? (flavorOverride?.note ?? null) : null,
      };
    });

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
      flavors,
    };
  });

  return calendar;
}

export async function validateCapacityForOrder(input: {
  deliveryDate: string;
  requestedUnits: number;
  requestedFlavorUnits?: Array<{
    flavorId: string;
    quantity: number;
  }>;
}) {
  const date = input.deliveryDate;
  const weekday = getWeekdayFromDateString(date);
  const requestedByFlavor = new Map<string, number>();
  for (const item of input.requestedFlavorUnits ?? []) {
    const current = requestedByFlavor.get(item.flavorId) ?? 0;
    requestedByFlavor.set(item.flavorId, current + item.quantity);
  }
  const requestedFlavorIds = [...requestedByFlavor.keys()];

  const [rule, override, existingItems, flavorRules, flavorOverrides] =
    await Promise.all([
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
        flavorId: true,
        quantity: true,
      },
    }),
    requestedFlavorIds.length
      ? withMissingCapacityTableFallback(
          () => prisma.weekdayFlavorCapacityRule.findMany({
            where: {
              weekday,
              flavorId: {
                in: requestedFlavorIds,
              },
            },
          }),
          [],
        )
      : Promise.resolve([]),
    requestedFlavorIds.length
      ? withMissingCapacityTableFallback(
          () => prisma.dateFlavorCapacityOverride.findMany({
            where: {
              date: getDateAtNoon(date),
              flavorId: {
                in: requestedFlavorIds,
              },
            },
          }),
          [],
        )
      : Promise.resolve([]),
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

  if (requestedByFlavor.size > 0) {
    const bookedByFlavor = new Map<string, number>();
    for (const item of existingItems) {
      const current = bookedByFlavor.get(item.flavorId) ?? 0;
      bookedByFlavor.set(item.flavorId, current + item.quantity);
    }

    const flavorRuleById = new Map(flavorRules.map((item) => [item.flavorId, item]));
    const flavorOverrideById = new Map(
      flavorOverrides.map((item) => [item.flavorId, item]),
    );

    for (const [flavorId, requestedUnits] of requestedByFlavor) {
      const flavorRule = flavorRuleById.get(flavorId);
      const flavorOverride = flavorOverrideById.get(flavorId);
      const flavorMaxUnits =
        flavorOverride?.isClosed === true
          ? 0
          : (flavorOverride?.maxUnits ?? flavorRule?.maxUnits ?? null);

      if (flavorMaxUnits === null) continue;

      const flavorBookedUnits = bookedByFlavor.get(flavorId) ?? 0;
      if (flavorBookedUnits + requestedUnits > flavorMaxUnits) {
        throw new Error("FLAVOR_CAPACITY_EXCEEDED");
      }
    }
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
