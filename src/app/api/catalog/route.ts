import { NextResponse } from "next/server";
import { getActiveCatalog } from "@/lib/catalog-db";
import { getCapacityCalendar } from "@/lib/capacity";
import { getPickupHoursSummary } from "@/lib/pickup-hours-db";

export const runtime = "nodejs";

export async function GET() {
  const [catalog, calendar, pickupHoursSummary] = await Promise.all([
    getActiveCatalog(),
    getCapacityCalendar({ days: 21 }),
    getPickupHoursSummary(),
  ]);

  return NextResponse.json({
    ...catalog,
    availability: calendar,
    pickupHoursSummary,
  });
}
