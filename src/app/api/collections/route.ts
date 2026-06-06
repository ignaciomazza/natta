import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PaymentKind, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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

    const payment = await prisma.payment.create({
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
      await recalculateOrderPaymentSummary(payment.orderId);
    }

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

    const payment = await prisma.payment.update({
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

    const targetOrderId = payment.orderId ?? existing.orderId;
    if (targetOrderId) {
      await recalculateOrderPaymentSummary(targetOrderId);
    }

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.collections.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar cobro" }, { status: 500 });
  }
}
