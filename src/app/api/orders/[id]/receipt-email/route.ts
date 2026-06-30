import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/tenant";
import {
  sendOrderReceiptEmailIfNeeded,
  type OrderReceiptEmailSkippedReason,
} from "@/lib/email/order-receipt";
import { logServerError } from "@/lib/server/log";

export const runtime = "nodejs";

const skippedResponses: Record<
  OrderReceiptEmailSkippedReason,
  { message: string; status: number }
> = {
  ALREADY_SENT: {
    message: "El comprobante ya fue enviado",
    status: 200,
  },
  AMOUNT_NOT_COVERED: {
    message: "Todavia no hay un pago aprobado suficiente para enviar el comprobante",
    status: 409,
  },
  INVALID_EMAIL: {
    message: "El pedido no tiene un email valido",
    status: 409,
  },
  ORDER_CANCELLED: {
    message: "No se puede enviar comprobante de un pedido cancelado",
    status: 409,
  },
  ORDER_NOT_FOUND: {
    message: "Pedido no encontrado",
    status: 404,
  },
  PAYMENT_NOT_APPROVED: {
    message: "Todavia no hay un pago aprobado para enviar el comprobante",
    status: 409,
  },
  RECENT_ATTEMPT: {
    message: "Ya hubo un intento de envio reciente. Espera unos minutos y volve a probar",
    status: 429,
  },
  SEND_FAILED: {
    message: "No se pudo enviar el comprobante",
    status: 502,
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const result = await sendOrderReceiptEmailIfNeeded(id, {
      force: true,
      throwOnError: true,
    });

    if (result.sent) {
      return NextResponse.json(result);
    }

    const skippedReason = result.skippedReason ?? "SEND_FAILED";
    const response = skippedResponses[skippedReason];
    return NextResponse.json(
      {
        error: response.message,
        ...result,
      },
      { status: response.status },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.orders.receipt-email.post", error);
    return NextResponse.json(
      { error: "No se pudo enviar el comprobante" },
      { status: 500 },
    );
  }
}
