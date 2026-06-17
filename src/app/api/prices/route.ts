import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import { isCatalogPairAvailable } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";

const pricePatchSchema = z.object({
  prices: z
    .array(
      z.object({
        flavorId: z.string().min(1),
        sizeId: z.string().min(1),
        amountArs: z.number().int().min(1).nullable(),
      }),
    )
    .min(1),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

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
        },
      }),
      prisma.price.findMany({
        select: {
          flavorId: true,
          sizeId: true,
          amountArs: true,
        },
      }),
    ]);

    const priceByPair = new Map(
      prices.map((price) => [`${price.flavorId}::${price.sizeId}`, price.amountArs]),
    );

    return NextResponse.json({
      sizes,
      flavors: flavors.map((flavor) => ({
        ...flavor,
        prices: sizes.map((size) => ({
          sizeId: size.id,
          sizeSlug: size.slug,
          sizeName: size.name,
          amountArs: priceByPair.get(`${flavor.id}::${size.id}`) ?? null,
          available: isCatalogPairAvailable(flavor.slug, size.slug),
        })),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.prices.get", error);
    return NextResponse.json({ error: "No se pudieron cargar precios" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = pricePatchSchema.parse(await req.json());

    await prisma.$transaction(
      body.prices.map((price) => {
        if (price.amountArs === null) {
          return prisma.price.deleteMany({
            where: {
              flavorId: price.flavorId,
              sizeId: price.sizeId,
            },
          });
        }

        return prisma.price.upsert({
          where: {
            flavorId_sizeId: {
              flavorId: price.flavorId,
              sizeId: price.sizeId,
            },
          },
          update: {
            amountArs: price.amountArs,
          },
          create: {
            flavorId: price.flavorId,
            sizeId: price.sizeId,
            amountArs: price.amountArs,
          },
        });
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.prices.patch", error);
    return NextResponse.json({ error: "No se pudieron actualizar precios" }, { status: 500 });
  }
}
