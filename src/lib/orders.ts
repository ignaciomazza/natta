import { FulfillmentMode, OrderStatus, PaymentKind } from "@prisma/client";
import crypto from "node:crypto";

export type BuildOrderInputItem = {
  flavorId: string;
  sizeId: string;
  quantity: number;
  unitPriceArs: number;
};

export function calculateOrderTotals(
  mode: FulfillmentMode,
  items: BuildOrderInputItem[],
) {
  const subtotalArs = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceArs,
    0,
  );

  const amountDueNowArs =
    mode === "PICKUP" ? Math.ceil(subtotalArs / 2) : subtotalArs;

  return {
    subtotalArs,
    amountDueNowArs,
    amountBalanceArs: Math.max(0, subtotalArs - amountDueNowArs),
  };
}

export function paymentKindByMode(mode: FulfillmentMode): PaymentKind {
  return mode === "PICKUP" ? "DEPOSIT" : "FULL";
}

export function nextOrderStatusFromPayment(
  currentStatus: OrderStatus,
  hasApprovedPayment: boolean,
) {
  if (!hasApprovedPayment) return currentStatus;
  if (currentStatus === "PENDING") return "CONFIRMED";
  return currentStatus;
}

export function createPublicReceiptCode() {
  return crypto.randomBytes(9).toString("base64url");
}

export function createPaymentExternalReference(orderId: string) {
  const suffix = crypto.randomBytes(4).toString("hex");
  return `natta_${orderId}_${suffix}`;
}
