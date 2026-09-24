import * as legacy from "./legacy";
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { cobotsApi, cobotsErrorResponse, cobotsResponse } from "@/lib/cobots-api";
import { isCobotsDirect } from "@/lib/cobots-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!(await isCobotsDirect())) return legacy.POST(request);
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
