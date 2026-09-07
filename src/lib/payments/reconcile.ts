import { prisma } from "@/lib/prisma";
import { searchRecentMercadoPagoPayments } from "@/lib/payments/mercadopago";
import {
  syncMercadoPagoPayment,
  recalculateOrderPaymentSummary,
} from "@/lib/payments/sync";
import { sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";
import { withOrderPaymentLock } from "@/lib/payments/lock";

export async function reconcilePaymentPage(offset: number, end: string) {
  const result = await searchRecentMercadoPagoPayments(offset, end);
  const page = result.results ?? [];
  const remote = page.filter((payment) =>
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
  for (const payment of remote) {
    const current =
      local.find((p) => p.providerPaymentId === String(payment.id)) ??
      local.find((p) => p.externalReference === payment.external_reference);
    if (!current?.orderId) {
      if (
        ["approved", "refunded", "charged_back"].includes(payment.status ?? "")
      )
        attention.push(String(payment.id));
      continue;
    }
    try {
      const saved = current.providerPayload as Record<string, unknown> | null;
      const needsSnapshot =
        current.providerPaymentId !== String(payment.id) ||
        saved?.status !== payment.status ||
        saved?.transaction_amount !== payment.transaction_amount ||
        (payment.status === "approved" && current.status !== "APPROVED");
      if (needsSnapshot) {
        // Search finds candidates; a direct GET gives the authoritative current state.
        await syncMercadoPagoPayment(String(payment.id));
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
        if (!current.order?.receiptEmailSentAt)
          await sendOrderReceiptEmailIfNeeded(current.orderId);
      }
      if (
        current.order?.status === "CANCELLED" &&
        payment.status === "approved"
      )
        attention.push(String(payment.id));
    } catch {
      errors.push(String(payment.id));
    }
  }
  const nextOffset = offset + page.length;
  return {
    checked: remote.length,
    recovered,
    attention,
    errors,
    nextOffset:
      page.length && nextOffset < (result.paging?.total ?? nextOffset)
        ? nextOffset
        : null,
  };
}
