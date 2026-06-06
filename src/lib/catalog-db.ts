import { prisma } from "@/lib/prisma";
import { applyPriceMultiplier } from "@/lib/price-adjustments";

export const sizeSlugToId = {
  latta: "latta",
  chica: "chica",
  grande: "grande",
} as const;

export type SizeSlug = keyof typeof sizeSlugToId;

export async function getActiveCatalog() {
  const [flavors, sizes, prices] = await Promise.all([
    prisma.flavor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    }),
    prisma.size.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        servings: true,
        diameterCm: true,
      },
    }),
    prisma.price.findMany({
      select: {
        id: true,
        flavorId: true,
        sizeId: true,
        amountArs: true,
      },
    }),
  ]);

  const sizeMap = new Map(sizes.map((size) => [size.id, size]));
  const pricesByFlavor = new Map<
    string,
    Array<{ sizeId: string; amountArs: number }>
  >();

  for (const price of prices) {
    const current = pricesByFlavor.get(price.flavorId) ?? [];
    current.push({ sizeId: price.sizeId, amountArs: price.amountArs });
    pricesByFlavor.set(price.flavorId, current);
  }

  return {
    flavors: flavors.map((flavor) => {
      const flavorPrices = pricesByFlavor.get(flavor.id) ?? [];
      const mapped = flavorPrices
        .map((price) => {
          const size = sizeMap.get(price.sizeId);
          if (!size) return null;
          return {
            sizeId: size.id,
            sizeSlug: size.slug,
            sizeName: size.name,
            amountArs: applyPriceMultiplier(price.amountArs),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        ...flavor,
        prices: mapped,
      };
    }),
    sizes,
  };
}
