import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          flavor: true,
          size: true,
        },
      },
      payments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      amountPaidArs: order.amountPaidArs,
      amountBalanceArs: order.amountBalanceArs,
      subtotalArs: order.subtotalArs,
      publicReceiptCode: order.publicReceiptCode,
      preferenceId: order.mercadoPagoPreferenceId,
      checkoutUrl: order.mercadoPagoCheckoutUrl,
      deliveryDate: order.deliveryDate,
      deliveryAddress: order.deliveryAddress,
      fulfillmentMode: order.fulfillmentMode,
      notes: order.notes,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
        address: order.customer.address,
      },
      items: order.items.map((item) => ({
        id: item.id,
        flavorId: item.flavorId,
        flavorName: item.flavor.name,
        sizeId: item.sizeId,
        sizeName: item.size.name,
        quantity: item.quantity,
        subtotalArs: item.subtotalArs,
        unitPriceArs: item.subtotalArs / item.quantity,
      })),
    },
    payments: order.payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      status: payment.status,
      method: payment.method,
      amountArs: payment.amountArs,
      paidAt: payment.paidAt,
      referenceNote: payment.referenceNote,
      providerPreferenceId: payment.providerPreferenceId,
      providerPaymentId: payment.providerPaymentId,
      statusDetail: payment.statusDetail,
      providerPayload: payment.providerPayload,
    })),
  });
}
