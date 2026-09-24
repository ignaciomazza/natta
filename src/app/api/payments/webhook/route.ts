import { type NextRequest } from "next/server";
import { cobotsErrorResponse, forwardMercadoPagoWebhook } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return await forwardMercadoPagoWebhook(request);
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
