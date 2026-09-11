import { z } from "zod";

const id = z.string().trim().min(1).max(150);
const amount = z
  .number()
  .finite()
  .nonnegative()
  .max(999_999_999)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    "El importe admite hasta dos decimales.",
  );
const timestamp = z.coerce.date();
const optionalTimestamp = timestamp.nullable().default(null);
const optionalText = (max = 500) =>
  z.string().max(max).nullable().default(null);

export const commerceOrderSchema = z
  .object({
    id,
    reference: id,
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    locationId: id,
    scheduleId: id,
    fulfillmentMode: z.enum(["PICKUP", "DELIVERY"]),
    fulfillmentDate: timestamp,
    deliveryAddress: optionalText(),
    notes: optionalText(2000),
    status: z.enum(["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]),
    total: amount,
    amountDueNow: amount,
    amountPaid: amount,
    balance: amount,
    externalReference: optionalText(150),
    confirmedAt: optionalTimestamp,
    deliveredAt: optionalTimestamp,
    cancelledAt: optionalTimestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    customer: z
      .object({
        id,
        name: z.string().trim().min(1).max(160),
        email: z
          .union([z.email(), z.literal("")])
          .nullable()
          .default(null),
        phone: z.string().max(50),
        address: optionalText(),
        notes: optionalText(2000),
        isActive: z.boolean().default(true),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            id,
            productId: id,
            variantId: id,
            name: z.string().min(1).max(250),
            variantLabel: z.string().max(250),
            quantity: z.number().int().positive().max(1000),
            unitPrice: amount,
            total: amount,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    payments: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["DEPOSIT", "BALANCE", "FULL"]),
            status: z.enum([
              "PENDING",
              "APPROVED",
              "REJECTED",
              "CANCELLED",
              "REFUNDED",
            ]),
            method: z.string().min(1).max(80),
            amount,
            paidAt: optionalTimestamp,
            customerName: optionalText(160),
            customerPhone: optionalText(50),
            referenceNote: optionalText(),
            provider: optionalText(80),
            externalReference: optionalText(160),
            providerPreferenceId: optionalText(160),
            providerPaymentId: optionalText(160),
            statusDetail: optionalText(),
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .strict(),
      )
      .max(100),
    receipt: z
      .object({
        sentAt: timestamp,
        sentTo: z.email(),
        providerId: id.nullable(),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((order, ctx) => {
    const equal = (left: number, right: number) =>
      Math.abs(left - right) < 0.005;
    if (
      new Set(order.items.map((item) => item.id)).size !== order.items.length ||
      new Set(order.payments.map((payment) => payment.id)).size !==
        order.payments.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Hay renglones o pagos repetidos.",
      });
    if (
      !equal(
        order.items.reduce((sum, item) => sum + item.total, 0),
        order.total,
      ) ||
      order.items.some(
        (item) => !equal(item.quantity * item.unitPrice, item.total),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Los renglones no coinciden con el total.",
      });
    if (
      !equal(
        order.payments
          .filter((payment) => payment.status === "APPROVED")
          .reduce((sum, payment) => sum + payment.amount, 0),
        order.amountPaid,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Los cobros no coinciden con el importe recibido.",
      });
    if (
      order.amountDueNow > order.total ||
      (order.status !== "CANCELLED" &&
        !equal(order.balance, Math.max(0, order.total - order.amountPaid)))
    )
      ctx.addIssue({
        code: "custom",
        message: "La seña o el saldo no son válidos.",
      });
    if (order.updatedAt < order.createdAt)
      ctx.addIssue({
        code: "custom",
        message: "La revisión del pedido no es válida.",
      });
  });
export type CommerceOrder = z.infer<typeof commerceOrderSchema>;

export const commerceActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("COLLECT_BALANCE"),
      amount: amount.refine((value) => value > 0),
      method: z.enum(["CASH", "TRANSFER"]),
      referenceNote: z.string().trim().max(500).default(""),
    })
    .strict(),
  z.object({ action: z.literal("DELIVER") }).strict(),
  z
    .object({
      action: z.literal("CANCEL"),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);
export const commerceCommandSchema = z
  .object({
    id: z.uuid(),
    orderId: id,
    expectedUpdatedAt: z.iso.datetime(),
    requestedAt: z.iso.datetime(),
    actorUserId: id,
    operation: commerceActionSchema,
  })
  .strict();
export const commerceCommandResultSchema = z
  .object({
    id: z.uuid(),
    outcome: z.enum(["APPLIED", "REJECTED"]),
    message: z.string().max(1000),
    order: commerceOrderSchema.nullable(),
  })
  .strict();
export type CommerceAction = z.infer<typeof commerceActionSchema>;

export const commerceConnectionSchema = z.object({
  protocol: z.literal("cobots-commerce-v1"),
  channelId: id,
  endpoint: z.string().url(),
  tokenEncrypted: z.string().min(1),
  // Only a migration can provide the namespace of records already imported.
  idNamespace: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,80}$/)
    .optional(),
  paymentMappings: z.record(
    z.string(),
    z.object({ accountId: id, methodId: id }).strict(),
  ),
});

export function readCommerceOrderSnapshot(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const parsed = z
    .object({
      id,
      updatedAt: z.iso.datetime(),
      status: z.enum(["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]),
    })
    .safeParse(value.commerceOrder);
  return parsed.success && typeof value.commerceSourceId === "string"
    ? { ...parsed.data, sourceId: value.commerceSourceId }
    : null;
}
