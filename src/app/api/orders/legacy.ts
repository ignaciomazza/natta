import { getCommerceBridge, pushCommerceOrder, CommerceBridgeError } from "@/lib/integrations/commerce-bridge";
import { getCommerceCatalog } from "@/lib/integrations/commerce-catalog";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { BranchCode, FulfillmentMode, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";
import {
  calculateOrderTotals,
  createPaymentExternalReference,
  createPublicReceiptCode,
  paymentKindByOrderPaymentOption,
  resolveOrderPaymentOption,
} from "@/lib/orders";
import {
  getDateAtNoon,
  validateCapacityForOrder,
} from "@/lib/capacity";
import { applyPriceMultiplier } from "@/lib/price-adjustments";
import { isCatalogPairAvailableAtBranch } from "@/lib/catalog-db";
import { getBranchBySlug } from "@/lib/branches";

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
      await pushCommerceOrder(existing.id);
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
    const bridge = await getCommerceBridge();
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
        (!bridge?.enabled && (!price.flavor.isActive || !price.size.isActive)) ||
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

    const commerceCatalog = bridge?.enabled ? await getCommerceCatalog(branch) : null;
    const orderItems = body.items.map((item) => {
      const price = priceByKey.get(`${item.flavorId}::${item.sizeId}`)!;
      const livePrice = commerceCatalog?.flavors.find((flavor) => flavor.id === item.flavorId)?.prices.find((candidate) => candidate.sizeId === item.sizeId);
      if (commerceCatalog && !livePrice) throw new CommerceBridgeError("Producto no disponible.", 409);
      return {
        flavorId: item.flavorId,
        sizeId: item.sizeId,
        quantity: item.quantity,
        unitPriceArs: livePrice?.amountArs ?? applyPriceMultiplier(price.amountArs),
      };
    });

    const requestedUnits = orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    if (!bridge?.enabled) await validateCapacityForOrder({
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
    await pushCommerceOrder(result.orderId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommerceBridgeError) return NextResponse.json({ error: error.message }, { status: error.status });
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
