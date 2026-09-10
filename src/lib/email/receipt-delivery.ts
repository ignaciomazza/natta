import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrderPaymentLock } from "@/lib/payments/lock";
import { buildReceiptContent, getReceiptEmailFrom, getReceiptEmailReplyTo, type OrderReceiptEmailResult, type SendOrderReceiptEmailOptions } from "./order-receipt";

const bodySchema = z.object({ from: z.string(), to: z.email(), subject: z.string(), html: z.string(), text: z.string(), reply_to: z.string().optional() });
const skip = (skippedReason: NonNullable<OrderReceiptEmailResult["skippedReason"]>, error?: string): OrderReceiptEmailResult => ({ sent: false, skippedReason, ...(error ? { error } : {}) });

// Persist before calling Resend. Uncertain retries keep the exact same body and key.
export async function dispatchOrderReceipt(orderId: string, options: SendOrderReceiptEmailOptions = {}, fetcher = fetch): Promise<OrderReceiptEmailResult> {
  const id = options.requestId ?? (options.force ? randomUUID() : `automatic:${orderId}`);
  const prepared = await withOrderPaymentLock(orderId, async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: {
      customer: true, items: { include: { flavor: true, size: true }, orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "asc" } },
    } });
    if (!order) return { result: skip("ORDER_NOT_FOUND") };
    const previous = await tx.orderReceiptDelivery.findUnique({ where: { id } });
    if (previous && (previous.orderId !== orderId || previous.connectionId !== (options.credentials?.connectionId ?? null) || previous.actorUserId !== (options.actorUserId ?? null))) return { result: skip("ORDER_CHANGED") };
    if (previous?.status === "SENT") return { result: { sent: true, resendId: previous.providerId, sentTo: bodySchema.parse(previous.body).to } };
    if (order.status === "CANCELLED") return { result: skip("ORDER_CANCELLED") };
    if (!previous && order.receiptEmailSentAt && !options.force) return { result: { sent: false, skippedReason: "ALREADY_SENT" as const, resendId: order.receiptEmailResendId, sentTo: order.receiptEmailSentTo ?? undefined } };
    const pending = await tx.orderReceiptDelivery.findFirst({ where: { orderId, id: { not: id }, status: { in: ["PENDING", "UNCERTAIN", "REVIEW"] } } });
    if (pending) return { result: skip(pending.status === "REVIEW" ? "REVIEW_REQUIRED" : "RECENT_ATTEMPT") };
    const now = new Date();
    if (!previous && !options.force && order.receiptEmailLastAttemptAt) {
      const age = now.getTime() - order.receiptEmailLastAttemptAt.getTime();
      if (age < 10 * 60000) return { result: skip("RECENT_ATTEMPT") };
      if (age >= 23 * 3600000) return { result: skip("REVIEW_REQUIRED") };
    }
    if (previous?.lockedUntil && previous.lockedUntil > now) return { result: skip("RECENT_ATTEMPT") };
    if (previous && (previous.status === "REVIEW" || now.getTime() - previous.firstAttemptAt.getTime() >= 23 * 3600000)) {
      await tx.orderReceiptDelivery.update({ where: { id }, data: { status: "REVIEW", lastError: "El resultado requiere revisión en Resend antes de reenviar." } });
      return { result: skip("REVIEW_REQUIRED") };
    }
    const recipient = order.customer.email?.trim().toLowerCase() ?? "";
    if (!z.email().safeParse(recipient).success) return { result: skip("INVALID_EMAIL") };
    if (!previous && ((options.expectedRecipient && options.expectedRecipient !== recipient) || (options.expectedUpdatedAt && options.expectedUpdatedAt !== order.updatedAt.toISOString()))) return { result: skip("ORDER_CHANGED") };
    const paid = order.payments.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + p.amountArs, 0);
    if (!paid) return { result: skip("PAYMENT_NOT_APPROVED") };
    if (paid < order.amountDueNowArs) return { result: skip("AMOUNT_NOT_COVERED") };
    // Render current approved payments; both manual collections and Mercado Pago appear.
    const body = previous ? bodySchema.parse(previous.body) : bodySchema.parse({
      ...await buildReceiptContent({ ...order, amountPaidArs: paid, amountBalanceArs: Math.max(0, order.subtotalArs - paid) }),
      from: options.credentials?.from ?? getReceiptEmailFrom(),
      reply_to: options.credentials?.replyTo ?? getReceiptEmailReplyTo(), to: recipient,
    });
    const storedKey = previous ? z.object({ idempotencyKey: z.string().optional() }).parse(previous.body).idempotencyKey : null;
    // Keep the key used by the legacy automatic sender during the transition.
    const providerKey = storedKey ?? (previous || options.force ? `natta-receipt/${id}` : `order-receipt-${orderId}-${paid}`);
    const uncertain = Boolean(previous && ["PENDING", "UNCERTAIN"].includes(previous.status));
    const lockedUntil = new Date(now.getTime() + 30000);
    await tx.orderReceiptDelivery.upsert({ where: { id }, create: {
      id, orderId, actorUserId: options.actorUserId, origin: options.credentials ? "COBOTS" : options.force ? "NATTA" : "AUTOMATIC",
      connectionId: options.credentials?.connectionId, body: { ...body, idempotencyKey: providerKey } as Prisma.InputJsonValue, firstAttemptAt: !options.force && order.receiptEmailLastAttemptAt ? order.receiptEmailLastAttemptAt : now, lockedUntil,
    }, update: { status: "PENDING", lockedUntil } });
    await tx.order.update({ where: { id: orderId }, data: { receiptEmailLastAttemptAt: now } });
    return { body, providerKey, uncertain };
  });
  if (prepared.result) return prepared.result;
  const token = options.credentials?.accessToken ?? process.env.RESEND_API_KEY?.trim();
  let definitiveFailure = false;
  try {
    if (!token) { definitiveFailure = true; throw new Error("Falta configurar Resend."); }
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "Natta/1.0", "Idempotency-Key": prepared.providerKey! },
      body: JSON.stringify(prepared.body),
    });
    if (!response.ok) {
      // Never expose a provider response that might echo a secret or HTML body.
      definitiveFailure = response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status);
      throw new Error(response.status === 401 || response.status === 403 ? "Resend rechazó la autorización o el remitente. Revisá la conexión." : `Resend no confirmó el envío (${response.status}).`);
    }
    const payload = z.object({ id: z.string().min(1) }).parse(await response.json());
    const sentAt = new Date();
    await prisma.$transaction([
      prisma.orderReceiptDelivery.update({ where: { id }, data: { status: "SENT", providerId: payload.id, sentAt, lockedUntil: null, lastError: null } }),
      prisma.order.update({ where: { id: orderId }, data: { receiptEmailSentAt: sentAt, receiptEmailSentTo: prepared.body!.to, receiptEmailResendId: payload.id, receiptEmailLastError: null } }),
    ]);
    return { sent: true, resendId: payload.id, sentTo: prepared.body!.to };
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Resend") ? error.message : "No se pudo confirmar el envío. Reintentá esta misma solicitud.";
    await prisma.$transaction([
      prisma.orderReceiptDelivery.updateMany({ where: { id, status: { not: "SENT" } }, data: { status: definitiveFailure && !prepared.uncertain ? "FAILED" : "UNCERTAIN", lastError: message, lockedUntil: null } }),
      prisma.order.update({ where: { id: orderId }, data: { receiptEmailLastError: message } }),
    ]).catch(() => null);
    if (options.throwOnError) throw new Error(message);
    return skip("SEND_FAILED", message);
  }
}
