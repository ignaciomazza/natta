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
