import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const order = await prisma.order.findUnique({
    where: { publicReceiptCode: code },
    include: {
      items: {
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
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      code: order.publicReceiptCode,
      status: order.status,
      deliveryDate: order.deliveryDate,
      fulfillmentMode: order.fulfillmentMode,
      subtotalArs: order.subtotalArs,
      amountPaidArs: order.amountPaidArs,
      amountBalanceArs: order.amountBalanceArs,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        flavor: item.flavor.name,
        size: item.size.name,
        quantity: item.quantity,
        unitPriceArs: item.unitPriceArs,
        subtotalArs: item.subtotalArs,
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
    })),
  });
}
