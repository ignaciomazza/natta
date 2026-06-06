import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const weekdaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isOpen: z.boolean().optional(),
  maxUnits: z.number().int().min(0).optional(),
  minLeadTimeDays: z.number().int().min(0).max(30).optional(),
  cutoffHour: z.number().int().min(0).max(23).optional(),
});

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = weekdaySchema.parse(await req.json());

    const rule = await prisma.weekdayCapacityRule.upsert({
      where: { weekday: body.weekday },
      update: {
        ...(body.isOpen !== undefined ? { isOpen: body.isOpen } : {}),
        ...(body.maxUnits !== undefined ? { maxUnits: body.maxUnits } : {}),
        ...(body.minLeadTimeDays !== undefined
          ? { minLeadTimeDays: body.minLeadTimeDays }
          : {}),
        ...(body.cutoffHour !== undefined ? { cutoffHour: body.cutoffHour } : {}),
      },
      create: {
        weekday: body.weekday,
        isOpen: body.isOpen ?? body.weekday !== 0,
        maxUnits: body.maxUnits ?? 20,
        minLeadTimeDays: body.minLeadTimeDays ?? 2,
        cutoffHour: body.cutoffHour ?? 10,
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

    logServerError("api.capacity.weekday.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
