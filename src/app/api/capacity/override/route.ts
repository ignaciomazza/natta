import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const overrideSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    maxUnits: z.number().int().min(0).nullable().optional(),
    isAutoCapacity: z.boolean().optional(),
    isClosed: z.boolean().optional(),
    ignoreLeadTime: z.boolean().optional(),
    pickupStartMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    pickupEndMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (body) =>
      typeof body.pickupStartMinutes !== "number" ||
      typeof body.pickupEndMinutes !== "number" ||
      body.pickupEndMinutes > body.pickupStartMinutes,
    {
      message: "El horario de cierre debe ser posterior al de inicio",
      path: ["pickupEndMinutes"],
    },
  );

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = overrideSchema.parse(await req.json());
    const date = new Date(`${body.date}T12:00:00`);

    const override = await prisma.dateCapacityOverride.upsert({
      where: { date },
      update: {
        ...(body.maxUnits !== undefined ? { maxUnits: body.maxUnits } : {}),
        ...(body.isAutoCapacity !== undefined
          ? { isAutoCapacity: body.isAutoCapacity }
          : {}),
        ...(body.isClosed !== undefined ? { isClosed: body.isClosed } : {}),
        ...(body.ignoreLeadTime !== undefined
          ? { ignoreLeadTime: body.ignoreLeadTime }
          : {}),
        ...(body.pickupStartMinutes !== undefined
          ? { pickupStartMinutes: body.pickupStartMinutes }
          : {}),
        ...(body.pickupEndMinutes !== undefined
          ? { pickupEndMinutes: body.pickupEndMinutes }
          : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      },
      create: {
        date,
        maxUnits: body.maxUnits ?? null,
        isAutoCapacity: body.isAutoCapacity ?? false,
        isClosed: body.isClosed ?? false,
        ignoreLeadTime: body.ignoreLeadTime ?? false,
        pickupStartMinutes: body.pickupStartMinutes ?? null,
        pickupEndMinutes: body.pickupEndMinutes ?? null,
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

    logServerError("api.capacity.override.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
