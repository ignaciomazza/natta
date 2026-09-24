import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    return cobotsResponse(await cobotsApi(
      `/api/storefront/natta/orders/${encodeURIComponent(orderId)}/discard`,
      await request.json(),
    ));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
