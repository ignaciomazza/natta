import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
