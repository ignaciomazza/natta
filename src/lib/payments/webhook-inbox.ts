import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";
import { logServerError } from "@/lib/server/log";
import {
  getMercadoPagoEnvironment,
  getMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/payments/mercadopago";
import { applyMercadoPagoPaymentSnapshot } from "@/lib/payments/sync";

// Longer than the 60-second worker invocation. processedAt on unfinished
// events is the last attempt/lease time; on PROCESSED it is completion time.
const RETRY_AFTER_MS = 120_000;

function retryable(
  before = new Date(Date.now() - RETRY_AFTER_MS),
): Prisma.MercadoPagoWebhookEventWhereInput {
  return {
    topic: "payment",
    signature: { not: null },
    payload: {
      path: ["live_mode"],
      equals: getMercadoPagoEnvironment() === "production",
    },
    status: { in: ["RECEIVED", "ERROR"] },
    OR: [{ processedAt: null }, { processedAt: { lt: before } }],
  };
}

export async function processWebhookEvent(id: string) {
  const attemptAt = new Date();
  const claimed = await prisma.mercadoPagoWebhookEvent.updateMany({
    where: { id, ...retryable() },
    data: { status: "RECEIVED", processedAt: attemptAt, errorMessage: null },
  });
  if (claimed.count !== 1) return { id, status: "skipped" as const };

  // A stale worker must not overwrite the result of a newer attempt.
  const claim = { id, status: "RECEIVED" as const, processedAt: attemptAt };
  try {
    const event = await prisma.mercadoPagoWebhookEvent.findUniqueOrThrow({
      where: { id },
    });
    if (
      !event.resourceId ||
      !/^\d{1,32}$/.test(event.resourceId) ||
      !verifyMercadoPagoWebhookSignature({
        signature: event.signature,
        requestId: event.requestId,
        dataId: event.resourceId,
      })
    ) {
      throw new Error("STORED_WEBHOOK_SIGNATURE_INVALID");
    }
    const remote = await getMercadoPagoPayment(event.resourceId);
    const payment = await applyMercadoPagoPaymentSnapshot(remote, {
      sendReceipt: false,
    });
    if (!payment) throw new Error("PAYMENT_NOT_LINKED");

    // The payment is already committed. Mail failure leaves the event retryable
    // without reverting the confirmation or delaying the webhook response.
    if (payment.orderId && payment.status === "APPROVED") {
      const receipt = await sendOrderReceiptEmailIfNeeded(payment.orderId);
      if (receipt.error || receipt.skippedReason === "RECENT_ATTEMPT") {
        throw new Error(receipt.error ?? "RECEIPT_RETRY_PENDING");
      }
    }
    await prisma.mercadoPagoWebhookEvent.updateMany({
      where: claim,
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        errorMessage: null,
      },
    });
    return { id, status: "processed" as const };
  } catch (error) {
    await prisma.mercadoPagoWebhookEvent
      .updateMany({
        where: claim,
        data: {
          status: "ERROR",
          processedAt: new Date(),
          errorMessage:
            error instanceof Error
              ? error.message
              : "Webhook processing failed",
        },
      })
      .catch(() => null);
    logServerError("payments.webhook.process", error);
    return { id, status: "error" as const };
  }
}

export async function retryWebhookPage(end: string) {
  // Small concurrent batches keep one slow dependency inside the route budget.
  // A fixed cutoff excludes attempts made during this sweep. Oldest attempts
  // go first so permanently failing events cannot starve later ones across runs.
  const events = await prisma.mercadoPagoWebhookEvent.findMany({
    where: {
      ...retryable(new Date(Date.parse(end) - RETRY_AFTER_MS)),
      createdAt: { lte: new Date(end) },
    },
    orderBy: [{ processedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: 4,
    select: { id: true },
  });
  const page = events.slice(0, 3);
  const results = await Promise.allSettled(
    page.map(({ id }) => processWebhookEvent(id)),
  );
  return {
    checked: page.length,
    recovered: results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "processed",
    ).length,
    errors: results.flatMap((r, i) =>
      r.status === "rejected" || r.value.status === "error" ? [page[i].id] : [],
    ),
    hasMore: events.length > page.length,
  };
}
