import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import { isCapacitySchemaUnavailableError } from "@/lib/capacity";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";

const flavorRuleSchema = z.object({
  branchCode: z.enum(["DEVOTO", "NORDELTA"]),
  weekday: z.number().int().min(0).max(6),
  flavorId: z.string().min(1),
  maxUnits: z.number().int().min(0).nullable(),
});

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = flavorRuleSchema.parse(await req.json());

    if (body.maxUnits === null) {
      await prisma.weekdayFlavorCapacityRule.deleteMany({
        where: {
          branchCode: body.branchCode,
          weekday: body.weekday,
          flavorId: body.flavorId,
        },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const rule = await prisma.weekdayFlavorCapacityRule.upsert({
      where: {
        branchCode_weekday_flavorId: {
          branchCode: body.branchCode,
          weekday: body.weekday,
          flavorId: body.flavorId,
        },
      },
      update: {
        maxUnits: body.maxUnits,
      },
      create: {
        branchCode: body.branchCode,
        weekday: body.weekday,
        flavorId: body.flavorId,
        maxUnits: body.maxUnits,
      },
    });

    return NextResponse.json(rule);
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

    logServerError("api.capacity.flavorRule.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar el cupo por sabor" }, { status: 500 });
  }
}
