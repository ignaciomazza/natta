import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createMercadoPagoPreference,
  getMercadoPagoCheckoutUrl,
  getMercadoPagoEnvironment,
  getMercadoPagoPublicKey,
  getMercadoPagoTicketExpirationDays,
  MercadoPagoConfigError,
} from "@/lib/payments/mercadopago";
import { getOrCreatePendingPaymentForOrder } from "@/lib/payments/pending";
import { logServerError } from "@/lib/server/log";
import { withOrderPaymentLock } from "@/lib/payments/lock";

const checkoutSchema = z.object({
  orderId: z.string().min(1),
  receiptCode: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = checkoutSchema.parse(await req.json());

    const order = await prisma.order.findFirst({
      where: {
        id: body.orderId,
        publicReceiptCode: body.receiptCode,
      },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 },
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Pedido cancelado" }, { status: 409 });
    }

    return await withOrderPaymentLock(order.id, async (tx) => {
      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          customer: true,
          payments: { orderBy: { createdAt: "asc" } },
        },
      });
      if (currentOrder.status === "CANCELLED")
        return NextResponse.json(
          { error: "Pedido cancelado" },
          { status: 409 },
        );
      const pendingPayment = await getOrCreatePendingPaymentForOrder(
        currentOrder,
        tx,
      );
      if (!pendingPayment) {
        return NextResponse.json(
          {
            error: "El pago de este pedido ya está cubierto",
            code: "PAYMENT_ALREADY_RECEIVED",
          },
          { status: 409 },
        );
      }

      const mercadoPagoEnvironment = getMercadoPagoEnvironment();

      const preference =
        pendingPayment.providerPreferenceId &&
        pendingPayment.providerPreferenceId ===
          currentOrder.mercadoPagoPreferenceId &&
        currentOrder.mercadoPagoCheckoutUrl
          ? {
              id: pendingPayment.providerPreferenceId,
              init_point: currentOrder.mercadoPagoCheckoutUrl,
              sandbox_init_point: currentOrder.mercadoPagoCheckoutUrl,
            }
          : await createMercadoPagoPreference({
              orderId: order.id,
              receiptCode: order.publicReceiptCode,
              externalReference:
                pendingPayment.externalReference ?? `natta_${order.id}`,
              title:
                pendingPayment.kind === "DEPOSIT"
                  ? `Seña pedido Natta ${order.publicReceiptCode}`
                  : `Pago pedido Natta ${order.publicReceiptCode}`,
              amountArs: pendingPayment.amountArs,
              customerName: order.customer.name,
              customerEmail: order.customer.email,
              environment: mercadoPagoEnvironment,
            });
      const checkoutUrl = getMercadoPagoCheckoutUrl(
        preference,
        mercadoPagoEnvironment,
      );

      if (pendingPayment.providerPreferenceId !== preference.id) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            mercadoPagoPreferenceId: preference.id,
            mercadoPagoCheckoutUrl: checkoutUrl,
          },
        });
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            providerPreferenceId: preference.id,
            providerPayload: preference,
            method: "MERCADO_PAGO",
          },
        });
      }

      return NextResponse.json({
        orderId: order.id,
        paymentId: pendingPayment.id,
        preferenceId: preference.id,
        amountArs: pendingPayment.amountArs,
        publicKey: getMercadoPagoPublicKey(),
        receiptCode: order.publicReceiptCode,
        ticketExpirationDays: getMercadoPagoTicketExpirationDays(),
        walletInitPoint: checkoutUrl,
      });
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
    return NextResponse.json(
      { error: "No se pudo iniciar checkout" },
      { status: 500 },
    );
  }
}
