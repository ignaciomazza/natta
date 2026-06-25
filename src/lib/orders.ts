import { FulfillmentMode, OrderStatus, PaymentKind } from "@prisma/client";
import crypto from "node:crypto";

export type BuildOrderInputItem = {
  flavorId: string;
  sizeId: string;
  quantity: number;
  unitPriceArs: number;
};

export type OrderPaymentOption = "deposit" | "full";

export function resolveOrderPaymentOption(
  mode: FulfillmentMode,
  option?: OrderPaymentOption,
): OrderPaymentOption {
  if (mode === "DELIVERY") return "full";
  return option === "full" ? "full" : "deposit";
}

export function calculateOrderTotals(
  mode: FulfillmentMode,
  items: BuildOrderInputItem[],
  paymentOption?: OrderPaymentOption,
) {
  const subtotalArs = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceArs,
    0,
  );

  const resolvedPaymentOption = resolveOrderPaymentOption(mode, paymentOption);
  const amountDueNowArs =
    resolvedPaymentOption === "deposit" ? Math.ceil(subtotalArs / 2) : subtotalArs;

  return {
    subtotalArs,
    amountDueNowArs,
    amountBalanceArs: Math.max(0, subtotalArs - amountDueNowArs),
  };
}

export function paymentKindByOrderPaymentOption(
  mode: FulfillmentMode,
  option?: OrderPaymentOption,
): PaymentKind {
  return resolveOrderPaymentOption(mode, option) === "deposit" ? "DEPOSIT" : "FULL";
}

export function paymentKindByMode(mode: FulfillmentMode): PaymentKind {
  return paymentKindByOrderPaymentOption(mode);
}

export function paymentKindByOrderTotals(order: {
  fulfillmentMode: FulfillmentMode;
  amountBalanceArs: number;
}): PaymentKind {
  if (order.fulfillmentMode === "PICKUP" && order.amountBalanceArs > 0) {
    return "DEPOSIT";
  }

  return "FULL";
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
