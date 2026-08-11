import { prisma } from "@/lib/prisma";
import { applyPriceMultiplier } from "@/lib/price-adjustments";
import {
  defaultBranch,
  isSizeAvailableAtBranch,
  type Branch,
} from "@/lib/branches";

export const sizeSlugToId = {
  latta: "latta",
  chica: "chica",
  grande: "grande",
} as const;

export type SizeSlug = keyof typeof sizeSlugToId;

const unavailableCatalogPairs = new Set(["brulee::chica", "brulee::grande"]);

export function isCatalogPairAvailable(flavorSlug: string, sizeSlug: string) {
  return !unavailableCatalogPairs.has(`${flavorSlug}::${sizeSlug}`);
}

export function isCatalogPairAvailableAtBranch(
  branch: Branch,
  flavorSlug: string,
  sizeSlug: string,
) {
  return (
    isSizeAvailableAtBranch(branch, sizeSlug) &&
    isCatalogPairAvailable(flavorSlug, sizeSlug)
  );
}

const flavorDescriptionOverrides: Partial<Record<string, string>> = {
  argenta: "Dulce de leche.",
  blanca: "Chocolate blanco.",
  brulee: "Crème brûlée con crocante de caramelo.",
  choco: "60% cacao.",
  duo: "Chocolate blanco y Oreos.",
  limu: "Lima.",
  mocha: "Café con base de chocolate.",
  natta: "Clásica de queso.",
  tachio: "Pistachos.",
  tella: "Avellanas.",
};

const sizeContentOverrides: Partial<
  Record<
    SizeSlug,
    {
      description: string;
      servings: string;
      diameterCm: number;
      grams: number;
    }
  >
> = {
  latta: {
    description: "11 cm · 300 g",
    servings: "Cuchareable individual",
    diameterCm: 11,
    grams: 300,
  },
  chica: {
    description: "15 cm · 950 g aprox.",
    servings: "Entre 4 y 6 porciones",
    diameterCm: 15,
    grams: 950,
  },
  grande: {
    description: "24 cm · 2 kg aprox.",
    servings: "Entre 10 y 12 porciones",
    diameterCm: 24,
    grams: 2000,
  },
};

export async function getActiveCatalog(branch: Branch = defaultBranch) {
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
      where: {
        isActive: true,
        slug: { in: [...branch.allowedSizeSlugs] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        servings: true,
        diameterCm: true,
        grams: true,
      },
    }),
    prisma.price.findMany({
      where: {
        size: {
          isActive: true,
          slug: { in: [...branch.allowedSizeSlugs] },
        },
        flavor: { isActive: true },
      },
      select: {
        id: true,
        flavorId: true,
        sizeId: true,
        amountArs: true,
      },
    }),
  ]);

  const normalizedSizes = sizes.map((size) => ({
    ...size,
    ...(sizeContentOverrides[size.slug as SizeSlug] ?? {}),
  }));
  const sizeMap = new Map(normalizedSizes.map((size) => [size.id, size]));
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
          if (!isCatalogPairAvailableAtBranch(branch, flavor.slug, size.slug)) {
            return null;
          }
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
        description: flavorDescriptionOverrides[flavor.slug] ?? flavor.description,
        prices: mapped,
      };
    }),
    sizes: normalizedSizes,
  };
}
