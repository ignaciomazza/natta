import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMercadoPagoPaymentForOrder } from "@/lib/payments/sync";

export const runtime = "nodejs";

function getProviderPaymentDetails(providerPayload: unknown) {
  const emptyDetails = {
    receiptUrl: null as string | null,
    reference: null as string | null,
    financialInstitution: null as string | null,
  };

  if (!providerPayload || typeof providerPayload !== "object" || Array.isArray(providerPayload)) {
    return emptyDetails;
  }

  const transactionDetails = (providerPayload as Record<string, unknown>)
    .transaction_details;
  if (
    !transactionDetails ||
    typeof transactionDetails !== "object" ||
    Array.isArray(transactionDetails)
  ) {
    return emptyDetails;
  }

  const details = transactionDetails as Record<string, unknown>;

  return {
    receiptUrl:
      typeof details.external_resource_url === "string"
        ? details.external_resource_url
        : null,
    reference:
      typeof details.payment_method_reference_id === "string"
        ? details.payment_method_reference_id
        : null,
    financialInstitution:
      typeof details.financial_institution === "string"
        ? details.financial_institution
        : null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const receiptCode = req.nextUrl.searchParams.get("receiptCode")?.trim();
  const syncPaymentId = req.nextUrl.searchParams.get("syncPaymentId")?.trim();

  if (!receiptCode) {
    return NextResponse.json(
      { error: "Falta verificar el comprobante del pedido" },
      { status: 400 },
    );
  }

  if (syncPaymentId && !/^\d{1,32}$/.test(syncPaymentId)) {
    return NextResponse.json(
      { error: "Identificador de pago invalido" },
      { status: 400 },
    );
  }

  const loadOrder = () =>
    prisma.order.findFirst({
      where: {
        id: orderId,
        publicReceiptCode: receiptCode,
      },
      include: {
        customer: true,
        items: {
          orderBy: [{ createdAt: "asc" as const }],
          include: {
            flavor: true,
            size: true,
          },
        },
        payments: {
          orderBy: [{ createdAt: "asc" as const }],
        },
      },
    });

  let order = await loadOrder();
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  if (syncPaymentId) {
    try {
      await syncMercadoPagoPaymentForOrder(syncPaymentId, order.id);
      order = await loadOrder();
    } catch (error) {
      console.error("No se pudo sincronizar el pago de Mercado Pago", {
        error,
        orderId,
        syncPaymentId,
      });
    }
  }

  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      amountDueNowArs: order.amountDueNowArs,
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
      ...getProviderPaymentDetails(payment.providerPayload),
    })),
  });
}
