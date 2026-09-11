import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Branch } from "@/lib/branches";
import {
  cobotsRequest,
  getCommerceBridge,
  CommerceBridgeError,
} from "./commerce-bridge";
import type { CapacityDay } from "@/lib/capacity";
import { getPickupHoursSummaryFromRules } from "@/lib/pickup-hours";
const productSchema = z.object({
  id: z.string(),
  publicName: z.string(),
  shortDescription: z.string(),
  variants: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      priceFinal: z.number().int().nonnegative(),
      isAvailable: z.boolean(),
    }),
  ),
});
const capacitySchema = z
  .object({
    capacity: z.number().nullable(),
    bookedUnits: z.number(),
    remainingUnits: z.number().nullable(),
  })
  .passthrough();
const daySchema = z.object({
  fulfillmentDate: z.string(),
  weekday: z.number(),
  isOpen: z.boolean(),
  capacity: z.number().nullable(),
  capacityMode: z.string(),
  windowStartMinutes: z.number().nullable(),
  windowEndMinutes: z.number().nullable(),
  variants: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string(),
      available: z.boolean(),
      day: capacitySchema.nullable(),
      product: capacitySchema.nullable(),
      capacity: capacitySchema.nullable(),
    }),
  ),
});
export async function readCommerceProducts() {
  const all: z.infer<typeof productSchema>[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = z
      .object({ items: z.array(productSchema), total: z.number() })
      .parse(
        await cobotsRequest(
          `/api/storefront/products?limit=100&offset=${offset}`,
        ),
      );
    all.push(...page.items);
    if (all.length >= page.total || !page.items.length) return all;
  }
  throw new CommerceBridgeError("No se pudo completar el catálogo.");
}
export async function getCommerceCatalog(branch: Branch) {
  const bridge = await getCommerceBridge();
  if (!bridge) throw new CommerceBridgeError("Falta configurar el catálogo.");
  const [products, flavors, sizes] = await Promise.all([
    readCommerceProducts(),
    prisma.flavor.findMany({ orderBy: { name: "asc" } }),
    prisma.size.findMany({
      where: { slug: { in: [...branch.allowedSizeSlugs] } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return {
    flavors: flavors.flatMap((flavor) => {
      const mapped = bridge.settings.variants.filter(
        (v) => v.flavorId === flavor.id,
      );
      const product = products.find((p) => p.id === mapped[0]?.productId);
      if (!product) return [];
      const prices = mapped.flatMap((mapping) => {
        const size = sizes.find((s) => s.id === mapping.sizeId),
          variant = product.variants.find(
            (v) => v.id === mapping.variantId && v.isAvailable,
          );
        return size && variant
          ? [
              {
                sizeId: size.id,
                sizeSlug: size.slug,
                sizeName: variant.label || size.name,
                amountArs: variant.priceFinal,
              },
            ]
          : [];
      });
      return prices.length
        ? [
            {
              id: flavor.id,
              slug: flavor.slug,
              name: product.publicName,
              description: product.shortDescription || flavor.description,
              prices,
            },
          ]
        : [];
    }),
    sizes,
  };
}
export async function getCommerceCalendar(
  branch: Branch,
): Promise<{ calendar: CapacityDay[]; pickupHoursSummary: string }> {
  const bridge = await getCommerceBridge();
  if (!bridge) throw new CommerceBridgeError("Falta configurar el calendario.");
  const target = bridge.settings.branches[branch.code];
  const [result, flavors, sizes] = await Promise.all([
    cobotsRequest(
      `/api/storefront/availability?scheduleId=${encodeURIComponent(target.scheduleId)}`,
    ),
    prisma.flavor.findMany(),
    prisma.size.findMany({
      where: { slug: { in: [...branch.allowedSizeSlugs] } },
    }),
  ]);
  const data = z
    .object({
      schedules: z.array(
        z.object({ id: z.string(), days: z.array(daySchema) }),
      ),
    })
    .parse(result);
  const schedule = data.schedules.find((s) => s.id === target.scheduleId);
  if (!schedule)
    throw new CommerceBridgeError("El calendario no está disponible.");
  // Cobots already evaluates time zone, lead times and cutoffs. The legacy UI
  // receives zero additional lead time so it does not evaluate them a second time.
  const calendar: CapacityDay[] = schedule.days.slice(0, 21).map((day) => {
    const active = day.variants.filter(
      (v) =>
        v.available &&
        bridge.settings.variants.some(
          (m) =>
            m.variantId === v.variantId && sizes.some((s) => s.id === m.sizeId),
        ),
    );
    const example = active[0]?.day;
    return {
      date: day.fulfillmentDate,
      weekday: day.weekday,
      isOpen: day.isOpen && active.length > 0,
      maxUnits: day.capacity ?? 99999,
      manualMaxUnits: day.capacity ?? 99999,
      isAutoCapacity: day.capacityMode === "DERIVED",
      bookedUnits: example?.bookedUnits ?? 0,
      availableUnits: active.length
        ? example?.remainingUnits == null
          ? 99999
          : example.remainingUnits + 1
        : 0,
      minLeadTimeDays: 0,
      ignoreLeadTime: true,
      cutoffHour: 24,
      pickupStartMinutes: day.windowStartMinutes ?? 0,
      pickupEndMinutes: day.windowEndMinutes ?? 0,
      weekdayPickupStartMinutes: day.windowStartMinutes ?? 0,
      weekdayPickupEndMinutes: day.windowEndMinutes ?? 0,
      source: "weekday",
      hasOverride: false,
      overrideNote: null,
      flavors: flavors.map((flavor) => {
        const mapped = bridge.settings.variants.filter(
            (m) => m.flavorId === flavor.id,
          ),
          product = active.find((v) =>
            mapped.some((m) => m.variantId === v.variantId),
          )?.product;
        return {
          flavorId: flavor.id,
          flavorSlug: flavor.slug,
          flavorName: flavor.name,
          isClosed: !product,
          maxUnits: product?.capacity ?? null,
          weekdayMaxUnits: null,
          bookedUnits: product?.bookedUnits ?? 0,
          availableUnits: product
            ? product.remainingUnits == null
              ? null
              : product.remainingUnits + 1
            : 0,
          source: "none",
          hasOverride: false,
          overrideNote: null,
          sizes: sizes.map((size) => {
            const mapping = mapped.find((m) => m.sizeId === size.id),
              variant = active.find((v) => v.variantId === mapping?.variantId);
            return {
              sizeId: size.id,
              sizeSlug: size.slug,
              sizeName: size.name,
              isClosed: !variant,
              maxUnits: variant?.capacity?.capacity ?? null,
              weekdayMaxUnits: null,
              bookedUnits: variant?.capacity?.bookedUnits ?? 0,
              availableUnits: variant
                ? variant.capacity?.remainingUnits == null
                  ? null
                  : variant.capacity.remainingUnits + 1
                : 0,
              source: "none",
              hasOverride: false,
              overrideNote: null,
            };
          }),
        };
      }),
    };
  });
  const rules = schedule.days
    .slice(0, 7)
    .map((d) => ({
      weekday: d.weekday,
      isOpen: d.isOpen,
      pickupStartMinutes: d.windowStartMinutes,
      pickupEndMinutes: d.windowEndMinutes,
    }));
  return {
    calendar,
    pickupHoursSummary: getPickupHoursSummaryFromRules(rules),
  };
}
