import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeCommerce,
  bridgeSettingsSchema,
  exportCommerceOrder,
  CommerceBridgeError,
} from "@/lib/integrations/commerce-bridge";
import { commerceCommandSchema } from "@/lib/integrations/commerce-contract";
import { applyCobotsOrderCommand } from "@/lib/integrations/cobots-operations";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PROBE") }).strict(),
  z.object({ action: z.literal("DESCRIBE") }).strict(),
  z
    .object({
      action: z.literal("CONFIGURE"),
      settings: bridgeSettingsSchema,
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("ORDERS"),
      cursor: z.string().nullable(),
      limit: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({ action: z.literal("COMMAND"), command: commerceCommandSchema })
    .strict(),
]);
export async function POST(request: NextRequest) {
  if (!authorizeCommerce(request.headers.get("authorization")))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 100000)
      return NextResponse.json(
        { error: "Solicitud demasiado grande." },
        { status: 413 },
      );
    const input = schema.parse(JSON.parse(text));
    if (input.action === "PROBE")
      return NextResponse.json({
        protocol: "cobots-commerce-v1",
        capabilities: ["orders", "commands", "outbox"],
      });
    if (input.action === "DESCRIBE") {
      const [
        flavors,
        sizes,
        orderCount,
        customerCount,
        pendingReceipts,
        config,
      ] = await Promise.all([
        prisma.flavor.findMany({
          select: { id: true, slug: true, name: true },
        }),
        prisma.size.findMany({ select: { id: true, slug: true, name: true } }),
        prisma.order.count(),
        prisma.customer.count(),
        prisma.orderReceiptDelivery.count({
          where: { status: { in: ["PENDING", "UNCERTAIN", "REVIEW"] } },
        }),
        prisma.commerceBridgeConfig.findUnique({
          where: { id: "default" },
          select: { enabled: true },
        }),
      ]);
      return NextResponse.json(
        {
          flavors,
          sizes,
          orderCount,
          customerCount,
          pendingReceipts,
          enabled: config?.enabled ?? false,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (input.action === "CONFIGURE") {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('commerce-bridge:handover', 0))`;
        if (
          input.enabled &&
          (await tx.orderReceiptDelivery.count({
            where: { status: { in: ["PENDING", "UNCERTAIN", "REVIEW"] } },
          }))
        ) {
          throw new CommerceBridgeError(
            "Hay comprobantes anteriores pendientes. Revisalos antes de activar la conexión.",
            409,
          );
        }
        await tx.commerceBridgeConfig.upsert({
          where: { id: "default" },
          create: {
            id: "default",
            settings: input.settings,
            enabled: input.enabled,
          },
          update: { settings: input.settings, enabled: input.enabled },
        });
      });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "ORDERS") {
      const rows = await prisma.order.findMany({
        where: input.cursor ? { id: { gt: input.cursor } } : {},
        orderBy: { id: "asc" },
        take: input.limit + 1,
        select: { id: true },
      });
      const visible = rows.slice(0, input.limit),
        orders = [];
      // Keep each order snapshot consistent while bounding connections and
      // round trips for recovery pages across regions.
      for (let offset = 0; offset < visible.length; offset += 4) {
        const batch = await Promise.all(
          visible
            .slice(offset, offset + 4)
            .map((row) => exportCommerceOrder(row.id)),
        );
        orders.push(...batch.map((entry) => entry.snapshot));
      }
      return NextResponse.json(
        {
          orders,
          nextCursor: rows.length > input.limit ? visible.at(-1)!.id : null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const operation = input.command.operation;
    const translated = {
      ...input.command,
      operation:
        operation.action === "COLLECT_BALANCE"
          ? {
              action: operation.action,
              amountArs: operation.amount,
              method: operation.method,
              referenceNote: operation.referenceNote,
            }
          : operation,
    };
    const result = await applyCobotsOrderCommand(translated);
    const order = await prisma.order.findUnique({
      where: { id: input.command.orderId },
      select: { id: true },
    });
    return NextResponse.json(
      {
        id: result.id,
        outcome: result.outcome,
        message: result.message,
        order: order ? (await exportCommerceOrder(order.id)).snapshot : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    if (error instanceof CommerceBridgeError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No se pudo completar la conexión." },
      { status: 503 },
    );
  }
}
