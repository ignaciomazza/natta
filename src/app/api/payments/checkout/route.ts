import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return cobotsResponse(await cobotsApi("/api/storefront/natta/payments/checkout", await request.json()));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
