import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import {
  syncMercadoPagoPayment,
  syncMercadoPagoPaymentForOrder,
  syncMercadoPagoPaymentsByExternalReference,
} from "@/lib/payments/sync";
import { logServerError } from "@/lib/server/log";

const syncSchema = z
  .object({
    orderId: z.string().min(1).optional(),
    providerPaymentId: z.string().regex(/^\d{1,32}$/).optional(),
    externalReference: z.string().min(1).max(180).optional(),
  })
  .refine(
    (value) => Boolean(value.providerPaymentId || value.externalReference),
    "Falta identificador de Mercado Pago",
  );

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = syncSchema.parse(await req.json());

    if (body.providerPaymentId) {
      const payment = body.orderId
        ? await syncMercadoPagoPaymentForOrder(body.providerPaymentId, body.orderId)
        : await syncMercadoPagoPayment(body.providerPaymentId);

      return NextResponse.json({
        ok: true,
        found: payment ? 1 : 0,
        synced: payment ? 1 : 0,
      });
    }

    const result = await syncMercadoPagoPaymentsByExternalReference(
      body.externalReference!,
      body.orderId,
    );

    return NextResponse.json({
      ok: true,
      found: result.found,
      synced: result.synced,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }
      if (error.message === "PAYMENT_ORDER_MISMATCH") {
        return NextResponse.json(
          { error: "El pago no corresponde a este pedido" },
          { status: 409 },
        );
      }
    }

    logServerError("api.payments.sync.post", error);
    return NextResponse.json(
      { error: "No se pudo sincronizar Mercado Pago" },
      { status: 500 },
    );
  }
}
