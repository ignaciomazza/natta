import { timingSafeEqual } from "node:crypto";
import { Prisma, type BranchCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { commerceOrderSchema } from "./commerce-contract";

export const bridgeSettingsSchema = z
  .object({
    branches: z.record(
      z.enum(["DEVOTO", "NORDELTA"]),
      z.object({ locationId: z.string(), scheduleId: z.string() }),
    ),
    variants: z
      .array(
        z.object({
          flavorId: z.string(),
          sizeId: z.string(),
          productId: z.string(),
          variantId: z.string(),
        }),
      )
      .min(1),
  })
  .strict();
export async function getCommerceBridge() {
  if (!process.env.COBOTS_API_URL && !process.env.COBOTS_STOREFRONT_API_KEY)
    return null;
  const row = await prisma.commerceBridgeConfig.findUnique({
    where: { id: "default" },
  });
  return row
    ? {
        enabled: row.enabled,
        settings: bridgeSettingsSchema.parse(row.settings),
      }
    : null;
}
export function authorizeCommerce(authorization: string | null) {
  const token = process.env.COBOTS_INTEGRATION_TOKEN?.trim();
  if (!token || token.length < 32 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${token}`),
    received = Buffer.from(authorization);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
export class CommerceBridgeError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
export async function cobotsRequest(path: string, payload?: unknown) {
  const base = process.env.COBOTS_API_URL?.trim(),
    key = process.env.COBOTS_STOREFRONT_API_KEY?.trim();
  if (!base || !key)
    throw new CommerceBridgeError(
      "La conexión con Cobots no está configurada.",
    );
  const url = new URL(path, base);
  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new CommerceBridgeError("La conexión no es válida.");
  const response = await fetch(url, {
    method: payload === undefined ? "GET" : "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "x-cobots-storefront-api-key": key,
      "Content-Type": "application/json",
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new CommerceBridgeError(
      typeof result.error === "string"
        ? result.error
        : "No se pudo actualizar Cobots.",
      response.status >= 500 ? 503 : response.status,
    );
  return result;
}
export async function exportCommerceOrder(orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      const bridge = await tx.commerceBridgeConfig.findUniqueOrThrow({
        where: { id: "default" },
      });
      const config = bridgeSettingsSchema.parse(bridge.settings);
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          customer: true,
          items: {
            include: { flavor: true, size: true },
            orderBy: { id: "asc" },
          },
          payments: { orderBy: { id: "asc" } },
        },
      });
      const pendingEmails = await tx.orderReceiptDelivery.count({
        where: { orderId, status: { in: ["PENDING", "UNCERTAIN", "REVIEW"] } },
      });
      if (pendingEmails)
        throw new CommerceBridgeError(
          "Hay un comprobante anterior pendiente de revisión.",
          409,
        );
      const target = config.branches[order.branchCode];
      const paid = order.payments
        .filter((p) => p.status === "APPROVED")
        .reduce((sum, p) => sum + p.amountArs, 0);
      const snapshot = commerceOrderSchema.parse({
        id: order.id,
        reference: order.publicReceiptCode,
        currencyCode: "ARS",
        ...target,
        fulfillmentMode: order.fulfillmentMode,
        fulfillmentDate: order.deliveryDate,
        deliveryAddress: order.deliveryAddress,
        notes: order.notes,
        status: order.status,
        total: order.subtotalArs,
        amountDueNow: order.amountDueNowArs,
        amountPaid: paid,
        balance:
          order.status === "CANCELLED"
            ? 0
            : Math.max(0, order.subtotalArs - paid),
        externalReference: order.mercadoPagoExternalReference,
        confirmedAt: order.confirmedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
          address: order.customer.address,
          notes: order.customer.notes,
          isActive: order.customer.isActive,
          createdAt: order.customer.createdAt,
          updatedAt: order.customer.updatedAt,
        },
        items: order.items.map((item) => {
          const variant = config.variants.find(
            (v) => v.flavorId === item.flavorId && v.sizeId === item.sizeId,
          );
          if (!variant)
            throw new CommerceBridgeError(
              "Falta vincular una variante del catálogo.",
              409,
            );
          return {
            id: item.id,
            productId: variant.productId,
            variantId: variant.variantId,
            name: item.flavor.name,
            variantLabel: item.size.name,
            quantity: item.quantity,
            unitPrice: item.unitPriceArs,
            total: item.subtotalArs,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
        }),
        payments: order.payments.map((p) => ({
          id: p.id,
          kind: p.kind,
          status: p.status,
          method: p.method,
          amount: p.amountArs,
          paidAt: p.paidAt,
          customerName: p.customerName,
          customerPhone: p.customerPhone,
          referenceNote: p.referenceNote,
          provider: p.provider,
          externalReference: p.externalReference,
          providerPreferenceId: p.providerPreferenceId,
          providerPaymentId: p.providerPaymentId,
          statusDetail: p.statusDetail,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        receipt:
          order.receiptEmailSentAt && order.receiptEmailSentTo
            ? {
                sentAt: order.receiptEmailSentAt,
                sentTo: order.receiptEmailSentTo,
                providerId: order.receiptEmailResendId,
              }
            : null,
      });
      const outbox = await tx.commerceOutbox.findUnique({ where: { orderId } });
      return { snapshot, version: outbox?.version ?? 0 };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    },
  );
}
export async function pushCommerceOrder(orderId: string) {
  const bridge = await getCommerceBridge();
  if (!bridge?.enabled) return null;
  const { snapshot, version } = await exportCommerceOrder(orderId);
  try {
    const result = await cobotsRequest(
      "/api/storefront/commerce/orders",
      snapshot,
    );
    await prisma.commerceOutbox.updateMany({
      where: { orderId, version },
      data: {
        pushedVersion: version,
        lastAttemptAt: new Date(),
        lastError: null,
      },
    });
    return result;
  } catch (error) {
    await prisma.commerceOutbox.updateMany({
      where: { orderId },
      data: {
        lastAttemptAt: new Date(),
        lastError: "No se pudo confirmar la actualización con Cobots.",
      },
    });
    throw error;
  }
}
export async function drainCommerceOutbox(limit = 10) {
  const bridge = await getCommerceBridge();
  if (!bridge?.enabled) return { processed: 0, errors: 0, hasMore: false };
  const pending = await prisma.$queryRaw<
    Array<{ orderId: string }>
  >`SELECT "orderId" FROM "CommerceOutbox" WHERE "version" > "pushedVersion" ORDER BY "lastAttemptAt" ASC NULLS FIRST, "updatedAt" ASC LIMIT ${limit}`;
  let errors = 0;
  for (const row of pending) {
    try {
      await pushCommerceOrder(row.orderId);
    } catch {
      errors++;
    }
  }
  return {
    processed: pending.length,
    errors,
    hasMore: pending.length === limit,
  };
}
export async function commerceBranch(branchCode: BranchCode) {
  const bridge = await getCommerceBridge();
  if (!bridge) throw new CommerceBridgeError("Falta configurar la conexión.");
  return bridge.settings.branches[branchCode];
}
