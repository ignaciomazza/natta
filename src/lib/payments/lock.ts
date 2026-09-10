import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Every writer that can confirm, start or discard a payment locks its order.
export function withOrderPaymentLock<T>(
  orderId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      return action(tx);
    },
    { timeout: 20000, maxWait: 10000 },
  );
}

// Manual collections can be moved between orders; always lock in a stable order.
export function withOrderPaymentLocks<T>(
  orderIds: (string | null | undefined)[],
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    for (const id of [...new Set(orderIds.filter((id): id is string => Boolean(id)))].sort()) {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    }
    return action(tx);
  }, { timeout: 20000, maxWait: 10000 });
}
