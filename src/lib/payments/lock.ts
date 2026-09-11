import { after } from "next/server";
import { pushCommerceOrder } from "@/lib/integrations/commerce-bridge";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function schedulePush(orderIds: string[]) {
  try { after(async () => { for (const id of orderIds) { try { await pushCommerceOrder(id); } catch { /* Reconciliation retries the durable outbox. */ } } }); } catch { /* Non-request workers drain the outbox explicitly. */ }
}
// Every writer that can confirm, start or discard a payment locks its order.
export async function withOrderPaymentLock<T>(orderId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    return action(tx);
  }, { timeout: 20000, maxWait: 10000 });
  schedulePush([orderId]);
  return result;
}
// Manual collections can move between orders; always lock in a stable order.
export async function withOrderPaymentLocks<T>(orderIds: (string | null | undefined)[], action: (tx: Prisma.TransactionClient) => Promise<T>) {
  const ids = [...new Set(orderIds.filter((id): id is string => Boolean(id)))].sort();
  const result = await prisma.$transaction(async (tx) => {
    for (const id of ids) await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    return action(tx);
  }, { timeout: 20000, maxWait: 10000 });
  schedulePush(ids);
  return result;
}
