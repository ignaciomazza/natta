import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import { getDateAtNoon, isCapacitySchemaUnavailableError } from "@/lib/capacity";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";

const flavorOverrideSchema = z.object({
  branchCode: z.enum(["DEVOTO", "NORDELTA"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flavorId: z.string().min(1),
  maxUnits: z.number().int().min(0).nullable().optional(),
  isClosed: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
  clear: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = flavorOverrideSchema.parse(await req.json());
    const date = getDateAtNoon(body.date);

    if (body.clear) {
      await prisma.dateFlavorCapacityOverride.deleteMany({
        where: {
          branchCode: body.branchCode,
          date,
          flavorId: body.flavorId,
        },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const override = await prisma.dateFlavorCapacityOverride.upsert({
      where: {
        branchCode_date_flavorId: {
          branchCode: body.branchCode,
          date,
          flavorId: body.flavorId,
        },
      },
      update: {
        ...(body.maxUnits !== undefined ? { maxUnits: body.maxUnits } : {}),
        ...(body.isClosed !== undefined ? { isClosed: body.isClosed } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      },
      create: {
        branchCode: body.branchCode,
        date,
        flavorId: body.flavorId,
        maxUnits: body.maxUnits ?? null,
        isClosed: body.isClosed ?? false,
        note: body.note ?? null,
      },
    });

    return NextResponse.json(override);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (isCapacitySchemaUnavailableError(error)) {
      return NextResponse.json(
        { error: "Falta actualizar la base de datos para guardar cupos por sabor" },
        { status: 409 },
      );
    }

    logServerError("api.capacity.flavorOverride.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar la excepción por sabor" }, { status: 500 });
  }
}
