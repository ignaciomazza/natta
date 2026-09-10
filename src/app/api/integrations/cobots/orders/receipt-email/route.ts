import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCobotsOperationsAuthorized } from "@/lib/integrations/cobots-operations";
import { buildReceiptContent, loadReceiptOrder, sendOrderReceiptEmailIfNeeded } from "@/lib/email/order-receipt";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const idSchema = z.string().min(1).max(150);
const commandSchema = z.object({
  id: z.uuid(), orderId: idSchema, actorUserId: idSchema,
  expectedRecipient: z.email(), expectedUpdatedAt: z.iso.datetime(),
  credentials: z.object({ accessToken: z.string().min(1).max(8192), from: z.string().min(1).max(360).regex(/^[^\r\n]+$/), replyTo: z.email().optional(), connectionId: z.iso.datetime() }).strict(),
}).strict();

export async function GET(request: NextRequest) {
  if (!isCobotsOperationsAuthorized(request.headers.get("authorization"))) return json({ error: "No autorizado" }, 401);
  const id = idSchema.safeParse(request.nextUrl.searchParams.get("orderId"));
  if (!id.success) return json({ error: "Pedido inválido" }, 400);
  const order = await loadReceiptOrder(id.data);
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  const history = await prisma.orderReceiptDelivery.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, origin: true, status: true, providerId: true, createdAt: true, sentAt: true, lastError: true } });
  const paid = order.payments.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + p.amountArs, 0);
  const email = order.customer.email?.trim().toLowerCase() ?? "";
  const eligible = order.status !== "CANCELLED" && z.email().safeParse(email).success && paid > 0 && paid >= order.amountDueNowArs;
  return json({ orderId: order.id, updatedAt: order.updatedAt.toISOString(), recipient: email, eligible,
    sentAt: order.receiptEmailSentAt, sentTo: order.receiptEmailSentTo, providerId: order.receiptEmailResendId,
    lastAttemptAt: order.receiptEmailLastAttemptAt, hasError: Boolean(order.receiptEmailLastError), history,
    content: await buildReceiptContent({ ...order, amountPaidArs: paid, amountBalanceArs: Math.max(0, order.subtotalArs - paid) }),
  });
}
export async function POST(request: NextRequest) {
  if (!isCobotsOperationsAuthorized(request.headers.get("authorization"))) return json({ error: "No autorizado" }, 401);
  try {
    const text = await request.text();
    if (text.length > 14000) return json({ error: "Solicitud demasiado grande" }, 413);
    const command = commandSchema.parse(JSON.parse(text));
    const result = await sendOrderReceiptEmailIfNeeded(command.orderId, { force: true, requestId: command.id, actorUserId: command.actorUserId, expectedRecipient: command.expectedRecipient, expectedUpdatedAt: command.expectedUpdatedAt, credentials: command.credentials });
    const delivery = await prisma.orderReceiptDelivery.findUnique({ where: { id: command.id }, select: { status: true } });
    return json({ id: command.id, ...result, deliveryStatus: delivery?.status ?? null });
  } catch { return json({ error: "No se pudo procesar el comprobante" }, 500); }
}
