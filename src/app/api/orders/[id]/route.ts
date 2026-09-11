import { getCommerceBridge } from "@/lib/integrations/commerce-bridge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { withOrderPaymentLock } from "@/lib/payments/lock";
import { logServerError } from "@/lib/server/log";

const patchSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req);
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            flavor: true,
            size: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.orders.id.get", error);
    return NextResponse.json({ error: "No se pudo obtener pedido" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const result = await withOrderPaymentLock(id, async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { payments: { where: { status: "APPROVED" }, select: { amountArs: true } } },
      });
      if (!existing) return { error: "Pedido no encontrado", status: 404 } as const;
      const status = body.status ?? existing.status;
      if (status !== existing.status && (existing.status === "CANCELLED" || existing.status === "DELIVERED")) {
        return { error: "El pedido ya está cerrado.", status: 409 } as const;
      }
      const paid = existing.payments.reduce((sum, payment) => sum + payment.amountArs, 0);
      if (status === "DELIVERED" && paid < existing.subtotalArs) {
        return { error: "Registrá el saldo antes de entregar el pedido.", status: 409 } as const;
      }
      const order = await tx.order.update({
        where: { id },
        data: {
          status,
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          amountPaidArs: paid,
          amountBalanceArs: status === "CANCELLED" ? 0 : Math.max(0, existing.subtotalArs - paid),
          confirmedAt: status === "CONFIRMED" && existing.status !== "CONFIRMED" ? new Date() : undefined,
          deliveredAt: status === "DELIVERED" && existing.status !== "DELIVERED" ? new Date() : undefined,
          cancelledAt: status === "CANCELLED" && existing.status !== "CANCELLED" ? new Date() : undefined,
        },
        include: { customer: true, items: true, payments: true },
      });
      return { order } as const;
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const order = result.order;

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.orders.id.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar pedido" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if ((await getCommerceBridge())?.enabled) return NextResponse.json({ error: "Los pedidos conectados conservan su historial. Usá Cancelar." }, { status: 409 });
    await requireAuth(req);
    const { id } = await params;

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (existing.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar pedidos cancelados" },
        { status: 409 },
      );
    }

    const deleted = await withOrderPaymentLock(id, async (tx) => {
      if (await tx.cobotsOrderOperation.count({ where: { orderId: id } })) return false;
      const current = await tx.order.findUnique({ where: { id }, select: { status: true } });
      if (current?.status !== "CANCELLED") return false;
      await tx.order.delete({ where: { id } });
      return true;
    });
    if (!deleted) return NextResponse.json({ error: "Conservá este pedido para mantener el historial de operaciones." }, { status: 409 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.orders.id.delete", error);
    return NextResponse.json({ error: "No se pudo eliminar pedido" }, { status: 500 });
  }
}
