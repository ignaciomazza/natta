import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWebhookEvent } from "@/lib/payments/webhook-inbox";
import {
  getNotificationResourceId,
  mercadoPagoNotificationSchema,
} from "@/lib/payments/notifications";
import {
  getMercadoPagoEnvironment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/payments/mercadopago";
import { logServerError } from "@/lib/server/log";

export function createWebhookHandler(
  schedule: (work: () => Promise<void>) => void,
) {
  return async function POST(req: NextRequest) {
    let eventId: string | null = null;

    try {
      const parsed = mercadoPagoNotificationSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Notificación inválida" },
          { status: 400 },
        );
      }
      const payload = parsed.data;
      // Legacy IPN uses a different authentication contract. It must never be
      // treated as a signed webhook or mutate payment state.
      if (!payload.type && payload.topic && payload.resource) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "legacy_ipn",
        });
      }
      const resourceId = getNotificationResourceId(
        payload,
        req.nextUrl.searchParams.get("data.id"),
      );
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
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "different_environment",
        });
      }
      if (
        topic === "payment" &&
        (!resourceId || !/^\d{1,32}$/.test(resourceId))
      ) {
        return NextResponse.json(
          { error: "Identificador de pago inválido" },
          { status: 400 },
        );
      }

      eventId =
        payload.id ??
        (requestId && resourceId ? `${requestId}:${resourceId}` : null);

      const isValidSignature = verifyMercadoPagoWebhookSignature({
        signature,
        requestId,
        dataId: resourceId,
        environment: webhookEnvironment,
      });

      if (!isValidSignature) {
        console.warn("[api.payments.webhook.signature] Rejected notification", {
          eventId,
          topic,
          resourceId,
        });
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
          signature,
          payload: {
            ...payload,
            live_mode: webhookEnvironment === "production",
          },
          status: "RECEIVED",
        },
      });

      if (
        webhookEvent.resourceId !== resourceId ||
        webhookEvent.topic !== topic
      ) {
        return NextResponse.json(
          { error: "Evento asociado a otro recurso" },
          { status: 400 },
        );
      }
      // Keep the latest verified signature on a retry (for example after a
      // secret rotation), without resetting a running lease or a finished event.
      if (
        webhookEvent.signature !== signature ||
        webhookEvent.requestId !== requestId
      ) {
        await prisma.mercadoPagoWebhookEvent.updateMany({
          where: { id: webhookEvent.id, status: { in: ["RECEIVED", "ERROR"] } },
          data: {
            signature,
            requestId,
            payload: {
              ...payload,
              live_mode: webhookEnvironment === "production",
            },
          },
        });
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
        // Acknowledge only after durable storage. The scheduled sweep also reads
        // this inbox, so a lost after() callback cannot lose the payment notice.
        schedule(async () => {
          await processWebhookEvent(webhookEvent.id);
        });
        return NextResponse.json({ ok: true, received: true });
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
      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          error.message === "NOTIFICATION_RESOURCE_MISMATCH")
      ) {
        return NextResponse.json(
          { error: "Notificación inválida" },
          { status: 400 },
        );
      }
      logServerError("api.payments.webhook.post", error);
      return NextResponse.json(
        { error: "No se pudo procesar webhook" },
        { status: 500 },
      );
    }
  };
}
