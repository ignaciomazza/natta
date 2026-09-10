import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PaymentKind, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrderPaymentLocks } from "@/lib/payments/lock";
import { requireAuth } from "@/lib/auth/tenant";
import { recalculateOrderPaymentSummary } from "@/lib/payments/sync";
import { logServerError } from "@/lib/server/log";

const createSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().min(2).optional(),
  customerPhone: z.string().min(6).optional(),
  kind: z.enum(["DEPOSIT", "BALANCE", "FULL"]).default("FULL"),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "REFUNDED"])
    .default("APPROVED"),
  method: z.enum(["MERCADO_PAGO", "TRANSFER", "CASH", "MANUAL"]).default("MANUAL"),
  amountArs: z.number().int().min(1),
  paidAt: z.string().datetime().optional(),
  referenceNote: z.string().max(1000).optional(),
});

const patchSchema = createSchema
  .extend({
    id: z.string().min(1),
  })
  .partial({
    amountArs: true,
  });

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await prisma.payment.findMany({
      include: {
        order: {
          select: {
            id: true,
            publicReceiptCode: true,
            status: true,
            deliveryDate: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.collections.get", error);
    return NextResponse.json({ error: "No se pudieron listar cobros" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = createSchema.parse(await req.json());

    const payment = await withOrderPaymentLocks([body.orderId], async (tx) => {
    if (body.orderId && body.status === "APPROVED") {
      const order = await tx.order.findUnique({ where: { id: body.orderId }, include: { payments: { where: { status: "APPROVED" } } } });
      if (!order || order.status === "CANCELLED") throw new Error("COLLECTION_CONFLICT");
      const paid = order.payments.reduce((sum, payment) => sum + payment.amountArs, 0);
      if (body.amountArs > Math.max(0, order.subtotalArs - paid)) throw new Error("COLLECTION_CONFLICT");
    }
    const payment = await tx.payment.create({
      data: {
        orderId: body.orderId || null,
        customerId: body.customerId || null,
        customerName: body.customerName?.trim() || null,
        customerPhone: body.customerPhone?.trim() || null,
        kind: body.kind as PaymentKind,
        status: body.status as PaymentStatus,
        method: body.method as PaymentMethod,
        amountArs: body.amountArs,
        paidAt: body.paidAt ? new Date(body.paidAt) : body.status === "APPROVED" ? new Date() : null,
        referenceNote: body.referenceNote?.trim() || null,
      },
    });

    if (payment.orderId) {
      await recalculateOrderPaymentSummary(payment.orderId, tx);
    }
    return payment;
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof Error && ["COLLECTION_CONFLICT", "PAYMENT_ORDER_CHANGED"].includes(error.message)) {
      return NextResponse.json({ error: "El pedido cambió o el importe supera el saldo. Actualizá los datos antes de cobrar." }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.collections.post", error);
    return NextResponse.json({ error: "No se pudo crear cobro" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.payment.findUnique({
      where: { id: body.id },
      select: { id: true, orderId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
    }

    const payment = await withOrderPaymentLocks([existing.orderId, body.orderId], async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({ where: { id: existing.id } });
    if (current.orderId !== existing.orderId) throw new Error("PAYMENT_ORDER_CHANGED");
    const targetId = body.orderId !== undefined ? body.orderId || null : current.orderId;
    if (targetId && (body.status ?? current.status) === "APPROVED") {
      const order = await tx.order.findUniqueOrThrow({ where: { id: targetId }, include: { payments: { where: { status: "APPROVED", id: { not: current.id } } } } });
      const paid = order.payments.reduce((sum, payment) => sum + payment.amountArs, 0);
      if (order.status === "CANCELLED" && (current.status !== "APPROVED" || current.amountArs !== (body.amountArs ?? current.amountArs) || current.orderId !== targetId)) throw new Error("COLLECTION_CONFLICT");
      if (order.status !== "CANCELLED" && (body.amountArs ?? current.amountArs) > Math.max(0, order.subtotalArs - paid)) throw new Error("COLLECTION_CONFLICT");
    }
    const payment = await tx.payment.update({
      where: { id: body.id },
      data: {
        ...(body.orderId !== undefined ? { orderId: body.orderId || null } : {}),
        ...(body.customerId !== undefined ? { customerId: body.customerId || null } : {}),
        ...(body.customerName !== undefined
          ? { customerName: body.customerName?.trim() || null }
          : {}),
        ...(body.customerPhone !== undefined
          ? { customerPhone: body.customerPhone?.trim() || null }
          : {}),
        ...(body.kind !== undefined ? { kind: body.kind as PaymentKind } : {}),
        ...(body.status !== undefined ? { status: body.status as PaymentStatus } : {}),
        ...(body.method !== undefined ? { method: body.method as PaymentMethod } : {}),
        ...(body.amountArs !== undefined ? { amountArs: body.amountArs } : {}),
        ...(body.paidAt !== undefined ? { paidAt: body.paidAt ? new Date(body.paidAt) : null } : {}),
        ...(body.referenceNote !== undefined
          ? { referenceNote: body.referenceNote?.trim() || null }
          : {}),
      },
    });

    for (const orderId of new Set([payment.orderId, existing.orderId])) {
      if (orderId) await recalculateOrderPaymentSummary(orderId, tx);
    }
    return payment;
    });

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof Error && ["COLLECTION_CONFLICT", "PAYMENT_ORDER_CHANGED"].includes(error.message)) {
      return NextResponse.json({ error: "El pedido cambió o el importe supera el saldo. Actualizá los datos antes de cobrar." }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.collections.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar cobro" }, { status: 500 });
  }
}
