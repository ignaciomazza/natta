import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server/log";

const lookupSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("code"),
    code: z.string().min(4).max(80),
  }),
  z.object({
    mode: z.literal("recovery"),
    name: z.string().min(3).max(90),
    phone: z.string().min(6).max(40),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export const runtime = "nodejs";

const orderSelect = {
  id: true,
  status: true,
  fulfillmentMode: true,
  deliveryDate: true,
  publicReceiptCode: true,
  subtotalArs: true,
  amountPaidArs: true,
  amountBalanceArs: true,
  createdAt: true,
  customer: {
    select: {
      name: true,
      phone: true,
    },
  },
  items: {
    select: {
      quantity: true,
      unitPriceArs: true,
      subtotalArs: true,
      flavor: {
        select: {
          name: true,
        },
      },
      size: {
        select: {
          name: true,
        },
      },
    },
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }],
    select: {
      id: true,
      kind: true,
      status: true,
      method: true,
      amountArs: true,
      paidAt: true,
      referenceNote: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

type PublicOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function nameMatches(storedName: string, inputName: string) {
  const stored = normalizeName(storedName);
  const input = normalizeName(inputName);
  const tokens = input.split(" ").filter((token) => token.length >= 3);

  if (input.length < 4 || tokens.length === 0) {
    return false;
  }

  if (stored === input || stored.includes(input) || input.includes(stored)) {
    return true;
  }

  const matchedTokens = tokens.filter((token) => stored.includes(token));

  return tokens.length === 1
    ? matchedTokens.length === 1 && tokens[0].length >= 4
    : matchedTokens.length >= Math.min(2, tokens.length);
}

function phoneMatches(storedPhone: string, inputPhone: string) {
  const stored = normalizePhone(storedPhone);
  const input = normalizePhone(inputPhone);

  if (stored.length < 8 || input.length < 8) {
    return false;
  }

  return (
    stored === input ||
    stored.endsWith(input) ||
    input.endsWith(stored) ||
    stored.slice(-8) === input.slice(-8)
  );
}

function getDateWindow(date: string) {
  return {
    gte: new Date(`${date}T00:00:00`),
    lte: new Date(`${date}T23:59:59.999`),
  };
}

function getStatusCopy(order: PublicOrder) {
  if (order.status === "CANCELLED") {
    return {
      label: "Cancelado",
      tone: "cancelled",
      detail:
        "El pedido figura cancelado. Si necesitás retomarlo, armá uno nuevo desde la web.",
    };
  }

  if (order.status === "DELIVERED") {
    return {
      label: "Entregado",
      tone: "delivered",
      detail: "El pedido ya fue entregado y el comprobante queda disponible.",
    };
  }

  if (order.amountPaidArs > 0 || order.status === "CONFIRMED") {
    return {
      label: "Confirmado",
      tone: "confirmed",
      detail:
        "El pedido ya fue tomado. Natta te escribe si falta coordinar algún detalle.",
    };
  }

  return {
    label: "En revisión",
    tone: "pending",
    detail:
      "Todavía estamos esperando la acreditación o la confirmación final del pedido.",
  };
}

function getPaymentMethodLabel(method: string) {
  if (method === "MERCADO_PAGO") return "Mercado Pago";
  if (method === "TRANSFER") return "Transferencia";
  if (method === "CASH") return "Efectivo";
  return "Registro manual";
}

function getPaymentStatusLabel(status: string) {
  if (status === "APPROVED") return "Acreditado";
  if (status === "REJECTED") return "Rechazado";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "REFUNDED") return "Devuelto";
  return "En revisión";
}

function serializeOrder(order: PublicOrder) {
  const status = getStatusCopy(order);

  return {
    code: order.publicReceiptCode,
    status: order.status,
    statusLabel: status.label,
    statusTone: status.tone,
    statusDetail: status.detail,
    receiptHref: `/comprobante/${order.publicReceiptCode}`,
    deliveryDate: order.deliveryDate,
    fulfillmentMode:
      order.fulfillmentMode === "PICKUP" ? "Retiro" : "Envío",
    subtotalArs: order.subtotalArs,
    amountPaidArs: order.amountPaidArs,
    amountBalanceArs: order.amountBalanceArs,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      flavor: item.flavor.name,
      size: item.size.name,
      quantity: item.quantity,
      unitPriceArs: item.unitPriceArs,
      subtotalArs: item.subtotalArs,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      status: payment.status,
      statusLabel: getPaymentStatusLabel(payment.status),
      method: payment.method,
      methodLabel: getPaymentMethodLabel(payment.method),
      amountArs: payment.amountArs,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      referenceNote: payment.referenceNote,
    })),
  };
}

async function findOrderByCode(code: string) {
  const normalizedCode = normalizeCode(code);

  return prisma.order.findFirst({
    where: {
      publicReceiptCode: {
        equals: normalizedCode,
        mode: "insensitive",
      },
    },
    select: orderSelect,
  });
}

async function findOrderByRecovery(input: {
  name: string;
  phone: string;
  deliveryDate: string;
}) {
  const phoneDigits = normalizePhone(input.phone);
  const normalizedName = normalizeName(input.name);

  if (phoneDigits.length < 8 || normalizedName.length < 4) {
    return {
      error: "Usá nombre, fecha y un teléfono de al menos 8 dígitos.",
      status: 400,
    } as const;
  }

  const candidates = await prisma.order.findMany({
    where: {
      deliveryDate: getDateWindow(input.deliveryDate),
    },
    orderBy: [{ createdAt: "desc" }],
    select: orderSelect,
    take: 100,
  });

  const matches = candidates.filter(
    (order) =>
      nameMatches(order.customer.name, input.name) &&
      phoneMatches(order.customer.phone, input.phone),
  );

  if (matches.length === 0) {
    return {
      error: "No encontramos un pedido con esa combinación de datos.",
      status: 404,
    } as const;
  }

  if (matches.length > 1) {
    return {
      error:
        "Encontramos más de un pedido posible. Escribinos para confirmarlo sin exponer datos.",
      status: 409,
    } as const;
  }

  return { order: matches[0] } as const;
}

export async function POST(req: NextRequest) {
  try {
    const body = lookupSchema.parse(await req.json());

    if (body.mode === "code") {
      const order = await findOrderByCode(body.code);

      if (!order) {
        return NextResponse.json(
          { error: "No encontramos ese código o comprobante." },
          { status: 404 },
        );
      }

      return NextResponse.json({ order: serializeOrder(order) });
    }

    const result = await findOrderByRecovery(body);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ order: serializeOrder(result.order) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.public.order-status.post", error);
    return NextResponse.json(
      { error: "No se pudo consultar el estado del pedido" },
      { status: 500 },
    );
  }
}
