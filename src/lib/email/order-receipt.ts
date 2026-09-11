import { getCommerceBridge, pushCommerceOrder, cobotsRequest } from "@/lib/integrations/commerce-bridge";
import type { Order, OrderStatus, Payment, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { getPickupHoursLabelForDate } from "@/lib/pickup-hours-db";
import { dispatchOrderReceipt } from "./receipt-delivery";
import { formatDateOnly } from "@/lib/date-only";
import { getBranchByCode } from "@/lib/branches";

export type ReceiptOrder = Order & {
  customer: {
    address: string | null;
    email: string | null;
    name: string;
    phone: string;
  };
  items: Array<{
    flavor: {
      name: string;
      description: string;
    };
    quantity: number;
    size: {
      name: string;
      description: string;
    };
    subtotalArs: number;
    unitPriceArs: number;
  }>;
  payments: Payment[];
};

export type OrderReceiptEmailSkippedReason =
  | "ALREADY_SENT"
  | "AMOUNT_NOT_COVERED"
  | "INVALID_EMAIL"
  | "ORDER_CANCELLED"
  | "ORDER_NOT_FOUND"
  | "PAYMENT_NOT_APPROVED"
  | "RECENT_ATTEMPT"
  | "SEND_FAILED"
  | "REVIEW_REQUIRED"
  | "ORDER_CHANGED";

export type OrderReceiptEmailResult = {
  error?: string;
  resendId?: string | null;
  sent: boolean;
  sentTo?: string;
  skippedReason?: OrderReceiptEmailSkippedReason;
};

export type SendOrderReceiptEmailOptions = {
  force?: boolean;
  throwOnError?: boolean;
  requestId?: string;
  actorUserId?: string;
  expectedRecipient?: string;
  expectedUpdatedAt?: string;
  credentials?: { accessToken: string; from: string; replyTo?: string; connectionId: string };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date) {
  return formatDateOnly(value, {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export function getReceiptEmailFrom() {
  const rawFrom = process.env.NATTA_RECEIPT_EMAIL_FROM?.trim();
  if (!rawFrom) {
    throw new Error("Falta NATTA_RECEIPT_EMAIL_FROM");
  }
  return rawFrom.includes("<") ? rawFrom : `Natta <${rawFrom}>`;
}

export function getReceiptEmailReplyTo() {
  return process.env.NATTA_RECEIPT_EMAIL_REPLY_TO?.trim() || undefined;
}



function getReceiptState(order: {
  amountPaidArs: number;
  status: OrderStatus;
}) {
  if (order.status === "CANCELLED") return "Cancelado";
  if (order.status === "DELIVERED") return "Entregado";
  if (order.amountPaidArs > 0) return "Pago recibido";
  if (order.status === "CONFIRMED") return "Pedido tomado";
  return "En revisión";
}

function getPaymentMethodLabel(method: PaymentMethod) {
  if (method === "MERCADO_PAGO") return "Mercado Pago";
  if (method === "TRANSFER") return "Transferencia";
  if (method === "CASH") return "Efectivo";
  return "Registro manual";
}

function getPaymentStatusLabel(status: PaymentStatus) {
  if (status === "APPROVED") return "Acreditado";
  if (status === "REJECTED") return "Rechazado";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "REFUNDED") return "Devuelto";
  return "En revisión";
}

function getItemDetail(item: ReceiptOrder["items"][number]) {
  const detail = item.size.description.trim();
  if (detail) {
    return `${item.flavor.description} · ${detail}`;
  }
  return item.flavor.description;
}

export function getOrderReceiptText(order: ReceiptOrder, pickupHoursLabel: string | null) {
  const branch = getBranchByCode(order.branchCode);
  const lines = [
    "Comprobante Natta",
    "",
    `Código: ${order.publicReceiptCode}`,
    `Estado: ${getReceiptState(order)}`,
    `Fecha de entrega: ${formatDate(order.deliveryDate)}`,
    `Sucursal: ${branch.name}`,
    `Modalidad: ${order.fulfillmentMode === "PICKUP" ? "Retiro" : "Envío"}`,
  ];

  if (order.fulfillmentMode === "PICKUP") {
    lines.push(`Dirección de retiro: ${branch.fullAddress}`);
    lines.push(`Horario: ${pickupHoursLabel ?? ""}`);
  }

  lines.push("", "Detalle:");
  for (const item of order.items) {
    lines.push(
      `- ${item.quantity} x ${item.flavor.name} ${item.size.name}: ${formatMoney(
        item.subtotalArs,
      )}`,
    );
  }

  lines.push(
    "",
    `Total: ${formatMoney(order.subtotalArs)}`,
    `Pagado: ${formatMoney(order.amountPaidArs)}`,
    `Saldo pendiente: ${formatMoney(order.amountBalanceArs)}`,
    "",
    `Ver comprobante: ${absoluteUrl(`/comprobante/${order.publicReceiptCode}`)}`,
  );

  return lines.join("\n");
}

export function buildOrderReceiptHtml(order: ReceiptOrder, pickupHoursLabel: string | null) {
  const branch = getBranchByCode(order.branchCode);
  const logoUrl = absoluteUrl(siteConfig.logo);
  const receiptUrl = absoluteUrl(`/comprobante/${order.publicReceiptCode}`);
  const state = getReceiptState(order);
  const isPickup = order.fulfillmentMode === "PICKUP";
  const approvedPayment = order.payments.find((payment) => payment.status === "APPROVED");
  const paymentRows = order.payments
    .filter((payment) => payment.status === "APPROVED")
    .map((payment) => {
      const dateLabel = payment.paidAt
        ? `Registrado el ${formatDateTime(payment.paidAt)}`
        : `Creado el ${formatDateTime(payment.createdAt)}`;
      const operation = payment.providerPaymentId
        ? `<p style="margin:4px 0 0 0;font-size:13px;line-height:20px;color:#6f6560;">Operación ${escapeHtml(payment.providerPaymentId)}</p>`
        : "";
      return `<div style="background:#faf9f8;border:1px solid #ede9e6;border-radius:18px;padding:16px;margin-top:20px;">
        <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#64746a;">Cobro registrado</div>
        <p style="margin:10px 0 0 0;font-size:15px;line-height:23px;font-weight:700;color:#262321;">${escapeHtml(getPaymentMethodLabel(payment.method))} · ${escapeHtml(getPaymentStatusLabel(payment.status))}</p>
        <p style="margin:4px 0 0 0;font-size:13px;line-height:20px;color:#6f6560;">${escapeHtml(dateLabel)}</p>
        ${operation}
      </div>`;
    })
    .join("");
  const itemRows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #ede9e6;">
          <div style="font-size:15px;line-height:22px;font-weight:700;color:#262321;">${item.quantity} x ${escapeHtml(item.flavor.name)} ${escapeHtml(item.size.name)}</div>
          <div style="margin-top:3px;font-size:13px;line-height:20px;color:#8e8179;">${escapeHtml(getItemDetail(item))}</div>
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid #ede9e6;font-size:14px;line-height:22px;font-weight:700;color:#262321;white-space:nowrap;">${formatMoney(item.subtotalArs)}</td>
      </tr>`,
    )
    .join("");
  const row = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:8px 0;color:#6f6560;font-size:14px;line-height:20px;">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 0;color:#262321;font-size:14px;line-height:20px;font-weight:${strong ? "700" : "600"};">${escapeHtml(value)}</td>
    </tr>`;
  const button = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="button-table" style="width:100%;max-width:220px;border-collapse:separate;">
    <tr>
      <td align="center" bgcolor="#262321" style="border-radius:999px;background:#262321;mso-padding-alt:13px 16px;">
        <a href="${receiptUrl}" style="display:block;box-sizing:border-box;width:100%;padding:13px 16px;border-radius:999px;color:#ffffff;text-decoration:none;font-size:13px;line-height:18px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;white-space:normal;word-break:normal;">Ver comprobante</a>
      </td>
    </tr>
  </table>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Comprobante Natta</title>
  <style>
    body{margin:0!important;padding:0!important}
    .outer{width:100%!important}
    .container{width:600px;max-width:600px}
    .card-shell{border-collapse:separate!important;border-spacing:0!important;border-radius:28px!important;overflow:hidden!important}
    .content-cell{padding:34px}
    .fluid-img{display:block;border:0;outline:none;text-decoration:none;height:auto}
    .left-col{width:53%;padding-right:22px}
    .right-col{width:47%}
    @media only screen and (max-width:620px){
      .shell{padding:20px 12px!important}
      .container{width:100%!important;max-width:100%!important}
      .card-shell{border-radius:22px!important}
      .content-cell{padding:24px 16px!important}
      .stack{display:block!important;width:100%!important;box-sizing:border-box!important}
      .stack-pad{padding-top:18px!important;text-align:left!important}
      .left-col{display:block!important;width:100%!important;padding-right:0!important}
      .right-col{display:block!important;width:100%!important;padding-top:20px!important}
      .h1{font-size:29px!important;line-height:34px!important}
      .code{font-size:25px!important;line-height:30px!important}
      .logo{width:132px!important;height:auto!important}
      .button-table{width:100%!important;max-width:100%!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f3f1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#403a37;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">Tu pago ya figura acreditado. Guardá este comprobante de Natta.</div>
  <table class="outer" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f3f1;border-collapse:collapse;">
    <tr>
      <td class="shell" align="center" style="padding:34px 18px;">
        <table class="container" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:0 0 18px 0;">
              <img class="fluid-img logo" src="${logoUrl}" width="156" alt="Natta" style="display:block;width:156px;max-width:156px;height:auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table class="card-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ffffff;border:1px solid #d8d1cb;border-radius:28px;border-collapse:separate;border-spacing:0;overflow:hidden;box-shadow:0 18px 50px rgba(39,28,24,.08);">
                <tr>
                  <td class="content-cell" style="padding:34px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td class="stack" valign="top" style="width:68%;">
                          <h1 class="h1" style="margin:0;font-family:Georgia,Times New Roman,serif;font-size:38px;line-height:43px;font-weight:400;color:#262321;">Ya podés guardar el comprobante</h1>
                          <p style="margin:14px 0 0 0;font-size:15px;line-height:25px;color:#6f6560;">El pago ya figura acreditado y acá tenés el detalle completo para tenerlo a mano.</p>
                        </td>
                        <td class="stack stack-pad" valign="top" align="right" style="width:32%;">
                          <span style="display:inline-block;border:1px solid #bbf7d0;background:#ecfdf3;color:#047857;border-radius:999px;padding:8px 12px;font-size:11px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;white-space:nowrap;">${escapeHtml(state)}</span>
                        </td>
                      </tr>
                    </table>
                    <div style="height:28px;line-height:28px;font-size:28px;">&nbsp;</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:22px;border-collapse:separate;border-spacing:0;overflow:hidden;">
                      <tr>
                        <td style="padding:22px;">
                          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#64746a;">Código del comprobante</div>
                          <div class="code" style="margin-top:8px;font-size:31px;line-height:36px;font-weight:800;color:#262321;letter-spacing:-.02em;word-break:break-word;">${escapeHtml(order.publicReceiptCode)}</div>
                          <p style="margin:13px 0 0 0;font-size:14px;line-height:23px;color:#403a37;">${isPickup ? "Tu pedido fue confirmado. Retiralo en la sucursal indicada, en la fecha seleccionada." : "Tu pedido fue confirmado. Lo llevamos a la dirección indicada, en la fecha acordada."}</p>
                        </td>
                      </tr>
                    </table>
                    <div style="height:26px;line-height:26px;font-size:26px;">&nbsp;</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td class="left-col" valign="top" style="width:53%;padding-right:22px;">
                          <div style="border-top:1px solid #d8d1cb;padding-top:20px;">
                            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8e8179;">Datos del pedido</div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;border-collapse:collapse;">
                              ${row("Fecha de entrega", formatDate(order.deliveryDate), true)}
                              ${row("Sucursal", branch.name, true)}
                              ${row("Modalidad", isPickup ? "Retiro" : "Envío", true)}
                              ${isPickup ? row("Dirección de retiro", branch.fullAddress, true) : ""}
                              ${isPickup ? row("Horario", pickupHoursLabel ?? "", true) : ""}
                            </table>
                          </div>
                          <div style="border-top:1px solid #d8d1cb;margin-top:22px;padding-top:20px;">
                            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8e8179;">Detalle</div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;border-collapse:collapse;">
                              ${itemRows}
                            </table>
                          </div>
                        </td>
                        <td class="right-col" valign="top" style="width:47%;">
                          <div style="border-top:1px solid #d8d1cb;padding-top:20px;">
                            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8e8179;">Resumen de pago</div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;border-collapse:collapse;">
                              ${row("Total del pedido", formatMoney(order.subtotalArs), true)}
                              ${row("Pagado", formatMoney(order.amountPaidArs), true)}
                              ${row("Saldo pendiente", formatMoney(order.amountBalanceArs), true)}
                            </table>
                          </div>
                          ${
                            paymentRows ||
                            `<div style="background:#faf9f8;border:1px solid #ede9e6;border-radius:18px;padding:16px;margin-top:20px;">
                              <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#64746a;">Cobro registrado</div>
                              <p style="margin:10px 0 0 0;font-size:15px;line-height:23px;font-weight:700;color:#262321;">Pago acreditado</p>
                            </div>`
                          }
                          <div style="border-top:1px solid #d8d1cb;margin-top:22px;padding-top:20px;">
                            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8e8179;">Cliente</div>
                            <p style="margin:10px 0 0 0;font-size:15px;line-height:23px;color:#262321;font-weight:700;">${escapeHtml(order.customer.name)}</p>
                            <p style="margin:3px 0 0 0;font-size:13px;line-height:20px;color:#6f6560;">${escapeHtml(order.customer.phone)}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <div style="height:28px;line-height:28px;font-size:28px;">&nbsp;</div>
                    ${button}
                    <p style="margin:20px 0 0 0;font-size:12px;line-height:20px;color:#8e8179;">Este comprobante refleja los cobros aprobados del pedido.${
                      approvedPayment?.kind === "DEPOSIT"
                        ? " Si queda saldo pendiente, Natta lo coordina antes de la entrega."
                        : ""
                    }</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0 8px;text-align:center;font-size:12px;line-height:20px;color:#8e8179;">Natta Vascas · Pedido por encargo · Devoto y Nordelta</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function loadReceiptOrder(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: {
    customer: true,
    items: { include: { flavor: true, size: true }, orderBy: { createdAt: "asc" } },
    payments: { orderBy: { createdAt: "asc" } },
  } });
}

export async function buildReceiptContent(order: ReceiptOrder) {
  const hours = order.fulfillmentMode === "PICKUP"
    ? await getPickupHoursLabelForDate(order.deliveryDate, order.branchCode) : null;
  return { html: buildOrderReceiptHtml(order, hours), text: getOrderReceiptText(order, hours), subject: `Comprobante Natta ${order.publicReceiptCode}` };
}

export async function sendOrderReceiptEmailIfNeeded(orderId: string, options: SendOrderReceiptEmailOptions = {}): Promise<OrderReceiptEmailResult> {
  try {
    if ((await getCommerceBridge())?.enabled) {
      if (options.force) return { sent: false, skippedReason: "REVIEW_REQUIRED", error: "Reenviá el comprobante desde el pedido en Cobots." };
      await pushCommerceOrder(orderId);
      const result = await cobotsRequest("/api/storefront/commerce/receipt-email", { orderId });
      if (result.sent && result.resendId && result.sentTo) {
        // Keep the temporary local panel in sync without creating a new revision
        // every time the same accepted receipt is read again.
        await prisma.order.updateMany({
          where: { id: orderId, OR: [{ receiptEmailResendId: null }, { receiptEmailResendId: { not: result.resendId } }, { receiptEmailSentTo: { not: result.sentTo } }] },
          data: { receiptEmailSentAt: result.sentAt ? new Date(result.sentAt) : new Date(), receiptEmailSentTo: result.sentTo, receiptEmailResendId: result.resendId, receiptEmailLastError: null },
        });
      }
      return { sent: result.sent === true, resendId: result.resendId ?? null, sentTo: result.sentTo, ...(result.sent ? {} : { skippedReason: "SEND_FAILED" as const, error: result.message }) };
    }
    return await dispatchOrderReceipt(orderId, options);
  }
  catch {
    const error = "No se pudo preparar el comprobante. Revisá la configuración de correo.";
    await prisma.order.update({ where: { id: orderId }, data: { receiptEmailLastError: error } }).catch(() => null);
    if (options.throwOnError) throw new Error(error);
    return { sent: false, skippedReason: "SEND_FAILED", error };
  }
}
