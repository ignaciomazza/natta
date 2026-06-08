import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoWebhookResourceId, getMercadoPagoWebhookTopic, syncMercadoPagoPayment } from "@/lib/payments/sync";
import {
  getMercadoPagoEnvironment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/payments/mercadopago";
import { logServerError } from "@/lib/server/log";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let eventId: string | null = null;

  try {
    const payload = (await req.json()) as {
      id?: string;
      action?: string;
      type?: string;
      topic?: string;
      live_mode?: boolean;
      data?: { id?: string };
      resource?: string;
    };

    const resourceId = getMercadoPagoWebhookResourceId(payload);
    const topic = getMercadoPagoWebhookTopic(payload);
    const requestId = req.headers.get("x-request-id");
    const signature = req.headers.get("x-signature");
    const webhookEnvironment =
      payload.live_mode === true
        ? "production"
        : payload.live_mode === false
          ? "test"
          : getMercadoPagoEnvironment();

    eventId = payload.id ?? (requestId && resourceId ? `${requestId}:${resourceId}` : null);

    const isValidSignature = verifyMercadoPagoWebhookSignature({
      signature,
      requestId,
      dataId: resourceId,
      environment: webhookEnvironment,
    });

    const webhookEvent = await prisma.mercadoPagoWebhookEvent.upsert({
      where: { eventId: eventId ?? `${crypto.randomUUID()}` },
      update: {},
      create: {
        eventId,
        topic,
        action: payload.action,
        resourceId,
        requestId,
        signature,
        payload,
        status: isValidSignature ? "RECEIVED" : "ERROR",
        errorMessage: isValidSignature ? null : "Firma invalida",
      },
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
    }

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
      await syncMercadoPagoPayment(resourceId, webhookEnvironment);
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
