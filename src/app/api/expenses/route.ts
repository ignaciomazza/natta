import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ExpenseCategory, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const categoryEnum = z.enum(["INGREDIENTS", "OPERATIONS", "MARKETING", "LOGISTICS", "OTHER"]);
const paymentMethodEnum = z.enum(["MERCADO_PAGO", "TRANSFER", "CASH", "MANUAL"]);
const paymentStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "REFUNDED"]);

const createSchema = z.object({
  occurredAt: z.string().datetime().optional(),
  description: z.string().min(2),
  category: categoryEnum.optional(),
  amountArs: z.number().int().min(1),
  paymentMethod: paymentMethodEnum.optional(),
  status: paymentStatusEnum.optional(),
});

const patchSchema = createSchema.extend({ id: z.string().min(1) }).partial({ description: true, amountArs: true });

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await prisma.expense.findMany({
      orderBy: [{ occurredAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.expenses.get", error);
    return NextResponse.json({ error: "No se pudieron listar gastos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = createSchema.parse(await req.json());

    const expense = await prisma.expense.create({
      data: {
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        description: body.description.trim(),
        category: (body.category ?? "OTHER") as ExpenseCategory,
        amountArs: body.amountArs,
        paymentMethod: (body.paymentMethod ?? "MANUAL") as PaymentMethod,
        status: (body.status ?? "APPROVED") as PaymentStatus,
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.expenses.post", error);
    return NextResponse.json({ error: "No se pudo crear gasto" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = patchSchema.parse(await req.json());

    const expense = await prisma.expense.update({
      where: { id: body.id },
      data: {
        ...(body.occurredAt !== undefined
          ? { occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date() }
          : {}),
        ...(body.description !== undefined ? { description: body.description.trim() } : {}),
        ...(body.category !== undefined
          ? { category: body.category as ExpenseCategory }
          : {}),
        ...(body.amountArs !== undefined ? { amountArs: body.amountArs } : {}),
        ...(body.paymentMethod !== undefined
          ? { paymentMethod: body.paymentMethod as PaymentMethod }
          : {}),
        ...(body.status !== undefined ? { status: body.status as PaymentStatus } : {}),
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.expenses.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar gasto" }, { status: 500 });
  }
}
