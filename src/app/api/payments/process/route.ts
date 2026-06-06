import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createMercadoPagoPayment,
  getMercadoPagoTicketExpirationDate,
  mapMercadoPagoPaymentStatus,
  MercadoPagoConfigError,
} from "@/lib/payments/mercadopago";
import { applyMercadoPagoPaymentSnapshot } from "@/lib/payments/sync";
import { logServerError } from "@/lib/server/log";

const processSchema = z.object({
  orderId: z.string().min(1),
  selectedPaymentMethod: z.string().min(1).optional(),
  formData: z.record(z.string(), z.unknown()),
  additionalData: z.record(z.string(), z.unknown()).optional(),
});

export const runtime = "nodejs";

function getNestedValue(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function getStringValue(
  source: Record<string, unknown>,
  paths: string[][],
) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getNumberValue(
  source: Record<string, unknown>,
  paths: string[][],
) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function splitNameParts(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName ?? null,
    lastName: rest.length ? rest.join(" ") : null,
  };
}

function buildOrderDescription(receiptCode: string, isPickupDeposit: boolean) {
  return isPickupDeposit
    ? `Seña pedido Natta ${receiptCode}`
    : `Pago pedido Natta ${receiptCode}`;
}

function buildIdempotencyKey(parts: Array<string | number | null | undefined>) {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(parts));
  return hash.digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = processSchema.parse(await req.json());

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        customer: true,
        payments: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Pedido cancelado" }, { status: 409 });
    }

    const pendingPayment = order.payments[0];
    if (!pendingPayment) {
      return NextResponse.json({ error: "No hay cobro pendiente" }, { status: 409 });
    }

    const paymentMethodId = getStringValue(body.formData, [
      ["payment_method_id"],
      ["paymentMethodId"],
    ]);
    const token = getStringValue(body.formData, [["token"]]);
    const installments =
      getNumberValue(body.formData, [["installments"]]) ?? 1;
    const issuerId = getStringValue(body.formData, [["issuer_id"], ["issuer"]]);
    const email =
      getStringValue(body.formData, [["payer", "email"], ["email"]]) ??
      order.customer.email ??
      undefined;
    const identificationType = getStringValue(body.formData, [
      ["payer", "identification", "type"],
      ["identificationType"],
    ]);
    const identificationNumber = getStringValue(body.formData, [
      ["payer", "identification", "number"],
      ["identificationNumber"],
      ["number"],
    ]);

    const selectedMethod = body.selectedPaymentMethod ?? paymentMethodId ?? "card";
    const isWalletRedirectMethod = [
      "wallet_purchase",
      "onboarding_credits",
      "account_money",
      "mercado_credito",
      "mercadoPago",
    ].includes(selectedMethod);

    if (isWalletRedirectMethod) {
      return NextResponse.json({ redirected: true });
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "No se pudo identificar el medio de pago" },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Mercado Pago requiere un email para procesar el cobro" },
        { status: 400 },
      );
    }

    const isTicketPayment =
      selectedMethod === "ticket" ||
      paymentMethodId === "rapipago" ||
      paymentMethodId === "pagofacil";

    if (!isTicketPayment && !token) {
      return NextResponse.json(
        { error: "No se pudo tokenizar la tarjeta" },
        { status: 400 },
      );
    }

    const { firstName, lastName } = splitNameParts(order.customer.name);
    const remotePayment = await createMercadoPagoPayment({
      amountArs: pendingPayment.amountArs,
      description: buildOrderDescription(
        order.publicReceiptCode,
        pendingPayment.kind === "DEPOSIT",
      ),
      paymentMethodId,
      externalReference:
        pendingPayment.externalReference ?? order.mercadoPagoExternalReference ?? `natta_${order.id}`,
      payerEmail: email,
      payerFirstName: firstName,
      payerLastName: lastName,
      identificationType,
      identificationNumber,
      token,
      issuerId,
      installments: isTicketPayment ? undefined : installments,
      dateOfExpiration: isTicketPayment
        ? getMercadoPagoTicketExpirationDate().toISOString()
        : undefined,
      idempotencyKey: buildIdempotencyKey([
        pendingPayment.id,
        paymentMethodId,
        token,
        installments,
        identificationNumber,
      ]),
    });

    const syncedPayment = await applyMercadoPagoPaymentSnapshot(remotePayment);
    const mappedStatus = mapMercadoPagoPaymentStatus(remotePayment.status);

    return NextResponse.json({
      payment: {
        id: syncedPayment?.id ?? pendingPayment.id,
        providerPaymentId: `${remotePayment.id}`,
        method: paymentMethodId,
        status: syncedPayment?.status ?? mappedStatus,
        statusDetail: syncedPayment?.statusDetail ?? remotePayment.status_detail ?? null,
        amountArs:
          typeof remotePayment.transaction_amount === "number"
            ? Math.round(remotePayment.transaction_amount)
            : pendingPayment.amountArs,
        receiptUrl:
          remotePayment.transaction_details?.external_resource_url ?? null,
        reference:
          remotePayment.transaction_details?.payment_method_reference_id ?? null,
        financialInstitution:
          remotePayment.transaction_details?.financial_institution ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (error instanceof MercadoPagoConfigError) {
      return NextResponse.json(
        { error: "Mercado Pago no esta configurado" },
        { status: 503 },
      );
    }

    logServerError("api.payments.process.post", error);
    return NextResponse.json({ error: "No se pudo procesar el pago" }, { status: 500 });
  }
}
