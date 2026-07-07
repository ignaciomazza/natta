import { getDateOnlyString, getDateOnlyWeekday } from "@/lib/date-only";
import { getPickupHoursForDate, getPickupHoursSummaryFromRules } from "@/lib/pickup-hours";
import { prisma } from "@/lib/prisma";

export async function getPickupHoursWindowForDate(
  value: string | Date | null | undefined,
) {
  const weekday = getDateOnlyWeekday(value);
  if (weekday === null) return null;
  const dateOnly = getDateOnlyString(value);

  const [weekdayRule, dateOverride] = await Promise.all([
    prisma.weekdayCapacityRule.findUnique({
      where: { weekday },
      select: {
        pickupStartMinutes: true,
        pickupEndMinutes: true,
      },
    }),
    dateOnly
      ? prisma.dateCapacityOverride.findUnique({
          where: { date: new Date(`${dateOnly}T12:00:00`) },
          select: {
            pickupStartMinutes: true,
            pickupEndMinutes: true,
          },
        })
      : null,
  ]);

  return {
    pickupStartMinutes:
      dateOverride?.pickupStartMinutes ?? weekdayRule?.pickupStartMinutes ?? null,
    pickupEndMinutes:
      dateOverride?.pickupEndMinutes ?? weekdayRule?.pickupEndMinutes ?? null,
  };
}

export async function getPickupHoursLabelForDate(
  value: string | Date | null | undefined,
) {
  const window = await getPickupHoursWindowForDate(value);
  return getPickupHoursForDate(value, window);
}

export async function getPickupHoursSummary() {
  const rules = await prisma.weekdayCapacityRule.findMany({
    orderBy: { weekday: "asc" },
    select: {
      weekday: true,
      isOpen: true,
      pickupStartMinutes: true,
      pickupEndMinutes: true,
    },
  });

  return getPickupHoursSummaryFromRules(rules);
}
