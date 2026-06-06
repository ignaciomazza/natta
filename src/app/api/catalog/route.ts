import { NextResponse } from "next/server";
import { getActiveCatalog } from "@/lib/catalog-db";
import { getCapacityCalendar } from "@/lib/capacity";

export const runtime = "nodejs";

export async function GET() {
  const [catalog, calendar] = await Promise.all([
    getActiveCatalog(),
    getCapacityCalendar({ days: 21 }),
  ]);

  return NextResponse.json({
    ...catalog,
    availability: calendar,
  });
}
