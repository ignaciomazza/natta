import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { withOrderPaymentLock } from "@/lib/payments/lock";
import { recalculateOrderPaymentSummary } from "@/lib/payments/sync";
import { nattaOrderCommandSchema, type NattaOrderCommand, type NattaOrderCommandResult } from "./cobots-contract";

export function isCobotsOperationsAuthorized(authorization: string | null) {
  const token = process.env.COBOTS_OPERATIONS_TOKEN?.trim();
  if (!token || token.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function applyCobotsOrderCommand(input: NattaOrderCommand): Promise<NattaOrderCommandResult> {
  const command = nattaOrderCommandSchema.parse(input);
  const payloadHash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return withOrderPaymentLock(command.orderId, async (tx) => {
    const previous = await tx.cobotsOrderOperation.findUnique({ where: { id: command.id } });
    if (previous) {
      if (previous.payloadHash !== payloadHash) throw new Error("OPERATION_ID_REUSED");
      return previous.result as NattaOrderCommandResult;
    }
    const order = await tx.order.findUnique({
      where: { id: command.orderId }, include: { payments: true, customer: true },
    });
    let message: string | null = null;
    const paid = order?.payments.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + p.amountArs, 0) ?? 0;
    const balance = order ? Math.max(0, order.subtotalArs - paid) : 0;
    const operation = command.operation;
    if (!order) message = "Pedido no encontrado en Natta.";
    else if (order.updatedAt.toISOString() !== command.expectedUpdatedAt) message = "El pedido cambió. Actualizá los datos antes de volver a operar.";
    else if (order.status === "CANCELLED" || order.status === "DELIVERED") message = "El pedido ya está cerrado.";
    else if (operation.action === "COLLECT_BALANCE") {
      if (order.status !== "CONFIRMED") message = "El pedido debe estar confirmado para cobrar el saldo.";
      else if (operation.amountArs > balance) message = "El importe supera el saldo pendiente. Actualizá el pedido.";
      else if (order.payments.some((p) => p.status === "PENDING" && p.providerPaymentId)) message = "Hay un pago en proceso. Revisalo antes de registrar otro cobro.";
    } else if (operation.action === "DELIVER") {
      if (order.status !== "CONFIRMED") message = "El pedido debe estar confirmado para entregarlo.";
      else if (balance > 0) message = "Registrá el cobro del saldo antes de entregar el pedido.";
    }
    let result: NattaOrderCommandResult;
    if (message || !order) {
      result = { id: command.id, outcome: "REJECTED", message: message ?? "Pedido no encontrado." };
    } else {
      const now = new Date(command.requestedAt);
      if (operation.action === "COLLECT_BALANCE") {
        await tx.payment.create({
          data: {
            orderId: order.id, customerId: order.customerId,
            customerName: order.customer.name, customerPhone: order.customer.phone,
            kind: "BALANCE", status: "APPROVED", method: operation.method,
            amountArs: operation.amountArs, paidAt: now, provider: "cobots",
            externalReference: `cobots:${command.id}`,
            referenceNote: operation.referenceNote || "Saldo registrado desde Cobots",
          },
        });
        await recalculateOrderPaymentSummary(order.id, tx);
      } else if (operation.action === "DELIVER") {
        await tx.order.update({ where: { id: order.id }, data: {
          status: "DELIVERED", deliveredAt: now, amountPaidArs: paid, amountBalanceArs: 0,
        } });
      } else {
        await tx.order.update({ where: { id: order.id }, data: {
          status: "CANCELLED", cancelledAt: now, amountPaidArs: paid, amountBalanceArs: 0,
        } });
      }
      const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { updatedAt: true } });
      result = {
        id: command.id, outcome: "APPLIED", updatedAt: updated.updatedAt.toISOString(),
        message: operation.action === "COLLECT_BALANCE" ? "Cobro registrado."
          : operation.action === "DELIVER" ? "Pedido entregado."
          : paid > 0 ? "Pedido cancelado. El dinero recibido queda a favor del cliente; la devolución se gestiona por separado."
          : "Pedido cancelado.",
      };
    }
    await tx.cobotsOrderOperation.create({ data: {
      id: command.id, orderId: command.orderId, actorUserId: command.actorUserId,
      payloadHash, request: command as Prisma.InputJsonValue,
      result: result as Prisma.InputJsonValue,
    } });
    return result;
  });
}
