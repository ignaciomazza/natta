import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        publicReceiptCode: body.receiptCode,
      },
      include: {
        payments: {
          where: {
            status: {
              in: ["PENDING", "REJECTED"],
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.amountPaidArs > 0) {
      return NextResponse.json(
        { error: "Ese pedido ya tiene un pago registrado" },
        { status: 409 },
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ discarded: true });
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: order.cancelledAt ?? new Date(),
          mercadoPagoPreferenceId: null,
          mercadoPagoCheckoutUrl: null,
        },
      }),
      prisma.payment.updateMany({
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
      }),
    ]);

    return NextResponse.json({ discarded: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo descartar el pedido" }, { status: 500 });
  }
}
