import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const weekdaySchema = z
  .object({
    branchCode: z.enum(["DEVOTO", "NORDELTA"]),
    weekday: z.number().int().min(0).max(6),
    isOpen: z.boolean().optional(),
    maxUnits: z.number().int().min(0).optional(),
    isAutoCapacity: z.boolean().optional(),
    minLeadTimeDays: z.number().int().min(0).max(30).optional(),
    cutoffHour: z.number().int().min(0).max(23).optional(),
    pickupStartMinutes: z.number().int().min(0).max(1439).optional(),
    pickupEndMinutes: z.number().int().min(0).max(1439).optional(),
  })
  .refine(
    (body) =>
      body.pickupStartMinutes === undefined ||
      body.pickupEndMinutes === undefined ||
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
    const body = weekdaySchema.parse(await req.json());

    const rule = await prisma.weekdayCapacityRule.upsert({
      where: {
        branchCode_weekday: {
          branchCode: body.branchCode,
          weekday: body.weekday,
        },
      },
      update: {
        ...(body.isOpen !== undefined ? { isOpen: body.isOpen } : {}),
        ...(body.maxUnits !== undefined ? { maxUnits: body.maxUnits } : {}),
        ...(body.isAutoCapacity !== undefined
          ? { isAutoCapacity: body.isAutoCapacity }
          : {}),
        ...(body.minLeadTimeDays !== undefined
          ? { minLeadTimeDays: body.minLeadTimeDays }
          : {}),
        ...(body.cutoffHour !== undefined ? { cutoffHour: body.cutoffHour } : {}),
        ...(body.pickupStartMinutes !== undefined
          ? { pickupStartMinutes: body.pickupStartMinutes }
          : {}),
        ...(body.pickupEndMinutes !== undefined
          ? { pickupEndMinutes: body.pickupEndMinutes }
          : {}),
      },
      create: {
        branchCode: body.branchCode,
        weekday: body.weekday,
        isOpen: body.isOpen ?? body.weekday !== 0,
        maxUnits: body.maxUnits ?? 20,
        isAutoCapacity: body.isAutoCapacity ?? false,
        minLeadTimeDays: body.minLeadTimeDays ?? 2,
        cutoffHour: body.cutoffHour ?? 10,
        pickupStartMinutes: body.pickupStartMinutes,
        pickupEndMinutes: body.pickupEndMinutes,
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
