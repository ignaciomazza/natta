import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const branch = request.nextUrl.searchParams.get("branch") || "devoto";
    return cobotsResponse(await cobotsApi(`/api/storefront/natta/catalog?branch=${encodeURIComponent(branch)}`));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
