import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCapacityCalendar } from "@/lib/capacity";
import { requireAuth } from "@/lib/auth/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : undefined;

    const calendar = await getCapacityCalendar({ from, days });
    return NextResponse.json({ items: calendar });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
