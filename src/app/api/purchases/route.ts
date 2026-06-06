import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const paymentMethodEnum = z.enum(["MERCADO_PAGO", "TRANSFER", "CASH", "MANUAL"]);
const paymentStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "REFUNDED"]);

const purchaseSchema = z.object({
  supplierId: z.string().optional(),
  purchasedAt: z.string().datetime().optional(),
  description: z.string().min(2),
  amountArs: z.number().int().min(1),
  paymentMethod: paymentMethodEnum.optional(),
  status: paymentStatusEnum.optional(),
});

const purchasePatchSchema = purchaseSchema
  .extend({ id: z.string().min(1) })
  .partial({ description: true, amountArs: true });

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await prisma.purchase.findMany({
      include: {
        supplier: true,
      },
      orderBy: [{ purchasedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    logServerError("api.purchases.get", error);
    return NextResponse.json({ error: "No se pudieron listar compras" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = purchaseSchema.parse(await req.json());

    const purchase = await prisma.purchase.create({
      data: {
        supplierId: body.supplierId || null,
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date(),
        description: body.description.trim(),
        amountArs: body.amountArs,
        paymentMethod: (body.paymentMethod ?? "MANUAL") as PaymentMethod,
        status: (body.status ?? "PENDING") as PaymentStatus,
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(purchase);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.purchases.post", error);
    return NextResponse.json({ error: "No se pudo crear compra" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = purchasePatchSchema.parse(await req.json());

    const purchase = await prisma.purchase.update({
      where: { id: body.id },
      data: {
        ...(body.supplierId !== undefined ? { supplierId: body.supplierId || null } : {}),
        ...(body.purchasedAt !== undefined
          ? { purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date() }
          : {}),
        ...(body.description !== undefined ? { description: body.description.trim() } : {}),
        ...(body.amountArs !== undefined ? { amountArs: body.amountArs } : {}),
        ...(body.paymentMethod !== undefined
          ? { paymentMethod: body.paymentMethod as PaymentMethod }
          : {}),
        ...(body.status !== undefined ? { status: body.status as PaymentStatus } : {}),
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(purchase);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.purchases.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar compra" }, { status: 500 });
  }
}
