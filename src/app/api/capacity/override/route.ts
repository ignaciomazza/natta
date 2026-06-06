import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxUnits: z.number().int().min(0).nullable().optional(),
  isClosed: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});

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
        ...(body.isClosed !== undefined ? { isClosed: body.isClosed } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
      },
      create: {
        date,
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

    logServerError("api.capacity.override.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
