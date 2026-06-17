import type { FulfillmentMode, Payment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPaymentExternalReference,
  paymentKindByMode,
} from "@/lib/orders";

type OrderForPendingPayment = {
  id: string;
  customerId: string;
  fulfillmentMode: FulfillmentMode;
  amountDueNowArs: number;
  amountPaidArs: number;
  customer: {
    name: string;
    phone: string;
  };
  payments: Payment[];
};

export function getAmountRequiredToConfirm(order: {
  amountDueNowArs: number;
  amountPaidArs: number;
}) {
  return Math.max(0, order.amountDueNowArs - order.amountPaidArs);
}

export async function getOrCreatePendingPaymentForOrder(
  order: OrderForPendingPayment,
  tx: Prisma.TransactionClient = prisma,
) {
  const existingPending = order.payments.find(
    (payment) => payment.status === "PENDING",
  );

  if (existingPending) {
    return existingPending;
  }

  const amountArs = getAmountRequiredToConfirm(order);
  if (amountArs < 1) {
    return null;
  }

  return tx.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      kind: paymentKindByMode(order.fulfillmentMode),
      status: "PENDING",
      method: "MERCADO_PAGO",
      amountArs,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      externalReference: createPaymentExternalReference(order.id),
      provider: "mercadopago",
    },
  });
}

