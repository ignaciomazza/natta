import * as legacy from "./legacy";
import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";
import { isCobotsDirect } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await isCobotsDirect())) return legacy.POST(request);
    return cobotsResponse(await cobotsApi("/api/storefront/natta/payments/checkout", await request.json()));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
