import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return cobotsErrorResponse(new Error("Datos inválidos"));
    }
    return cobotsResponse(await cobotsApi("/api/storefront/natta/orders", {
      ...body,
      requestId: body.requestId || randomUUID(),
    }));
  } catch (error) {
    return cobotsErrorResponse(error);
  }
}
