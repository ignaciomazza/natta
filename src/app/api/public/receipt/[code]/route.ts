import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    return cobotsResponse(await cobotsApi(`/api/storefront/natta/receipts/${encodeURIComponent(code)}`));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
