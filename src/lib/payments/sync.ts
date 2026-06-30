import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  searchMercadoPagoPaymentsByExternalReference,
  type MercadoPagoEnvironment,
  type MercadoPagoPaymentResponse,
  mapMercadoPagoPaymentStatus,
} from "@/lib/payments/mercadopago";
import { sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";

type OrderPaymentSummaryInput = {
  amountDueNowArs: number;
  currentStatus: OrderStatus;
  totalPaidArs: number;
};

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

export function normalizeProviderAmountArs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const amount = Math.round(value);
  return amount > 0 ? amount : null;
}

export function getOrderPaymentSummaryUpdate(input: OrderPaymentSummaryInput) {
  if (input.currentStatus === "DELIVERED" || input.currentStatus === "CANCELLED") {
    return {
      amountPaidArs: input.totalPaidArs,
      status: input.currentStatus,
      confirmedAt: undefined,
    };
  }

  const hasCoveredDueNow = input.totalPaidArs >= input.amountDueNowArs;
  const status: OrderStatus = hasCoveredDueNow ? "CONFIRMED" : "PENDING";

  return {
    amountPaidArs: input.totalPaidArs,
    status,
    confirmedAt:
      status === "CONFIRMED"
        ? input.currentStatus !== "CONFIRMED"
          ? new Date()
          : undefined
        : null,
  };
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
      amountDueNowArs: true,
      status: true,
    },
  });

  if (!order) {
    return null;
  }

  return prisma.order.update({
    where: { id: order.id },
    data: {
      ...getOrderPaymentSummaryUpdate({
        amountDueNowArs: order.amountDueNowArs,
        currentStatus: order.status,
        totalPaidArs: totalPaid,
      }),
      amountBalanceArs: Math.max(0, order.subtotalArs - totalPaid),
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

  const remotePaymentId = `${remotePayment.id}`;
  if (
    candidate.status === "APPROVED" &&
    candidate.providerPaymentId &&
    candidate.providerPaymentId !== remotePaymentId
  ) {
    return candidate;
  }

  const providerAmountArs = normalizeProviderAmountArs(
    remotePayment.transaction_amount,
  );
  const effectiveStatus =
    mappedStatus === "APPROVED" && providerAmountArs === null
      ? "PENDING"
      : mappedStatus;

  const updatedPayment = await prisma.payment.update({
    where: { id: candidate.id },
    data: {
      providerPaymentId: remotePaymentId,
      status: effectiveStatus,
      statusDetail:
        mappedStatus === "APPROVED" && providerAmountArs === null
          ? "Mercado Pago no informó un monto válido"
          : (remotePayment.status_detail ?? null),
      paidAt: parseDate(remotePayment.date_approved),
      providerPayload: remotePayment,
      method: "MERCADO_PAGO",
      amountArs: providerAmountArs ?? candidate.amountArs,
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
  if (effectiveStatus === "APPROVED") {
    await sendOrderReceiptEmailIfNeeded(candidate.orderId);
  }

  return updatedPayment;
}

export async function syncMercadoPagoPayment(
  resourceId: string,
  environment?: MercadoPagoEnvironment,
) {
  const remotePayment = await getMercadoPagoPayment(resourceId, environment);
  return applyMercadoPagoPaymentSnapshot(remotePayment);
}

export async function syncMercadoPagoPaymentForOrder(
  resourceId: string,
  orderId: string,
  environment?: MercadoPagoEnvironment,
) {
  const remotePayment = await getMercadoPagoPayment(resourceId, environment);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      mercadoPagoExternalReference: true,
      payments: {
        select: {
          externalReference: true,
          providerPaymentId: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const expectedReferences = new Set(
    [
      order.mercadoPagoExternalReference,
      ...order.payments.map((payment) => payment.externalReference),
    ].filter((value): value is string => Boolean(value)),
  );
  const remotePaymentId = `${remotePayment.id}`;
  const belongsToOrder =
    (remotePayment.external_reference
      ? expectedReferences.has(remotePayment.external_reference)
      : false) ||
    order.payments.some(
      (payment) => payment.providerPaymentId === remotePaymentId,
    );

  if (!belongsToOrder) {
    throw new Error("PAYMENT_ORDER_MISMATCH");
  }

  return applyMercadoPagoPaymentSnapshot(remotePayment);
}

export async function syncMercadoPagoPaymentsByExternalReference(
  externalReference: string,
  orderId?: string,
  environment?: MercadoPagoEnvironment,
) {
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        mercadoPagoExternalReference: true,
        payments: {
          select: {
            externalReference: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const expectedReferences = new Set(
      [
        order.mercadoPagoExternalReference,
        ...order.payments.map((payment) => payment.externalReference),
      ].filter((value): value is string => Boolean(value)),
    );

    if (!expectedReferences.has(externalReference)) {
      throw new Error("PAYMENT_ORDER_MISMATCH");
    }
  }

  const remotePayments = await searchMercadoPagoPaymentsByExternalReference(
    externalReference,
    environment,
  );
  const syncedPayments = [];

  for (const remotePayment of remotePayments) {
    const syncedPayment = await applyMercadoPagoPaymentSnapshot(remotePayment);
    if (syncedPayment) {
      syncedPayments.push(syncedPayment);
    }
  }

  return {
    found: remotePayments.length,
    synced: syncedPayments.length,
    payments: syncedPayments,
  };
}
