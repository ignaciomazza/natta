import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { BranchCode, FulfillmentMode, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/tenant";
import { logServerError } from "@/lib/server/log";
import {
  calculateOrderTotals,
  createPaymentExternalReference,
  createPublicReceiptCode,
  paymentKindByOrderPaymentOption,
  resolveOrderPaymentOption,
} from "@/lib/orders";
import { getDateOnlyString } from "@/lib/date-only";
import {
  getDateAtNoon,
  getDateRange,
  validateCapacityForOrder,
} from "@/lib/capacity";
import { applyPriceMultiplier } from "@/lib/price-adjustments";
import { isCatalogPairAvailableAtBranch } from "@/lib/catalog-db";
import { getBranchByCode, getBranchBySlug } from "@/lib/branches";

const orderCreateSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    branch: z.enum(["devoto", "nordelta"]),
    customer: z.object({
      name: z.string().min(2).max(90),
      phone: z.string().min(6).max(40),
      email: z.string().email().max(120),
      address: z.string().min(3).max(180).optional(),
    }),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fulfillmentMode: z.enum(["pickup", "delivery"]),
    paymentOption: z.enum(["deposit", "full"]).optional(),
    notes: z.string().max(1000).optional(),
    items: z
      .array(
        z.object({
          flavorId: z.string().min(1),
          sizeId: z.string().min(1),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((value, ctx) => {
    if (
      value.fulfillmentMode === "delivery" &&
      !value.customer.address?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["customer", "address"],
        message: "La direccion es obligatoria para envios",
      });
    }
  });

export const runtime = "nodejs";

function mapFulfillmentMode(value: "pickup" | "delivery"): FulfillmentMode {
  return value === "pickup" ? "PICKUP" : "DELIVERY";
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 180);
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const mode = req.nextUrl.searchParams.get("mode")?.trim();
    const branch = req.nextUrl.searchParams.get("branch")?.trim();
    const branchFilter = branch ? getBranchBySlug(branch) : null;
    const from = req.nextUrl.searchParams.get("from")?.trim();
    const to = req.nextUrl.searchParams.get("to")?.trim();
    const page = Math.max(
      0,
      Math.min(
        100,
        Number.parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0,
      ),
    );

    if (branch && !branchFilter) {
      return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      ...(branchFilter && !q ? { branchCode: branchFilter.code } : {}),
      ...(status && !q
        ? {
            status: status.toUpperCase() as
              "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED",
          }
        : {}),
      ...(mode && !q
        ? {
            fulfillmentMode:
              mode === "pickup"
                ? "PICKUP"
                : mode === "delivery"
                  ? "DELIVERY"
                  : undefined,
          }
        : {}),
      ...(!q && (from || to)
        ? {
            deliveryDate: {
              ...(from ? { gte: getDateRange(from).gte } : {}),
              ...(to ? { lte: getDateRange(to).lte } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { publicReceiptCode: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { customer: { phone: { contains: q, mode: "insensitive" } } },
              { payments: { some: { providerPaymentId: q } } },
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
      skip: page * 200,
    });

    return NextResponse.json({
      total: await prisma.order.count({ where }),
      page,
      searchAll: Boolean(q),
      items: orders.map((order) => ({
        id: order.id,
        branch: getBranchByCode(order.branchCode),
        status: order.status,
        fulfillmentMode: order.fulfillmentMode,
        deliveryDate: getDateOnlyString(order.deliveryDate),
        publicReceiptCode: order.publicReceiptCode,
        subtotalArs: order.subtotalArs,
        amountDueNowArs: order.amountDueNowArs,
        amountPaidArs: order.amountPaidArs,
        amountBalanceArs: order.amountBalanceArs,
        receiptEmailLastError: order.receiptEmailLastError,
        receiptEmailSentAt: order.receiptEmailSentAt,
        receiptEmailSentTo: order.receiptEmailSentTo,
        mercadoPagoExternalReference: order.mercadoPagoExternalReference,
        mercadoPagoPreferenceId: order.mercadoPagoPreferenceId,
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
    return NextResponse.json(
      { error: "No se pudieron listar los pedidos" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = orderCreateSchema.parse(await req.json());
    const orderId = body.requestId
      ? `natta_${crypto.createHash("sha256").update(body.requestId).digest("hex").slice(0, 32)}`
      : crypto.randomUUID();
    const existing = body.requestId
      ? await prisma.order.findUnique({ where: { id: orderId } })
      : null;
    if (existing) {
      return NextResponse.json({
        orderId: existing.id,
        publicReceiptCode: existing.publicReceiptCode,
        resumed: true,
      });
    }
    const branch = getBranchBySlug(body.branch);
    if (!branch) {
      return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
    }
    const branchCode = BranchCode[branch.code];

    const mode = mapFulfillmentMode(body.fulfillmentMode);
    const paymentOption = resolveOrderPaymentOption(mode, body.paymentOption);
    const pairKeys = body.items.map(
      (item) => `${item.flavorId}::${item.sizeId}`,
    );
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
            slug: true,
          },
        },
        size: {
          select: {
            isActive: true,
            slug: true,
          },
        },
      },
    });

    const priceByKey = new Map(
      prices.map((price) => [`${price.flavorId}::${price.sizeId}`, price]),
    );
    if (priceByKey.size !== pairKeys.length) {
      return NextResponse.json(
        { error: "Item de catalogo invalido" },
        { status: 400 },
      );
    }

    for (const item of body.items) {
      const price = priceByKey.get(`${item.flavorId}::${item.sizeId}`);
      if (
        !price ||
        !price.flavor.isActive ||
        !price.size.isActive ||
        !isCatalogPairAvailableAtBranch(
          branch,
          price.flavor.slug,
          price.size.slug,
        )
      ) {
        return NextResponse.json(
          { error: "Producto no disponible" },
          { status: 400 },
        );
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

    const requestedUnits = orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    await validateCapacityForOrder({
      branchCode,
      deliveryDate: body.deliveryDate,
      requestedUnits,
      requestedFlavorUnits: orderItems.map((item) => ({
        flavorId: item.flavorId,
        quantity: item.quantity,
      })),
      requestedFlavorSizeUnits: orderItems.map((item) => ({
        flavorId: item.flavorId,
        sizeId: item.sizeId,
        quantity: item.quantity,
      })),
    });

    const totals = calculateOrderTotals(mode, orderItems, paymentOption);

    const result = await prisma.$transaction(
      async (tx) => {
        // The client keeps this random request identity across network retries.
        // Serialize even before the order row exists, and create its payment in the
        // same transaction so a receipt can never point to half-created data.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;
        const resumed = await tx.order.findUnique({ where: { id: orderId } });
        if (resumed)
          return {
            orderId: resumed.id,
            publicReceiptCode: resumed.publicReceiptCode,
            resumed: true,
          };
        const customer = await tx.customer.upsert({
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
          const exists = await tx.order.findUnique({
            where: { publicReceiptCode },
            select: { id: true },
          });
          if (!exists) break;
          publicReceiptCode = createPublicReceiptCode();
        }

        const order = await tx.order.create({
          data: {
            id: orderId,
            customerId: customer.id,
            branchCode,
            fulfillmentMode: mode,
            deliveryDate: getDateAtNoon(body.deliveryDate),
            deliveryAddress:
              body.fulfillmentMode === "delivery"
                ? body.customer.address?.trim() || null
                : null,
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
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            customerId: customer.id,
            kind: paymentKindByOrderPaymentOption(mode, paymentOption),
            status: "PENDING",
            method: PaymentMethod.MERCADO_PAGO,
            amountArs: order.amountDueNowArs,
            customerName: customer.name,
            customerPhone: customer.phone,
            externalReference,
            provider: "mercadopago",
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            mercadoPagoExternalReference: externalReference,
          },
        });

        return {
          orderId: order.id,
          publicReceiptCode: order.publicReceiptCode,
          paymentIntent: {
            paymentId: payment.id,
            externalReference,
            amountArs: payment.amountArs,
            kind: payment.kind,
          },
        };
      },
      { timeout: 15000, maxWait: 10000 },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === "DATE_TOO_SOON") {
        return NextResponse.json(
          { error: "La fecha no tiene la anticipación suficiente" },
          { status: 400 },
        );
      }
      if (error.message === "DATE_CLOSED") {
        return NextResponse.json(
          { error: "No tomamos pedidos este día" },
          { status: 400 },
        );
      }
      if (error.message === "CAPACITY_EXCEEDED") {
        return NextResponse.json(
          { error: "Esta fecha no tiene cupo suficiente para todo el pedido" },
          { status: 409 },
        );
      }
      if (error.message === "FLAVOR_CAPACITY_EXCEEDED") {
        return NextResponse.json(
          {
            error: "Uno de los sabores no tiene cupo suficiente para esa fecha",
          },
          { status: 409 },
        );
      }
      if (error.message === "FLAVOR_SIZE_CAPACITY_EXCEEDED") {
        return NextResponse.json(
          {
            error:
              "Una combinación de sabor y tamaño no tiene cupo suficiente para esa fecha",
          },
          { status: 409 },
        );
      }
      if (error.message === "CUTOFF_REACHED") {
        return NextResponse.json(
          { error: "Ya pasó el horario de corte para esa fecha" },
          { status: 400 },
        );
      }
    }

    logServerError("api.orders.post", error);
    return NextResponse.json(
      { error: "No se pudo crear el pedido" },
      { status: 500 },
    );
  }
}
