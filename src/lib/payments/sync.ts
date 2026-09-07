import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  searchMercadoPagoPaymentsByExternalReference,
  type MercadoPagoEnvironment,
  type MercadoPagoPaymentResponse,
  mapMercadoPagoPaymentStatus,
} from "@/lib/payments/mercadopago";
import { sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";
import { withOrderPaymentLock } from "@/lib/payments/lock";

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
  if (
    input.currentStatus === "DELIVERED" ||
    input.currentStatus === "CANCELLED"
  ) {
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
  if (payload.resource)
    return payload.resource.split("/").filter(Boolean).at(-1) ?? null;
  return null;
}

export function getMercadoPagoWebhookTopic(payload: WebhookPayload) {
  return payload.type ?? payload.topic ?? null;
}

export async function recalculateOrderPaymentSummary(
  orderId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const approvedPayments = await tx.payment.findMany({
    where: {
      orderId,
      status: "APPROVED",
    },
    select: {
      amountArs: true,
    },
  });

  const totalPaid = approvedPayments.reduce(
    (sum, payment) => sum + payment.amountArs,
    0,
  );

  const order = await tx.order.findUnique({
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

  return tx.order.update({
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
  options: { sendReceipt?: boolean } = {},
) {
  if (remotePayment.currency_id && remotePayment.currency_id !== "ARS") {
    throw new Error("PAYMENT_CURRENCY_MISMATCH");
  }
  const mappedStatus = mapMercadoPagoPaymentStatus(remotePayment.status);

  // An operation ID is more specific than the checkout reference, which can
  // have several attempts. In particular, a refund must update its own payment.
  const candidate =
    (await prisma.payment.findUnique({
      where: { providerPaymentId: String(remotePayment.id) },
    })) ??
    (remotePayment.external_reference
      ? await prisma.payment.findUnique({
          where: { externalReference: remotePayment.external_reference },
        })
      : null);

  if (!candidate) {
    return null;
  }

  const apply = async (tx: Prisma.TransactionClient) => {
    const current =
      (await tx.payment.findUnique({
        where: { providerPaymentId: String(remotePayment.id) },
      })) ?? (await tx.payment.findUnique({ where: { id: candidate.id } }));
    if (!current) return null;
    const remotePaymentId = `${remotePayment.id}`;
    const previousPayload = current.providerPayload as Record<
      string,
      unknown
    > | null;
    const previousUpdatedAt = parseDate(
      typeof previousPayload?.date_last_updated === "string"
        ? previousPayload.date_last_updated
        : null,
    );
    const incomingUpdatedAt = parseDate(remotePayment.date_last_updated);
    if (
      current.providerPaymentId === remotePaymentId &&
      previousUpdatedAt &&
      incomingUpdatedAt &&
      previousUpdatedAt > incomingUpdatedAt
    ) {
      return current;
    }
    if (
      current.status === "APPROVED" &&
      current.providerPaymentId &&
      current.providerPaymentId !== remotePaymentId &&
      mappedStatus !== "APPROVED"
    ) {
      return current;
    }

    const providerAmountArs = normalizeProviderAmountArs(
      remotePayment.transaction_amount,
    );
    const effectiveStatus =
      mappedStatus === "APPROVED" && providerAmountArs === null
        ? "PENDING"
        : mappedStatus;

    const data = {
      providerPaymentId: remotePaymentId,
      status: effectiveStatus,
      statusDetail:
        mappedStatus === "APPROVED" && providerAmountArs === null
          ? "Mercado Pago no informó un monto válido"
          : (remotePayment.status_detail ?? null),
      paidAt: parseDate(remotePayment.date_approved),
      providerPayload: remotePayment as Prisma.InputJsonValue,
      method: "MERCADO_PAGO" as const,
      amountArs: providerAmountArs ?? current.amountArs,
      referenceNote:
        remotePayment.transaction_details?.external_resource_url ??
        remotePayment.transaction_details?.payment_method_reference_id ??
        current.referenceNote,
    };
    // Two genuinely approved operations must both be accounted for. A repeated
    // notification for the same operation continues to update one payment only.
    const updatedPayment =
      current.status === "APPROVED" &&
      current.providerPaymentId !== remotePaymentId
        ? await tx.payment.upsert({
            where: { providerPaymentId: remotePaymentId },
            update: data,
            create: {
              ...data,
              orderId: current.orderId,
              customerId: current.customerId,
              kind: current.kind,
              provider: "mercadopago",
              customerName: current.customerName,
              customerPhone: current.customerPhone,
            },
          })
        : await tx.payment.update({ where: { id: current.id }, data });
    if (candidate.orderId)
      await recalculateOrderPaymentSummary(candidate.orderId, tx);
    return updatedPayment;
  };
  const updated = candidate.orderId
    ? await withOrderPaymentLock(candidate.orderId, apply)
    : await apply(prisma);
  if (
    options.sendReceipt !== false &&
    candidate.orderId &&
    updated?.status === "APPROVED"
  ) {
    await sendOrderReceiptEmailIfNeeded(candidate.orderId);
  }
  return updated;
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

export async function syncMercadoPagoOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const references = new Set(
    [
      order.mercadoPagoExternalReference,
      ...order.payments
        .filter((p) => p.method === "MERCADO_PAGO")
        .map((p) => p.externalReference),
    ].filter((ref): ref is string => Boolean(ref)),
  );
  let found = 0;
  for (const reference of references) {
    const result = await syncMercadoPagoPaymentsByExternalReference(
      reference,
      orderId,
    );
    found += result.found;
  }
  for (const payment of order.payments) {
    if (payment.method === "MERCADO_PAGO" && payment.providerPaymentId) {
      await syncMercadoPagoPaymentForOrder(payment.providerPaymentId, orderId);
    }
  }
  return { found };
}
