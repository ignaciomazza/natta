import assert from "node:assert/strict";
import { calculateOrderTotals } from "@/lib/orders";
import {
  getOrderPaymentSummaryUpdate,
  normalizeProviderAmountArs,
} from "@/lib/payments/sync";
import { getAmountRequiredToConfirm } from "@/lib/payments/pending";

const pickupTotals = calculateOrderTotals("PICKUP", [
  {
    flavorId: "flavor",
    sizeId: "size",
    quantity: 1,
    unitPriceArs: 23000,
  },
]);
assert.equal(pickupTotals.subtotalArs, 23000);
assert.equal(pickupTotals.amountDueNowArs, 11500);
assert.equal(pickupTotals.amountBalanceArs, 11500);

const pickupFullTotals = calculateOrderTotals(
  "PICKUP",
  [
    {
      flavorId: "flavor",
      sizeId: "size",
      quantity: 1,
      unitPriceArs: 23000,
    },
  ],
  "full",
);
assert.equal(pickupFullTotals.subtotalArs, 23000);
assert.equal(pickupFullTotals.amountDueNowArs, 23000);
assert.equal(pickupFullTotals.amountBalanceArs, 0);

const deliveryTotals = calculateOrderTotals("DELIVERY", [
  {
    flavorId: "flavor",
    sizeId: "size",
    quantity: 2,
    unitPriceArs: 40000,
  },
]);
assert.equal(deliveryTotals.subtotalArs, 80000);
assert.equal(deliveryTotals.amountDueNowArs, 80000);
assert.equal(deliveryTotals.amountBalanceArs, 0);

assert.equal(
  getAmountRequiredToConfirm({
    amountDueNowArs: 11500,
    amountPaidArs: 1,
  }),
  11499,
);

assert.equal(
  getOrderPaymentSummaryUpdate({
    amountDueNowArs: 11500,
    currentStatus: "PENDING",
    totalPaidArs: 1,
  }).status,
  "PENDING",
);
assert.equal(
  getOrderPaymentSummaryUpdate({
    amountDueNowArs: 11500,
    currentStatus: "PENDING",
    totalPaidArs: 11500,
  }).status,
  "CONFIRMED",
);
assert.equal(
  getOrderPaymentSummaryUpdate({
    amountDueNowArs: 11500,
    currentStatus: "CONFIRMED",
    totalPaidArs: 0,
  }).status,
  "PENDING",
);
assert.equal(
  getOrderPaymentSummaryUpdate({
    amountDueNowArs: 11500,
    currentStatus: "DELIVERED",
    totalPaidArs: 0,
  }).status,
  "DELIVERED",
);

assert.equal(normalizeProviderAmountArs(11500), 11500);
assert.equal(normalizeProviderAmountArs(11500.4), 11500);
assert.equal(normalizeProviderAmountArs(0), null);
assert.equal(normalizeProviderAmountArs(-1), null);
assert.equal(normalizeProviderAmountArs(undefined), null);

console.log("Payment security smoke tests passed");
