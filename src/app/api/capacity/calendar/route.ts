import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BranchCode } from "@prisma/client";
import {
  getCapacityCalendar,
  withMissingCapacityTableFallback,
} from "@/lib/capacity";
import { requireAuth } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";
import { branches, defaultBranch, getBranchBySlug } from "@/lib/branches";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : undefined;
    const requestedBranch = req.nextUrl.searchParams.get("branch");
    const branch = requestedBranch
      ? getBranchBySlug(requestedBranch)
      : defaultBranch;

    if (!branch) {
      return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
    }

    const branchCode = BranchCode[branch.code];

    const [
      calendar,
      weekdayRules,
      weekdayFlavorRules,
      weekdayFlavorSizeRules,
      flavors,
      prices,
    ] = await Promise.all([
      getCapacityCalendar({ from, days, branchCode }),
      prisma.weekdayCapacityRule.findMany({
        where: { branchCode },
        orderBy: { weekday: "asc" },
        select: {
          weekday: true,
          isOpen: true,
          maxUnits: true,
          isAutoCapacity: true,
          minLeadTimeDays: true,
          cutoffHour: true,
          pickupStartMinutes: true,
          pickupEndMinutes: true,
        },
      }),
      withMissingCapacityTableFallback(
        () => prisma.weekdayFlavorCapacityRule.findMany({
          where: { branchCode },
          orderBy: [{ weekday: "asc" }, { flavor: { name: "asc" } }],
          select: {
            weekday: true,
            flavorId: true,
            maxUnits: true,
          },
        }),
        [],
      ),
      withMissingCapacityTableFallback(
        () => prisma.weekdayFlavorSizeCapacityRule.findMany({
          where: { branchCode },
          orderBy: [
            { weekday: "asc" },
            { flavor: { name: "asc" } },
            { size: { sortOrder: "asc" } },
          ],
          select: {
            weekday: true,
            flavorId: true,
            sizeId: true,
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
      prisma.price.findMany({
        where: {
          flavor: { isActive: true },
          size: {
            isActive: true,
            slug: { in: [...branch.allowedSizeSlugs] },
          },
        },
        select: {
          flavorId: true,
          size: {
            select: {
              id: true,
              slug: true,
              name: true,
              sortOrder: true,
            },
          },
        },
      }),
    ]);

    const sizesByFlavor = new Map<
      string,
      Array<{ id: string; slug: string; name: string; sortOrder: number }>
    >();
    for (const price of prices) {
      const current = sizesByFlavor.get(price.flavorId) ?? [];
      current.push(price.size);
      sizesByFlavor.set(price.flavorId, current);
    }
    for (const sizes of sizesByFlavor.values()) {
      sizes.sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      );
    }

    return NextResponse.json({
      items: calendar,
      branch,
      branches,
      flavors: flavors.map((flavor) => ({
        ...flavor,
        sizes: sizesByFlavor.get(flavor.id) ?? [],
      })),
      weekdayRules,
      weekdayFlavorRules,
      weekdayFlavorSizeRules,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.capacity.calendar.get", error);
    return NextResponse.json({ error: "No se pudo cargar capacidad" }, { status: 500 });
  }
}
