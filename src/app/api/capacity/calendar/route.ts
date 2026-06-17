import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCapacityCalendar,
  withMissingCapacityTableFallback,
} from "@/lib/capacity";
import { requireAuth } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : undefined;

    const [calendar, weekdayRules, weekdayFlavorRules, flavors] = await Promise.all([
      getCapacityCalendar({ from, days }),
      prisma.weekdayCapacityRule.findMany({
        orderBy: { weekday: "asc" },
        select: {
          weekday: true,
          isOpen: true,
          maxUnits: true,
          minLeadTimeDays: true,
          cutoffHour: true,
        },
      }),
      withMissingCapacityTableFallback(
        () => prisma.weekdayFlavorCapacityRule.findMany({
          orderBy: [{ weekday: "asc" }, { flavor: { name: "asc" } }],
          select: {
            weekday: true,
            flavorId: true,
            maxUnits: true,
          },
        }),
        [],
      ),
      prisma.flavor.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
        },
      }),
    ]);

    return NextResponse.json({
      items: calendar,
      flavors,
      weekdayRules,
      weekdayFlavorRules,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.capacity.calendar.get", error);
    return NextResponse.json({ error: "No se pudo cargar capacidad" }, { status: 500 });
  }
}
