import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FulfillmentMode, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";
import { createPaymentExternalReference, createPublicReceiptCode, paymentKindByMode, calculateOrderTotals } from "@/lib/orders";
import { validateCapacityForOrder } from "@/lib/capacity";
import { applyPriceMultiplier } from "@/lib/price-adjustments";

const orderCreateSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(6),
    email: z.string().email().optional(),
    address: z.string().min(3).optional(),
  }),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fulfillmentMode: z.enum(["pickup", "delivery"]),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        flavorId: z.string().min(1),
        sizeId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1),
});

export const runtime = "nodejs";

function mapFulfillmentMode(value: "pickup" | "delivery"): FulfillmentMode {
  return value === "pickup" ? "PICKUP" : "DELIVERY";
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const mode = req.nextUrl.searchParams.get("mode")?.trim();
    const from = req.nextUrl.searchParams.get("from")?.trim();
    const to = req.nextUrl.searchParams.get("to")?.trim();

    const where: Record<string, unknown> = {
      ...(status
        ? {
            status: status.toUpperCase() as "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED",
          }
        : {}),
      ...(mode
        ? {
            fulfillmentMode:
              mode === "pickup"
                ? "PICKUP"
                : mode === "delivery"
                  ? "DELIVERY"
                  : undefined,
          }
        : {}),
      ...(from || to
        ? {
            deliveryDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { publicReceiptCode: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { customer: { phone: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const orders = await prisma.order.findMany({
      where,
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
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({
      items: orders.map((order) => ({
        id: order.id,
        status: order.status,
        fulfillmentMode: order.fulfillmentMode,
        deliveryDate: order.deliveryDate,
        publicReceiptCode: order.publicReceiptCode,
        subtotalArs: order.subtotalArs,
        amountDueNowArs: order.amountDueNowArs,
        amountPaidArs: order.amountPaidArs,
        amountBalanceArs: order.amountBalanceArs,
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email,
        },
        items: order.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPriceArs: item.unitPriceArs,
          subtotalArs: item.subtotalArs,
          flavor: item.flavor.name,
          size: item.size.name,
        })),
        payments: order.payments,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    logServerError("api.orders.get", error);
    return NextResponse.json({ error: "No se pudieron listar los pedidos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = orderCreateSchema.parse(await req.json());

    const mode = mapFulfillmentMode(body.fulfillmentMode);
    const pairKeys = body.items.map((item) => `${item.flavorId}::${item.sizeId}`);
    const prices = await prisma.price.findMany({
      where: {
        OR: body.items.map((item) => ({
          flavorId: item.flavorId,
          sizeId: item.sizeId,
        })),
      },
      include: {
        flavor: {
          select: {
            isActive: true,
          },
        },
        size: {
          select: {
            isActive: true,
          },
        },
      },
    });

    const priceByKey = new Map(prices.map((price) => [`${price.flavorId}::${price.sizeId}`, price]));
    if (priceByKey.size !== pairKeys.length) {
      return NextResponse.json({ error: "Item de catalogo invalido" }, { status: 400 });
    }

    for (const item of body.items) {
      const price = priceByKey.get(`${item.flavorId}::${item.sizeId}`);
      if (!price || !price.flavor.isActive || !price.size.isActive) {
        return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
      }
    }

    const orderItems = body.items.map((item) => {
      const price = priceByKey.get(`${item.flavorId}::${item.sizeId}`)!;
      return {
        flavorId: item.flavorId,
        sizeId: item.sizeId,
        quantity: item.quantity,
        unitPriceArs: applyPriceMultiplier(price.amountArs),
      };
    });

    const requestedUnits = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    await validateCapacityForOrder({
      deliveryDate: body.deliveryDate,
      requestedUnits,
    });

    const totals = calculateOrderTotals(mode, orderItems);

    const customer = await prisma.customer.upsert({
      where: {
        phone: body.customer.phone.trim(),
      },
      update: {
        name: body.customer.name.trim(),
        email: body.customer.email?.trim() || null,
        address: body.customer.address?.trim() || null,
      },
      create: {
        name: body.customer.name.trim(),
        phone: body.customer.phone.trim(),
        email: body.customer.email?.trim() || null,
        address: body.customer.address?.trim() || null,
      },
    });

    let publicReceiptCode = createPublicReceiptCode();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const exists = await prisma.order.findUnique({
        where: { publicReceiptCode },
        select: { id: true },
      });
      if (!exists) break;
      publicReceiptCode = createPublicReceiptCode();
    }

    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        fulfillmentMode: mode,
        deliveryDate: new Date(`${body.deliveryDate}T12:00:00`),
        deliveryAddress: body.fulfillmentMode === "delivery" ? body.customer.address?.trim() || null : null,
        notes: body.notes?.trim() || null,
        subtotalArs: totals.subtotalArs,
        amountDueNowArs: totals.amountDueNowArs,
        amountBalanceArs: totals.amountBalanceArs,
        publicReceiptCode,
        items: {
          create: orderItems.map((item) => ({
            flavorId: item.flavorId,
            sizeId: item.sizeId,
            quantity: item.quantity,
            unitPriceArs: item.unitPriceArs,
            subtotalArs: item.unitPriceArs * item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    const externalReference = createPaymentExternalReference(order.id);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        kind: paymentKindByMode(mode),
        status: "PENDING",
        method: PaymentMethod.MERCADO_PAGO,
        amountArs: order.amountDueNowArs,
        customerName: customer.name,
        customerPhone: customer.phone,
        externalReference,
        provider: "mercadopago",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        mercadoPagoExternalReference: externalReference,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      publicReceiptCode: order.publicReceiptCode,
      paymentIntent: {
        paymentId: payment.id,
        externalReference,
        amountArs: payment.amountArs,
        kind: payment.kind,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === "DATE_TOO_SOON") {
        return NextResponse.json({ error: "Fecha sin anticipacion suficiente" }, { status: 400 });
      }
      if (error.message === "DATE_CLOSED") {
        return NextResponse.json({ error: "Fecha cerrada" }, { status: 400 });
      }
      if (error.message === "CAPACITY_EXCEEDED") {
        return NextResponse.json({ error: "No hay cupo suficiente en esa fecha" }, { status: 409 });
      }
      if (error.message === "CUTOFF_REACHED") {
        return NextResponse.json({ error: "Horario de corte alcanzado" }, { status: 400 });
      }
    }

    logServerError("api.orders.post", error);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}
