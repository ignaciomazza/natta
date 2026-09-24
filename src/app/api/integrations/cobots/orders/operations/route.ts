import { isCobotsDirect } from "@/lib/cobots-api";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { applyCobotsOrderCommand, isCobotsOperationsAuthorized } from "@/lib/integrations/cobots-operations";
import { nattaOrderCommandSchema } from "@/lib/integrations/cobots-contract";
import { logServerError } from "@/lib/server/log";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isCobotsOperationsAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    if (await isCobotsDirect()) return NextResponse.json({ error: "El pedido se gestiona desde Cobots." }, { status: 410 });
    const body = await request.text();
    if (body.length > 8192) return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
    const command = nattaOrderCommandSchema.parse(JSON.parse(body));
    const result = await applyCobotsOrderCommand(command);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "OPERATION_ID_REUSED") {
      return NextResponse.json({ error: "El identificador ya pertenece a otra operación." }, { status: 409 });
    }
    logServerError("api.integrations.cobots.orders.operations", error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
