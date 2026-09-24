import { NextResponse, type NextRequest } from "next/server";

export class CobotsApiError extends Error {
  constructor(
    public status: number,
    public payload: Record<string, unknown>,
  ) {
    super(typeof payload.error === "string" ? payload.error : "No se pudo consultar Cobots.");
  }
}

function endpoint(path: string) {
  const base = process.env.COBOTS_API_URL?.trim();
  if (!base) throw new CobotsApiError(503, { error: "La conexión con Cobots no está configurada." });
  const url = new URL(path, base);
  if (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new CobotsApiError(503, { error: "La conexión con Cobots no es segura." });
  }
  return url;
}

export async function cobotsApi(path: string, body?: unknown) {
  const key = process.env.COBOTS_STOREFRONT_API_KEY?.trim();
  if (!key) throw new CobotsApiError(503, { error: "La conexión con Cobots no está configurada." });
  const response = await fetch(endpoint(path), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "x-cobots-storefront-api-key": key,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CobotsApiError(response.status, data && typeof data === "object" && !Array.isArray(data)
      ? data : { error: "Cobots no pudo completar la solicitud." });
  }
  return data;
}

export function cobotsErrorResponse(error: unknown) {
  if (error instanceof CobotsApiError) {
    return NextResponse.json(error.payload, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error("No se pudo consultar Cobots", error);
  return NextResponse.json({ error: "No pudimos consultar Cobots. Intentá nuevamente." },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}

export function cobotsResponse(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function forwardMercadoPagoWebhook(request: NextRequest) {
  const url = endpoint("/api/sites/natta_channel_default/payments/mercadopago/webhook");
  url.search = request.nextUrl.search;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
      "x-signature": request.headers.get("x-signature") || "",
      "x-request-id": request.headers.get("x-request-id") || "",
    },
    body: await request.text(),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({ received: response.ok }));
  return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
}

