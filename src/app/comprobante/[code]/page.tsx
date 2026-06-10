import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Package,
  Phone,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getReceiptState(order: {
  status: string;
  amountPaidArs: number;
}) {
  if (order.status === "CANCELLED") return "Cancelado";
  if (order.status === "DELIVERED") return "Entregado";
  if (order.amountPaidArs > 0) return "Pago recibido";
  if (order.status === "CONFIRMED") return "Pedido tomado";
  return "En revisión";
}

function getReceiptTone(state: string) {
  if (state === "Pago recibido") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      panel: "border-emerald-100 bg-emerald-50/60",
    };
  }

  if (state === "Entregado") {
    return {
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      panel: "border-sky-100 bg-sky-50/60",
    };
  }

  if (state === "Cancelado") {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      panel: "border-rose-100 bg-rose-50/60",
    };
  }

  return {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    panel: "border-amber-100 bg-amber-50/60",
  };
}

function getReceiptHeadline(state: string) {
  if (state === "Pago recibido") {
    return {
      title: "Ya podés guardar el comprobante",
      description:
        "El pago ya figura acreditado y acá tenés el detalle completo para tenerlo a mano.",
      nextStep:
        "Natta te escribe para confirmar el pedido y coordinar el retiro o la entrega.",
    };
  }

  if (state === "Entregado") {
    return {
      title: "Tu pedido ya fue entregado",
      description:
        "Guardá este comprobante por cualquier consulta futura sobre el pedido o el cobro.",
      nextStep: "No te queda saldo pendiente.",
    };
  }

  if (state === "Cancelado") {
    return {
      title: "Este comprobante quedó sin efecto",
      description:
        "El pedido fue cancelado. Si necesitás retomarlo, podés hacer uno nuevo desde la web.",
      nextStep: "Si ya habías hecho un pago, revisá el detalle con Natta.",
    };
  }

  if (state === "Pedido tomado") {
    return {
      title: "Tu pedido ya fue tomado",
      description:
        "Natta ya recibió el pedido. El comprobante queda listo para que tengas a mano el detalle.",
      nextStep: "Si falta cobrar una seña o un saldo, Natta te lo va a indicar.",
    };
  }

  return {
    title: "Tu pedido está en revisión",
    description:
      "Todavía estamos esperando la acreditación o la confirmación final. Mientras tanto, el comprobante ya quedó generado.",
    nextStep: "Si el pago fue reciente, actualizá la página dentro de unos segundos.",
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

export const metadata: Metadata = {
  title: "Comprobante | Natta",
};

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const order = await prisma.order.findUnique({
    where: { publicReceiptCode: code },
    include: {
      customer: true,
      items: {
        include: {
          flavor: true,
          size: true,
        },
      },
      payments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!order) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
        <article className="rounded-[28px] border border-zinc-200 bg-white p-7 shadow-[0_24px_80px_rgba(39,28,24,0.08)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Natta · Comprobante
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
            No encontramos ese comprobante
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
            Revisá el código y volvé a intentarlo. Si el pago fue reciente, esperá unos
            segundos y actualizá la página.
          </p>
        </article>
      </main>
    );
  }

  const stateLabel = getReceiptState(order);
  const tone = getReceiptTone(stateLabel);
  const headline = getReceiptHeadline(stateLabel);
  const customerName = order.customer?.name?.trim() || "Sin nombre cargado";
  const customerPhone = order.customer?.phone?.trim() || "Sin teléfono cargado";
  const firstPayment = order.payments[0] ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-14 sm:px-6">
      <article className="rounded-[28px] border border-zinc-200 bg-white p-7 shadow-[0_24px_80px_rgba(39,28,24,0.08)] sm:p-10">
        <div className="flex flex-col gap-5 border-b border-zinc-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Natta · Comprobante
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-5xl">
              {headline.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
              {headline.description}
            </p>
          </div>

          <div
            className={`inline-flex w-fit rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${tone.badge}`}
          >
            {stateLabel}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <section className={`rounded-[24px] border p-5 sm:p-6 ${tone.panel}`}>
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 text-zinc-900 shadow-sm">
                  <BadgeCheck className="h-6 w-6" strokeWidth={2} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Código del comprobante
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-3xl">
                    {order.publicReceiptCode}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Próximo paso
                </p>
                <p className="text-sm leading-7 text-zinc-700">{headline.nextStep}</p>
                {firstPayment?.providerPaymentId ? (
                  <p className="text-sm leading-7 text-zinc-600">
                    Operación {firstPayment.providerPaymentId}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="space-y-8">
              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-5 w-5 text-zinc-500" strokeWidth={1.9} />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Datos del pedido
                  </h2>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <CalendarDays className="h-4 w-4" strokeWidth={1.9} />
                      <span>Fecha de entrega</span>
                    </div>
                    <p className="text-lg font-medium text-zinc-900">
                      {formatDate(order.deliveryDate)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <Package className="h-4 w-4" strokeWidth={1.9} />
                      <span>Modalidad</span>
                    </div>
                    <p className="text-lg font-medium text-zinc-900">
                      {order.fulfillmentMode === "PICKUP" ? "Retiro" : "Envío"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <ReceiptText className="h-4 w-4" strokeWidth={1.9} />
                      <span>Total del pedido</span>
                    </div>
                    <p className="text-lg font-medium text-zinc-900">
                      {formatMoney(order.subtotalArs)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-zinc-500" strokeWidth={1.9} />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Detalle
                  </h2>
                </div>

                <ul className="mt-5 space-y-3">
                  {order.items.map((item, index) => (
                    <li
                      className="flex items-start gap-3 border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
                      key={`${item.flavor.slug}-${item.size.slug}-${index}`}
                    >
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-300" />
                      <p className="font-medium text-zinc-900">
                        {item.quantity} x {item.flavor.name} {item.size.name}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {order.payments.length > 0 ? (
                <div className="border-t border-zinc-200 pt-6">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-zinc-500" strokeWidth={1.9} />
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Cobro registrado
                    </h2>
                  </div>

                  <ul className="mt-5 space-y-4">
                    {order.payments.map((payment) => (
                      <li
                        className="grid gap-2 border-b border-zinc-100 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto]"
                        key={payment.id}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-zinc-900">
                            {getPaymentMethodLabel(payment.method)}
                          </p>
                          <p className="text-sm leading-6 text-zinc-600">
                            {payment.paidAt
                              ? `Registrado el ${formatDateTime(payment.paidAt)}`
                              : `Creado el ${formatDateTime(payment.createdAt)}`}
                          </p>
                          {payment.providerPaymentId ? (
                            <p className="text-sm leading-6 text-zinc-600">
                              Operación {payment.providerPaymentId}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-sm font-medium text-zinc-700">
                          {getPaymentStatusLabel(payment.status)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {order.notes ? (
                <div className="border-t border-zinc-200 pt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Aclaraciones
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-700">{order.notes}</p>
                </div>
              ) : null}
            </section>

            <aside className="space-y-8">
              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-zinc-500" strokeWidth={1.9} />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Resumen de pago
                  </h2>
                </div>

                <div className="mt-5 space-y-3 text-sm text-zinc-700">
                  <div className="flex items-center justify-between gap-4">
                    <span>Total del pedido</span>
                    <strong className="text-zinc-900">{formatMoney(order.subtotalArs)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Pagado</span>
                    <strong className="text-zinc-900">{formatMoney(order.amountPaidArs)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Saldo pendiente</span>
                    <strong className="text-zinc-900">
                      {formatMoney(order.amountBalanceArs)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-zinc-500" strokeWidth={1.9} />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Cliente
                  </h2>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.9} />
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Nombre</p>
                      <p className="mt-1 text-base font-medium text-zinc-900">{customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.9} />
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Teléfono</p>
                      <p className="mt-1 text-base font-medium text-zinc-900">{customerPhone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </article>
    </main>
  );
}
