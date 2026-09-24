import { isCobotsDirect } from "@/lib/cobots-api";
import { drainCommerceOutbox } from "@/lib/integrations/commerce-bridge";
import { NextRequest, NextResponse } from "next/server";
import { canReconcilePayments } from "@/lib/payments/reconcile-auth";
import { reconcilePaymentPage } from "@/lib/payments/reconcile";
import { retryWebhookPage } from "@/lib/payments/webhook-inbox";
import { getMercadoPagoEnvironment } from "@/lib/payments/mercadopago";
import { logServerError } from "@/lib/server/log";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({
  mode: z.enum(["payments", "notifications", "commerce"]).default("payments"),
  offset: z.number().int().min(0).max(10000).default(0),
  end: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { mode, offset, end } = schema.parse(await req.json());
    if (!(await canReconcilePayments(authorization, mode)))
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (await isCobotsDirect()) return NextResponse.json(mode === "commerce"
      ? { processed: 0, errors: 0, hasMore: false }
      : mode === "notifications"
        ? { checked: 0, recovered: 0, errors: [], hasMore: false }
        : { checked: 0, recovered: 0, attention: [], errors: [], receiptAttention: [], nextOffset: null });
    if (mode !== "commerce" && getMercadoPagoEnvironment() !== "production")
      return NextResponse.json(
        { error: "La revisión automática requiere el entorno productivo" },
        { status: 503 },
      );
    if (Math.abs(Date.now() - Date.parse(end)) > 3600000)
      return NextResponse.json({ error: "Período inválido" }, { status: 400 });
    if (mode === "commerce") {
      const result = await drainCommerceOutbox(5);
      return NextResponse.json(result);
    }
    const result =
      mode === "notifications"
        ? await retryWebhookPage(end)
        : await reconcilePaymentPage(offset, end);
    console.info("[payments.reconcile]", result);
    // Preserve pagination on an individual failure. The worker reports errors
    // after visiting every page, so one bad payment cannot hide other orders.
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    logServerError("payments.reconcile", error);
    return NextResponse.json(
      { error: "No se pudo completar la revisión de pagos" },
      { status: 503 },
    );
  }
}
