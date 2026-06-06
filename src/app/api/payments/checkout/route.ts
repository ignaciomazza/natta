import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createMercadoPagoPreference,
  getMercadoPagoPublicKey,
  getMercadoPagoTicketExpirationDays,
  MercadoPagoConfigError,
} from "@/lib/payments/mercadopago";
import { logServerError } from "@/lib/server/log";

const checkoutSchema = z.object({
  orderId: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = checkoutSchema.parse(await req.json());

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        customer: true,
        payments: {
          where: {
            status: "PENDING",
          },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Pedido cancelado" }, { status: 409 });
    }

    const pendingPayment = order.payments[0];
    if (!pendingPayment) {
      return NextResponse.json({ error: "No hay cobro pendiente" }, { status: 409 });
    }

    const preference = await createMercadoPagoPreference({
      orderId: order.id,
      externalReference: pendingPayment.externalReference ?? `natta_${order.id}`,
      title:
        order.fulfillmentMode === "PICKUP"
          ? `Seña pedido Natta ${order.publicReceiptCode}`
          : `Pago pedido Natta ${order.publicReceiptCode}`,
      amountArs: pendingPayment.amountArs,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
    });

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          mercadoPagoPreferenceId: preference.id,
          mercadoPagoCheckoutUrl:
            preference.sandbox_init_point ?? preference.init_point ?? null,
        },
      }),
      prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          providerPreferenceId: preference.id,
          providerPayload: preference,
          method: "MERCADO_PAGO",
        },
      }),
    ]);

    return NextResponse.json({
      orderId: order.id,
      paymentId: pendingPayment.id,
      preferenceId: preference.id,
      amountArs: pendingPayment.amountArs,
      publicKey: getMercadoPagoPublicKey(),
      receiptCode: order.publicReceiptCode,
      ticketExpirationDays: getMercadoPagoTicketExpirationDays(),
      walletInitPoint: preference.sandbox_init_point ?? preference.init_point ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (error instanceof MercadoPagoConfigError) {
      return NextResponse.json(
        { error: "Mercado Pago no esta configurado" },
        { status: 503 },
      );
    }
    if (error instanceof Error) {
      if (error.message.toUpperCase().includes("UNAUTHORIZED")) {
        return NextResponse.json(
          { error: "Mercado Pago rechazó las credenciales sandbox" },
          { status: 503 },
        );
      }
    }

    logServerError("api.payments.checkout.post", error);
    return NextResponse.json({ error: "No se pudo iniciar checkout" }, { status: 500 });
  }
}
