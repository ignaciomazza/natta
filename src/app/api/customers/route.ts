import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  address: z.string().min(3).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(3).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ items: customers });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.customers.get", error);
    return NextResponse.json({ error: "No se pudieron listar clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = createSchema.parse(await req.json());

    const customer = await prisma.customer.create({
      data: {
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.customers.post", error);
    return NextResponse.json({ error: "No se pudo crear cliente" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = patchSchema.parse(await req.json());

    const customer = await prisma.customer.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
        ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.customers.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar cliente" }, { status: 500 });
  }
}
