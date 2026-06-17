import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
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

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const status = body.status ?? existing.status;

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        confirmedAt:
          status === "CONFIRMED" && existing.status !== "CONFIRMED"
            ? new Date()
            : undefined,
        deliveredAt:
          status === "DELIVERED" && existing.status !== "DELIVERED"
            ? new Date()
            : undefined,
        cancelledAt:
          status === "CANCELLED" && existing.status !== "CANCELLED"
            ? new Date()
            : undefined,
      },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    });

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

    await prisma.order.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.orders.id.delete", error);
    return NextResponse.json({ error: "No se pudo eliminar pedido" }, { status: 500 });
  }
}
