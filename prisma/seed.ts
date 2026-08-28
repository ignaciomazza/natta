import { randomBytes } from "node:crypto";
import { BranchCode, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

type SeedSize = {
  slug: string;
  name: string;
  description: string;
  servings: string;
  sortOrder: number;
  diameterCm?: number;
  grams?: number;
};

const sizes: SeedSize[] = [
  {
    slug: "latta",
    name: "Latta",
    description: "11 cm · 300 g",
    servings: "Cuchareable individual",
    sortOrder: 1,
    diameterCm: 11,
    grams: 300,
  },
  {
    slug: "chica",
    name: "Chica",
    description: "15 cm · 650 g aprox.",
    servings: "Entre 4 y 6 porciones",
    sortOrder: 2,
    diameterCm: 15,
    grams: 650,
  },
  {
    slug: "grande",
    name: "Grande",
    description: "24 cm · 2 kg aprox.",
    servings: "Entre 10 y 12 porciones",
    sortOrder: 3,
    diameterCm: 24,
    grams: 2000,
  },
];

const flavorCatalog = [
  {
    slug: "natta",
    name: "Natta",
    description: "Clásica de queso.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    slug: "limu",
    name: "Limu",
    description: "Lima.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    slug: "choco",
    name: "Choco",
    description: "60% cacao.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    slug: "tella",
    name: "Tella",
    description: "Avellanas.",
    prices: { latta: 13000, chica: 26000, grande: 45000 },
  },
  {
    slug: "blanca",
    name: "Blanca",
    description: "Chocolate blanco.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    slug: "tachio",
    name: "Tachio",
    description: "Pistachos.",
    prices: { latta: 13000, chica: 29000, grande: 50000 },
  },
  {
    slug: "duo",
    name: "Duo",
    description: "Chocolate blanco y Oreos.",
    prices: { latta: 13000, chica: 29000, grande: 50000 },
  },
  {
    slug: "argenta",
    name: "Argenta",
    description: "Dulce de leche.",
    prices: { latta: 13000, chica: 23000, grande: 40000 },
  },
  {
    slug: "mocha",
    name: "Mocha",
    description: "Café con base de chocolate.",
    prices: { latta: 13000, chica: 26000, grande: 45000 },
  },
  {
    slug: "brulee",
    name: "Brulée",
    description: "Crème brûlée con crocante de caramelo.",
    prices: { latta: 13000 },
  },
] as const;

function createPassword() {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const sizeBySlug = new Map<string, { id: string }>();

  for (const size of sizes) {
    const upserted = await prisma.size.upsert({
      where: { slug: size.slug },
      update: {
        name: size.name,
        description: size.description,
        servings: size.servings,
        sortOrder: size.sortOrder,
        diameterCm: size.diameterCm ?? null,
        grams: size.grams ?? null,
        isActive: true,
      },
      create: {
        slug: size.slug,
        name: size.name,
        description: size.description,
        servings: size.servings,
        sortOrder: size.sortOrder,
        diameterCm: size.diameterCm ?? null,
        grams: size.grams ?? null,
      },
      select: { id: true },
    });

    sizeBySlug.set(size.slug, upserted);
  }

  for (const flavor of flavorCatalog) {
    const upsertedFlavor = await prisma.flavor.upsert({
      where: { slug: flavor.slug },
      update: {
        name: flavor.name,
        description: flavor.description,
        isActive: true,
      },
      create: {
        slug: flavor.slug,
        name: flavor.name,
        description: flavor.description,
      },
      select: {
        id: true,
      },
    });

    const activeSizeIds = new Set<string>();

    for (const [sizeSlug, amountArs] of Object.entries(flavor.prices)) {
      const size = sizeBySlug.get(sizeSlug);
      if (!size) continue;

      activeSizeIds.add(size.id);

      await prisma.price.upsert({
        where: {
          flavorId_sizeId: {
            flavorId: upsertedFlavor.id,
            sizeId: size.id,
          },
        },
        update: {
          amountArs,
        },
        create: {
          flavorId: upsertedFlavor.id,
          sizeId: size.id,
          amountArs,
        },
      });
    }

    await prisma.price.deleteMany({
      where: {
        flavorId: upsertedFlavor.id,
        sizeId: {
          notIn: [...activeSizeIds],
        },
      },
    });
  }

  for (const branchCode of [BranchCode.DEVOTO, BranchCode.NORDELTA]) {
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      const pickupStartMinutes = 11 * 60;
      const pickupEndMinutes = weekday === 6 ? 14 * 60 : 18 * 60;

      await prisma.weekdayCapacityRule.upsert({
        where: {
          branchCode_weekday: {
            branchCode,
            weekday,
          },
        },
        update: {
          isOpen: weekday !== 0,
          maxUnits: weekday === 0 ? 0 : 20,
          minLeadTimeDays: 2,
          cutoffHour: 10,
        },
        create: {
          branchCode,
          weekday,
          isOpen: weekday !== 0,
          maxUnits: weekday === 0 ? 0 : 20,
          minLeadTimeDays: 2,
          cutoffHour: 10,
          pickupStartMinutes,
          pickupEndMinutes,
        },
      });
    }
  }

  const adminEmail = "admin@natta.local";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  let generatedPassword: string | null = null;

  if (!existingAdmin) {
    generatedPassword = createPassword();
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Natta Admin",
        passwordHash: await hashPassword(generatedPassword),
        isActive: true,
      },
    });
  }

  console.log("Seed completado.");
  console.log(`Admin email: ${adminEmail}`);
  if (generatedPassword) {
    console.log(`Admin password generado: ${generatedPassword}`);
    console.log("Guardalo ahora; no vuelve a mostrarse.");
  } else {
    console.log("Admin existente: contraseña sin cambios.");
  }
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
