import { prisma } from "@/lib/prisma";

export type CapacityDay = {
  date: string;
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  manualMaxUnits: number;
  isAutoCapacity: boolean;
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
  sizes: FlavorSizeCapacityDay[];
};

export type FlavorSizeCapacityDay = {
  sizeId: string;
  sizeSlug: string;
  sizeName: string;
  isClosed: boolean;
  maxUnits: number | null;
  weekdayMaxUnits: number | null;
  bookedUnits: number;
  availableUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
};

type AutoCapacityFlavor = {
  isClosed: boolean;
  maxUnits: number | null;
  sizes: Array<{
    isClosed: boolean;
    maxUnits: number | null;
  }>;
};

const businessTimeZone = "America/Argentina/Buenos_Aires";
const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const businessHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: businessTimeZone,
  hour: "2-digit",
  hour12: false,
});

function getAutoCapacityMaxUnits(flavors: AutoCapacityFlavor[]) {
  return flavors.reduce((total, flavor) => {
    if (flavor.isClosed) return total;

    const openSizes = flavor.sizes.filter((size) => !size.isClosed);
    const cappedSizes = openSizes.filter((size) => size.maxUnits !== null);
    const sizeMaxUnits = cappedSizes.reduce(
      (sum, size) => sum + (size.maxUnits ?? 0),
      0,
    );

    if (flavor.maxUnits !== null) {
      return total + (
        openSizes.length > 0 && cappedSizes.length === openSizes.length
          ? Math.min(flavor.maxUnits, sizeMaxUnits)
          : flavor.maxUnits
      );
    }

    return total + sizeMaxUnits;
  }, 0);
}

function shouldUseAutoCapacity(input: {
  isOpen: boolean;
  isAutoCapacity: boolean;
  manualMaxUnits: number;
  autoMaxUnits: number;
}) {
  if (!input.isOpen) return false;
  return input.isAutoCapacity || (
    input.manualMaxUnits <= 0 && input.autoMaxUnits > 0
  );
}

function getDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function getUtcDate(value: string, hour = 12, minute = 0, second = 0, millisecond = 0) {
  const { year, month, day } = getDateParts(value);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
}

function toDateOnlyString(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBusinessDateString(reference: Date) {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(reference)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToDateString(value: string, days: number) {
  const date = getDateAtNoon(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

export function getDateRange(from: string, to = from) {
  return {
    gte: getUtcDate(from, 0),
    lte: getUtcDate(to, 23, 59, 59, 999),
  };
}

export function getBusinessHour(reference = new Date()) {
  const hour = Number(businessHourFormatter.format(reference));
  return hour === 24 ? 0 : hour;
}

function isMissingTableError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return code === "P2021" || code === "P2022";
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
  return getUtcDate(value);
}

export function getDefaultMinDate(reference = new Date(), minLeadTimeDays = 2) {
  return getDateAtNoon(
    addDaysToDateString(getBusinessDateString(reference), minLeadTimeDays),
  );
}

export function getWeekdayFromDateString(date: string) {
  return getDateAtNoon(date).getUTCDay();
}

export async function getCapacityCalendar(input?: {
  from?: string;
  days?: number;
}) {
  const fromDate = input?.from ?? toDateOnlyString(getDefaultMinDate(new Date(), 0));
  const days = Math.max(1, Math.min(input?.days ?? 30, 120));

  const dateList = Array.from({ length: days }, (_, index) =>
    addDaysToDateString(fromDate, index),
  );
  const dateRange = getDateRange(dateList[0], dateList[dateList.length - 1]);

  const [
    rules,
    overrides,
    flavorRules,
    flavorOverrides,
    flavorSizeRules,
    flavorSizeOverrides,
    activeFlavors,
    activePrices,
    orderItems,
  ] = await Promise.all([
    prisma.weekdayCapacityRule.findMany(),
    prisma.dateCapacityOverride.findMany({
      where: {
        date: dateRange,
      },
    }),
    withMissingCapacityTableFallback(
      () => prisma.weekdayFlavorCapacityRule.findMany(),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.dateFlavorCapacityOverride.findMany({
        where: {
          date: dateRange,
        },
      }),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.weekdayFlavorSizeCapacityRule.findMany(),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.dateFlavorSizeCapacityOverride.findMany({
        where: {
          date: dateRange,
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
    prisma.price.findMany({
      where: {
        flavor: { isActive: true },
        size: { isActive: true },
      },
      select: {
        flavorId: true,
        size: {
          select: {
            id: true,
            slug: true,
            name: true,
            sortOrder: true,
          },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: "CANCELLED",
          },
          deliveryDate: dateRange,
        },
      },
      select: {
        flavorId: true,
        sizeId: true,
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
  const bookedUnitsByDateFlavorAndSize = new Map<string, number>();
  for (const item of orderItems) {
    const key = toDateOnlyString(item.order.deliveryDate);
    const current = bookedUnitsByDate.get(key) ?? 0;
    bookedUnitsByDate.set(key, current + item.quantity);

    const flavorKey = `${key}::${item.flavorId}`;
    const currentFlavor = bookedUnitsByDateAndFlavor.get(flavorKey) ?? 0;
    bookedUnitsByDateAndFlavor.set(flavorKey, currentFlavor + item.quantity);

    const sizeKey = `${flavorKey}::${item.sizeId}`;
    const currentSize = bookedUnitsByDateFlavorAndSize.get(sizeKey) ?? 0;
    bookedUnitsByDateFlavorAndSize.set(sizeKey, currentSize + item.quantity);
  }

  const sizesByFlavor = new Map<
    string,
    Array<{ id: string; slug: string; name: string; sortOrder: number }>
  >();
  for (const price of activePrices) {
    const current = sizesByFlavor.get(price.flavorId) ?? [];
    current.push(price.size);
    sizesByFlavor.set(price.flavorId, current);
  }
  for (const sizes of sizesByFlavor.values()) {
    sizes.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
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
  const flavorSizeRuleByWeekdayFlavorAndSize = new Map(
    flavorSizeRules.map((rule) => [
      `${rule.weekday}::${rule.flavorId}::${rule.sizeId}`,
      rule,
    ]),
  );
  const flavorSizeOverrideByDateFlavorAndSize = new Map(
    flavorSizeOverrides.map((override) => [
      `${toDateOnlyString(override.date)}::${override.flavorId}::${override.sizeId}`,
      override,
    ]),
  );

  const calendar: CapacityDay[] = dateList.map((date) => {
    const weekday = getWeekdayFromDateString(date);
    const weekdayRule = ruleByWeekday.get(weekday);
    const override = overrideByDate.get(date);
    const bookedUnits = bookedUnitsByDate.get(date) ?? 0;
    const baseIsOpen = weekdayRule?.isOpen ?? weekday !== 0;
    const baseIsAutoCapacity = weekdayRule?.isAutoCapacity ?? false;
    const baseMaxUnits =
      typeof weekdayRule?.maxUnits === "number" ? weekdayRule.maxUnits : 20;

    const isOpen =
      override?.isClosed === true
        ? false
        : override
          ? true
          : baseIsOpen;

    const isAutoCapacity = override
      ? override.isAutoCapacity
      : baseIsAutoCapacity;
    const manualMaxUnits = override?.maxUnits ?? baseMaxUnits;
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
      const sizes: FlavorSizeCapacityDay[] = (sizesByFlavor.get(flavor.id) ?? []).map(
        (size) => {
          const sizeKey = `${flavorKey}::${size.id}`;
          const weekdaySizeRule = flavorSizeRuleByWeekdayFlavorAndSize.get(
            `${weekday}::${flavor.id}::${size.id}`,
          );
          const sizeOverride = flavorSizeOverrideByDateFlavorAndSize.get(sizeKey);
          const sizeBookedUnits =
            bookedUnitsByDateFlavorAndSize.get(sizeKey) ?? 0;
          const hasSizeOverride =
            Boolean(sizeOverride) &&
            (sizeOverride?.isClosed === true ||
              sizeOverride?.maxUnits !== null ||
              Boolean(sizeOverride?.note));
          const sizeWeekdayMaxUnits = weekdaySizeRule?.maxUnits ?? null;
          const sizeIsClosed = flavorIsClosed || sizeOverride?.isClosed === true;
          const sizeMaxUnits = sizeIsClosed
            ? 0
            : (sizeOverride?.maxUnits ?? sizeWeekdayMaxUnits);
          const sizeAvailableUnits = sizeMaxUnits === null
            ? null
            : Math.max(0, sizeMaxUnits - sizeBookedUnits);

          return {
            sizeId: size.id,
            sizeSlug: size.slug,
            sizeName: size.name,
            isClosed: sizeIsClosed,
            maxUnits: sizeMaxUnits,
            weekdayMaxUnits: sizeWeekdayMaxUnits,
            bookedUnits: sizeBookedUnits,
            availableUnits: sizeIsClosed ? 0 : sizeAvailableUnits,
            source: hasSizeOverride
              ? "override"
              : sizeWeekdayMaxUnits !== null
                ? "weekday"
                : "none",
            hasOverride: hasSizeOverride,
            overrideNote: hasSizeOverride ? (sizeOverride?.note ?? null) : null,
          };
        },
      );

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
        sizes,
      };
    });
    const autoMaxUnits = getAutoCapacityMaxUnits(flavors);
    const usesAutoCapacity = shouldUseAutoCapacity({
      isOpen,
      isAutoCapacity,
      manualMaxUnits,
      autoMaxUnits,
    });
    const maxUnits = isOpen
      ? usesAutoCapacity
        ? autoMaxUnits
        : manualMaxUnits
      : 0;
    const hasMeaningfulOverride =
      Boolean(override) &&
      (isOpen !== baseIsOpen ||
        manualMaxUnits !== baseMaxUnits ||
        usesAutoCapacity !== baseIsAutoCapacity);

    const availableUnits = isOpen ? Math.max(0, maxUnits - bookedUnits) : 0;

    return {
      date,
      weekday,
      isOpen,
      maxUnits,
      manualMaxUnits,
      isAutoCapacity: usesAutoCapacity,
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
  requestedFlavorSizeUnits?: Array<{
    flavorId: string;
    sizeId: string;
    quantity: number;
  }>;
}) {
  const date = input.deliveryDate;
  const weekday = getWeekdayFromDateString(date);
  const dateAtNoon = getDateAtNoon(date);
  const requestedByFlavor = new Map<string, number>();
  const hasExplicitFlavorUnits = Boolean(input.requestedFlavorUnits?.length);
  for (const item of input.requestedFlavorUnits ?? []) {
    const current = requestedByFlavor.get(item.flavorId) ?? 0;
    requestedByFlavor.set(item.flavorId, current + item.quantity);
  }
  const requestedByFlavorAndSize = new Map<
    string,
    { flavorId: string; sizeId: string; quantity: number }
  >();
  for (const item of input.requestedFlavorSizeUnits ?? []) {
    const key = `${item.flavorId}::${item.sizeId}`;
    const current = requestedByFlavorAndSize.get(key);
    requestedByFlavorAndSize.set(key, {
      flavorId: item.flavorId,
      sizeId: item.sizeId,
      quantity: (current?.quantity ?? 0) + item.quantity,
    });

    if (!hasExplicitFlavorUnits) {
      const currentFlavor = requestedByFlavor.get(item.flavorId) ?? 0;
      requestedByFlavor.set(item.flavorId, currentFlavor + item.quantity);
    }
  }
  const [
    rule,
    override,
    existingItems,
    flavorRules,
    flavorOverrides,
    flavorSizeRules,
    flavorSizeOverrides,
    activePrices,
  ] = await Promise.all([
    prisma.weekdayCapacityRule.findUnique({
      where: { weekday },
    }),
    prisma.dateCapacityOverride.findUnique({
      where: {
        date: dateAtNoon,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: "CANCELLED",
          },
          deliveryDate: dateAtNoon,
        },
      },
      select: {
        flavorId: true,
        sizeId: true,
        quantity: true,
      },
    }),
    withMissingCapacityTableFallback(
      () => prisma.weekdayFlavorCapacityRule.findMany({
        where: { weekday },
      }),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.dateFlavorCapacityOverride.findMany({
        where: { date: dateAtNoon },
      }),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.weekdayFlavorSizeCapacityRule.findMany({
        where: { weekday },
      }),
      [],
    ),
    withMissingCapacityTableFallback(
      () => prisma.dateFlavorSizeCapacityOverride.findMany({
        where: { date: dateAtNoon },
      }),
      [],
    ),
    prisma.price.findMany({
      where: {
        flavor: { isActive: true },
        size: { isActive: true },
      },
      select: {
        flavorId: true,
        sizeId: true,
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
  if (date === toDateOnlyString(tomorrow) && getBusinessHour(now) >= (rule?.cutoffHour ?? 10)) {
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

  const flavorRuleById = new Map(flavorRules.map((item) => [item.flavorId, item]));
  const flavorOverrideById = new Map(
    flavorOverrides.map((item) => [item.flavorId, item]),
  );
  const flavorSizeRuleByKey = new Map(
    flavorSizeRules.map((item) => [
      `${item.flavorId}::${item.sizeId}`,
      item,
    ]),
  );
  const flavorSizeOverrideByKey = new Map(
    flavorSizeOverrides.map((item) => [
      `${item.flavorId}::${item.sizeId}`,
      item,
    ]),
  );

  const isAutoCapacity = override
    ? override.isAutoCapacity
    : (rule?.isAutoCapacity ?? false);
  const manualMaxUnits =
    override?.maxUnits ??
    (typeof rule?.maxUnits === "number" ? rule.maxUnits : 20);
  const autoFlavors = new Map<string, AutoCapacityFlavor>();
  for (const price of activePrices) {
    const flavorRule = flavorRuleById.get(price.flavorId);
    const flavorOverride = flavorOverrideById.get(price.flavorId);
    const flavorMaxUnits =
      flavorOverride?.isClosed === true
        ? 0
        : (flavorOverride?.maxUnits ?? flavorRule?.maxUnits ?? null);
    const flavorIsClosed = flavorOverride?.isClosed === true;
    const sizeKey = `${price.flavorId}::${price.sizeId}`;
    const sizeRule = flavorSizeRuleByKey.get(sizeKey);
    const sizeOverride = flavorSizeOverrideByKey.get(sizeKey);
    const sizeIsClosed = flavorIsClosed || sizeOverride?.isClosed === true;
    const sizeMaxUnits = sizeIsClosed
      ? 0
      : (sizeOverride?.maxUnits ?? sizeRule?.maxUnits ?? null);
    const current = autoFlavors.get(price.flavorId) ?? {
      isClosed: flavorIsClosed,
      maxUnits: flavorMaxUnits,
      sizes: [],
    };

    current.isClosed = current.isClosed || flavorIsClosed;
    current.maxUnits = flavorMaxUnits;
    current.sizes.push({
      isClosed: sizeIsClosed,
      maxUnits: sizeMaxUnits,
    });
    autoFlavors.set(price.flavorId, current);
  }
  const autoMaxUnits = getAutoCapacityMaxUnits([...autoFlavors.values()]);
  const usesAutoCapacity = shouldUseAutoCapacity({
    isOpen,
    isAutoCapacity,
    manualMaxUnits,
    autoMaxUnits,
  });
  const maxUnits = usesAutoCapacity ? autoMaxUnits : manualMaxUnits;

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

  if (requestedByFlavorAndSize.size > 0) {
    const bookedByFlavorAndSize = new Map<string, number>();
    for (const item of existingItems) {
      const key = `${item.flavorId}::${item.sizeId}`;
      const current = bookedByFlavorAndSize.get(key) ?? 0;
      bookedByFlavorAndSize.set(key, current + item.quantity);
    }

    for (const item of requestedByFlavorAndSize.values()) {
      const key = `${item.flavorId}::${item.sizeId}`;
      const sizeRule = flavorSizeRuleByKey.get(key);
      const sizeOverride = flavorSizeOverrideByKey.get(key);
      const flavorRule = flavorRuleById.get(item.flavorId);
      const flavorOverride = flavorOverrideById.get(item.flavorId);
      const flavorMaxUnits =
        flavorOverride?.isClosed === true
          ? 0
          : (flavorOverride?.maxUnits ?? flavorRule?.maxUnits ?? null);
      const sizeMaxUnits =
        sizeOverride?.isClosed === true
          ? 0
          : (sizeOverride?.maxUnits ?? sizeRule?.maxUnits ?? null);

      if (usesAutoCapacity && flavorMaxUnits === null && sizeMaxUnits === null) {
        throw new Error("FLAVOR_SIZE_CAPACITY_EXCEEDED");
      }

      if (sizeMaxUnits === null) continue;

      const sizeBookedUnits = bookedByFlavorAndSize.get(key) ?? 0;
      if (sizeBookedUnits + item.quantity > sizeMaxUnits) {
        throw new Error("FLAVOR_SIZE_CAPACITY_EXCEEDED");
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
    timeZone: businessTimeZone,
  }).format(getDateAtNoon(date));
}
