import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMercadoPagoPayment } from "@/lib/payments/sync";
import { getNotificationResourceId, mercadoPagoNotificationSchema } from "@/lib/payments/notifications";
import {
  getMercadoPagoEnvironment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/payments/mercadopago";
import { logServerError } from "@/lib/server/log";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let eventId: string | null = null;

  try {
    const parsed = mercadoPagoNotificationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Notificación inválida" }, { status: 400 });
    }
    const payload = parsed.data;
    // Legacy IPN uses a different authentication contract. It must never be
    // treated as a signed webhook or mutate payment state.
    if (!payload.type && payload.topic && payload.resource) {
      return NextResponse.json({ ok: true, ignored: true, reason: "legacy_ipn" });
    }
    const resourceId = getNotificationResourceId(payload, req.nextUrl.searchParams.get("data.id"));
    const topic = payload.type ?? null;
    const requestId = req.headers.get("x-request-id");
    const signature = req.headers.get("x-signature");
    const webhookEnvironment =
      payload.live_mode === true
        ? "production"
        : payload.live_mode === false
          ? "test"
          : getMercadoPagoEnvironment();

    if (webhookEnvironment !== getMercadoPagoEnvironment()) {
      return NextResponse.json({ ok: true, ignored: true, reason: "different_environment" });
    }
    if (topic === "payment" && (!resourceId || !/^\d{1,32}$/.test(resourceId))) {
      return NextResponse.json({ error: "Identificador de pago inválido" }, { status: 400 });
    }

    eventId = payload.id ?? (requestId && resourceId ? `${requestId}:${resourceId}` : null);

    const isValidSignature = verifyMercadoPagoWebhookSignature({
      signature,
      requestId,
      dataId: resourceId,
      environment: webhookEnvironment,
    });

    if (!isValidSignature) {
      console.warn("[api.payments.webhook.signature] Rejected notification", { eventId, topic, resourceId });
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
    }

    const webhookEvent = await prisma.mercadoPagoWebhookEvent.upsert({
      where: { eventId: eventId ?? `${crypto.randomUUID()}` },
      update: {},
      create: {
        eventId,
        topic,
        action: payload.action,
        resourceId,
        requestId,
        payload,
        status: "RECEIVED",
      },
    });

    if (!resourceId || !topic) {
      await prisma.mercadoPagoWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "IGNORED",
          errorMessage: "Evento sin recurso o topic",
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (topic === "payment") {
      const payment = await syncMercadoPagoPayment(resourceId, webhookEnvironment);
      if (!payment) {
        // Do not acknowledge an unmatched payment as processed. Retrying can
        // recover a notification delivered before a local transaction commits.
        throw new Error("PAYMENT_NOT_LINKED");
      }
      await prisma.mercadoPagoWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.mercadoPagoWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "IGNORED",
        errorMessage: `Topic no soportado: ${topic}`,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "NOTIFICATION_RESOURCE_MISMATCH")) {
      return NextResponse.json({ error: "Notificación inválida" }, { status: 400 });
    }
    if (eventId) {
      await prisma.mercadoPagoWebhookEvent
        .update({
          where: { eventId },
          data: {
            status: "ERROR",
            errorMessage: error instanceof Error ? error.message : "Error",
            processedAt: new Date(),
          },
        })
        .catch(() => null);
    }

    logServerError("api.payments.webhook.post", error);
    return NextResponse.json({ error: "No se pudo procesar webhook" }, { status: 500 });
  }
}
