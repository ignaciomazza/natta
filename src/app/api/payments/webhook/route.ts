import * as legacy from "./legacy";
import { type NextRequest } from "next/server";
import { cobotsErrorResponse, forwardMercadoPagoWebhook } from "@/lib/cobots-api";
import { isCobotsDirect } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await isCobotsDirect())) return legacy.POST(request);
    return await forwardMercadoPagoWebhook(request);
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
