import { prisma } from "@/lib/prisma";
import { getMercadoPagoPayment, searchRecentMercadoPagoPayments } from "@/lib/payments/mercadopago";
import {
  applyMercadoPagoPaymentSnapshot,
  recalculateOrderPaymentSummary,
} from "@/lib/payments/sync";
import { sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";
import { withOrderPaymentLock } from "@/lib/payments/lock";

export async function reconcilePaymentPage(offset: number, end: string) {
  const result = await searchRecentMercadoPagoPayments(offset, end);
  const page = result.results ?? [];
  // One invocation has 60 seconds. Bound expensive GET/mail work, run it in
  // parallel, and return the exact search offset of the first untouched item.
  // Unrelated account payments can be skipped without spending a worker slot.
  let consumed = 0;
  let related = 0;
  for (const payment of page) {
    if (payment.external_reference?.startsWith("natta_")) {
      if (related === 3) break;
      related++;
    }
    consumed++;
  }
  const remote = page.slice(0, consumed).filter((payment) =>
    payment.external_reference?.startsWith("natta_"),
  );
  const local = await prisma.payment.findMany({
    where: {
      OR: [
        { providerPaymentId: { in: remote.map((p) => String(p.id)) } },
        { externalReference: { in: remote.map((p) => p.external_reference!) } },
      ],
    },
    include: { order: true },
  });
  let recovered = 0;
  const attention: string[] = [];
  const errors: string[] = [];
  await Promise.all(remote.map(async (payment) => {
    const current =
      local.find((p) => p.providerPaymentId === String(payment.id)) ??
      local.find((p) => p.externalReference === payment.external_reference);
    if (!current?.orderId) {
      if (
        ["approved", "refunded", "charged_back"].includes(payment.status ?? "")
      )
        attention.push(String(payment.id));
      return;
    }
    try {
      const saved = current.providerPayload as Record<string, unknown> | null;
      const needsSnapshot =
        current.providerPaymentId !== String(payment.id) ||
        saved?.status !== payment.status ||
        saved?.transaction_amount !== payment.transaction_amount ||
        saved?.date_last_updated !== payment.date_last_updated ||
        (payment.status === "approved" && current.status !== "APPROVED");
      let approved = payment.status === "approved";
      if (needsSnapshot) {
        // Search finds candidates; a direct GET gives the authoritative current state.
        const updated = await applyMercadoPagoPaymentSnapshot(
          await getMercadoPagoPayment(String(payment.id)),
          { sendReceipt: false },
        );
        if (!updated) throw new Error("PAYMENT_NOT_LINKED");
        approved = updated.status === "APPROVED";
        recovered += 1;
      } else if (payment.status === "approved") {
        // Also recover a process interrupted between saving payment and sending email.
        if (
          current.order?.status === "PENDING" ||
          (current.order && current.order.amountPaidArs < current.amountArs)
        ) {
          await withOrderPaymentLock(current.orderId, (tx) =>
            recalculateOrderPaymentSummary(current.orderId!, tx),
          );
        }
      }
      if (approved && !current.order?.receiptEmailSentAt) {
        const receipt = await sendOrderReceiptEmailIfNeeded(current.orderId);
        if (receipt.error) throw new Error(receipt.error);
      }
      if (
        current.order?.status === "CANCELLED" &&
        approved
      )
        attention.push(String(payment.id));
    } catch {
      errors.push(String(payment.id));
    }
  }));
  const nextOffset = offset + consumed;
  return {
    checked: remote.length,
    recovered,
    attention: attention.sort(),
    errors: errors.sort(),
    nextOffset:
      page.length && nextOffset < (result.paging?.total ?? nextOffset)
        ? nextOffset
        : null,
  };
}
