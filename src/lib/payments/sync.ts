import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  type MercadoPagoEnvironment,
  type MercadoPagoPaymentResponse,
  mapMercadoPagoPaymentStatus,
} from "@/lib/payments/mercadopago";

type WebhookPayload = {
  id?: string;
  action?: string;
  type?: string;
  topic?: string;
  data?: { id?: string };
  resource?: string;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getMercadoPagoWebhookResourceId(payload: WebhookPayload) {
  if (payload.data?.id) return payload.data.id;
  if (payload.resource) return payload.resource.split("/").filter(Boolean).at(-1) ?? null;
  return null;
}

export function getMercadoPagoWebhookTopic(payload: WebhookPayload) {
  return payload.type ?? payload.topic ?? null;
}

export async function recalculateOrderPaymentSummary(orderId: string) {
  const approvedPayments = await prisma.payment.findMany({
    where: {
      orderId,
      status: "APPROVED",
    },
    select: {
      amountArs: true,
    },
  });

  const totalPaid = approvedPayments.reduce((sum, payment) => sum + payment.amountArs, 0);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      subtotalArs: true,
      status: true,
    },
  });

  if (!order) {
    return null;
  }

  return prisma.order.update({
    where: { id: order.id },
    data: {
      amountPaidArs: totalPaid,
      amountBalanceArs: Math.max(0, order.subtotalArs - totalPaid),
      status: totalPaid > 0 && order.status === "PENDING" ? "CONFIRMED" : order.status,
      confirmedAt: totalPaid > 0 && order.status === "PENDING" ? new Date() : undefined,
    },
  });
}

export async function applyMercadoPagoPaymentSnapshot(
  remotePayment: MercadoPagoPaymentResponse,
) {
  const mappedStatus = mapMercadoPagoPaymentStatus(remotePayment.status);

  const candidate = await prisma.payment.findFirst({
    where: {
      OR: [
        { providerPaymentId: `${remotePayment.id}` },
        remotePayment.external_reference
          ? { externalReference: remotePayment.external_reference }
          : undefined,
      ].filter(Boolean) as Array<{ providerPaymentId?: string; externalReference?: string }>,
    },
    include: {
      order: true,
    },
  });

  if (!candidate) {
    return null;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: candidate.id },
    data: {
      providerPaymentId: `${remotePayment.id}`,
      status: mappedStatus,
      statusDetail: remotePayment.status_detail ?? null,
      paidAt: parseDate(remotePayment.date_approved),
      providerPayload: remotePayment,
      method: "MERCADO_PAGO",
      amountArs:
        typeof remotePayment.transaction_amount === "number"
          ? Math.round(remotePayment.transaction_amount)
          : candidate.amountArs,
      referenceNote:
        remotePayment.transaction_details?.external_resource_url ??
        remotePayment.transaction_details?.payment_method_reference_id ??
        candidate.referenceNote,
    },
  });

  if (!candidate.orderId) {
    return updatedPayment;
  }

  await recalculateOrderPaymentSummary(candidate.orderId);

  return updatedPayment;
}

export async function syncMercadoPagoPayment(
  resourceId: string,
  environment?: MercadoPagoEnvironment,
) {
  const remotePayment = await getMercadoPagoPayment(resourceId, environment);
  return applyMercadoPagoPaymentSnapshot(remotePayment);
}
