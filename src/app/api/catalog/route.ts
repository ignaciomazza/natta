import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getActiveCatalog } from "@/lib/catalog-db";
import { getCapacityCalendar } from "@/lib/capacity";
import { getPickupHoursSummary } from "@/lib/pickup-hours-db";
import { branches, defaultBranch, getBranchBySlug } from "@/lib/branches";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestedBranch = req.nextUrl.searchParams.get("branch");
  const branch = requestedBranch
    ? getBranchBySlug(requestedBranch)
    : defaultBranch;

  if (!branch) {
    return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
  }

  const [catalog, calendar, pickupHoursSummary] = await Promise.all([
    getActiveCatalog(branch),
    getCapacityCalendar({ days: 21, branchCode: branch.code }),
    getPickupHoursSummary(branch.code),
  ]);

  return NextResponse.json({
    ...catalog,
    branch,
    branches,
    availability: calendar,
    pickupHoursSummary,
  });
}
