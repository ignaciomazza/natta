import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";

const supplierSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  notes: z.string().max(1000).optional(),
});

const supplierPatchSchema = supplierSchema
  .extend({
    id: z.string().min(1),
    isActive: z.boolean().optional(),
  })
  .partial({
    name: true,
  });

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const items = await prisma.supplier.findMany({
      orderBy: [{ name: "asc" }],
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    logServerError("api.suppliers.get", error);
    return NextResponse.json({ error: "No se pudieron listar proveedores" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = supplierSchema.parse(await req.json());

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name.trim(),
        contactName: body.contactName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.suppliers.post", error);
    return NextResponse.json({ error: "No se pudo crear proveedor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = supplierPatchSchema.parse(await req.json());

    const supplier = await prisma.supplier.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.contactName !== undefined
          ? { contactName: body.contactName?.trim() || null }
          : {}),
        ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.suppliers.patch", error);
    return NextResponse.json({ error: "No se pudo actualizar proveedor" }, { status: 500 });
  }
}
