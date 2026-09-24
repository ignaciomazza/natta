import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const path = `/api/storefront/natta/orders/${encodeURIComponent(orderId)}${request.nextUrl.search}`;
    return cobotsResponse(await cobotsApi(path));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
