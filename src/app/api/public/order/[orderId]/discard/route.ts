import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncMercadoPagoOrder } from "@/lib/payments/sync";
import { withOrderPaymentLock } from "@/lib/payments/lock";

const discardSchema = z.object({
  receiptCode: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  try {
    const body = discardSchema.parse(await req.json());

    const existing = await prisma.order.findFirst({
      where: {
        id: orderId,
        publicReceiptCode: body.receiptCode,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 },
      );
    }

    await syncMercadoPagoOrder(orderId);
    return await withOrderPaymentLock(orderId, async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: true },
      });
      if (
        order.amountPaidArs > 0 ||
        order.payments.some((payment) => payment.status === "APPROVED")
      ) {
        return NextResponse.json(
          {
            error:
              "Este pedido ya tiene un pago recibido. Conservamos tu pedido y su fecha.",
            code: "PAYMENT_ALREADY_RECEIVED",
          },
          { status: 409 },
        );
      }

      if (order.status === "CANCELLED") {
        return NextResponse.json({ discarded: true });
      }

      // A live wallet link can still settle after a search returns no results.
      // Absence from MP search is not proof that a started checkout is unpaid.
      if (
        order.mercadoPagoPreferenceId ||
        order.payments.some(
          (payment) =>
            payment.providerPreferenceId ||
            payment.statusDetail?.startsWith("PROCESSING:") ||
            (payment.providerPaymentId && payment.status === "PENDING"),
        )
      ) {
        return NextResponse.json(
          {
            code: "PAYMENT_UNRESOLVED",
            error:
              "Ya iniciamos el pago de este pedido. Podés reintentar el pago aquí; para cambiar los productos o la fecha, escribinos y te ayudamos.",
          },
          { status: 409 },
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: order.cancelledAt ?? new Date(),
          mercadoPagoPreferenceId: null,
          mercadoPagoCheckoutUrl: null,
        },
      });
      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: {
            in: ["PENDING", "REJECTED"],
          },
        },
        data: {
          status: "CANCELLED",
          statusDetail: "Descartado antes de pagar",
        },
      });

      return NextResponse.json({ discarded: true });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          "No pudimos verificar el pago. Conservamos tu pedido; volvé a revisar su estado antes de modificarlo.",
      },
      { status: 503 },
    );
  }
}
