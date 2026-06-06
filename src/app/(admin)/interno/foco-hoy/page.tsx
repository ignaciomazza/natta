import Link from "next/link";
import { CalendarClock, Coins, PackageCheck, Target } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SectionTitle, buttonSoftClassName, panelClassName } from "@/components/internal/ui";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("es-AR").format(value);

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(value);

const formatTime = (value: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);

function getOrderStatusLabel(status: string) {
  if (status === "PENDING") return "Pendiente";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "DELIVERED") return "Entregado";
  if (status === "CANCELLED") return "Cancelado";
  return status;
}

function getModeLabel(mode: string) {
  if (mode === "PICKUP") return "Retiro";
  if (mode === "DELIVERY") return "Envío";
  return mode;
}

type PrepDay = {
  dateLabel: string;
  orders: number;
  pending: number;
  confirmed: number;
  balanceArs: number;
};

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "danger" | "success";
};

function SummaryCard({ label, value, detail, tone = "neutral" }: SummaryCardProps) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50/75"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/80"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50/75"
          : "border-[color:var(--line)] bg-white/90";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--chocolate-deep)]">{value}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </div>
  );
}

export default async function FocoHoyPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const nextTwoDaysEnd = new Date(todayStart);
  nextTwoDaysEnd.setDate(nextTwoDaysEnd.getDate() + 3);

  const todayWhere: Prisma.OrderWhereInput = {
    status: { in: ["PENDING", "CONFIRMED"] },
    deliveryDate: { gte: todayStart, lt: tomorrowStart },
  };

  const nextTwoDaysWhere: Prisma.OrderWhereInput = {
    status: { in: ["PENDING", "CONFIRMED"] },
    deliveryDate: { gte: tomorrowStart, lt: nextTwoDaysEnd },
  };

  const [
    todayOrdersTotal,
    todayOrdersPreview,
    todayBalanceAggregate,
    pendingPaymentsTotal,
    pendingPaymentsPreview,
    pendingPaymentsAmountAggregate,
    nextTwoDaysTotal,
    nextTwoDaysPreview,
    nextTwoDaysDailyStatus,
    overdueOrders,
  ] = await Promise.all([
    prisma.order.count({ where: todayWhere }),
    prisma.order.findMany({
      where: todayWhere,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        customer: { select: { name: true, phone: true } },
      },
      take: 12,
    }),
    prisma.order.aggregate({
      where: todayWhere,
      _sum: { amountBalanceArs: true },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: [{ createdAt: "asc" }],
      include: {
        order: {
          select: {
            publicReceiptCode: true,
            customer: { select: { name: true } },
          },
        },
      },
      take: 12,
    }),
    prisma.payment.aggregate({
      where: { status: "PENDING" },
      _sum: { amountArs: true },
    }),
    prisma.order.count({ where: nextTwoDaysWhere }),
    prisma.order.findMany({
      where: nextTwoDaysWhere,
      orderBy: [{ deliveryDate: "asc" }, { status: "asc" }, { createdAt: "asc" }],
      include: {
        customer: { select: { name: true } },
      },
      take: 14,
    }),
    prisma.order.groupBy({
      by: ["deliveryDate", "status"],
      where: nextTwoDaysWhere,
      _count: { id: true },
      _sum: { amountBalanceArs: true },
    }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        deliveryDate: { lt: todayStart },
      },
    }),
  ]);

  const todayPending = todayOrdersPreview.filter((order) => order.status === "PENDING").length;
  const todayConfirmed = todayOrdersPreview.filter((order) => order.status === "CONFIRMED").length;
  const todayBalance = todayBalanceAggregate._sum?.amountBalanceArs ?? 0;

  const pendingPaymentsAmount = pendingPaymentsAmountAggregate._sum.amountArs ?? 0;

  const prepByDate = new Map<string, PrepDay>();
  for (const row of nextTwoDaysDailyStatus) {
    const key = row.deliveryDate.toISOString().slice(0, 10);
    const current = prepByDate.get(key) ?? {
      dateLabel: formatDate(row.deliveryDate),
      orders: 0,
      pending: 0,
      confirmed: 0,
      balanceArs: 0,
    };

    const counted = row._count?.id ?? 0;
    current.orders += counted;
    if (row.status === "PENDING") current.pending += counted;
    if (row.status === "CONFIRMED") current.confirmed += counted;
    current.balanceArs += row._sum?.amountBalanceArs ?? 0;
    prepByDate.set(key, current);
  }
  const prepDays = Array.from(prepByDate.values()).sort((a, b) =>
    a.dateLabel.localeCompare(b.dateLabel, "es-AR"),
  );

  return (
    <section className="space-y-6">
      <SectionTitle
        action={
          <div className="flex flex-wrap gap-2">
            <Link className={buttonSoftClassName} href="/interno/pedidos">
              Ver pedidos
            </Link>
            <Link className={buttonSoftClassName} href="/interno/cobros">
              Ver cobros
            </Link>
          </div>
        }
        description="Tablero diario para ejecutar prioridades sin ruido visual."
        icon={Target}
        title="Foco de hoy"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          detail={`${formatNumber(todayPending)} pendientes · ${formatNumber(todayConfirmed)} confirmados`}
          label="Entregas de hoy"
          tone={todayOrdersTotal > 0 ? "warning" : "neutral"}
          value={formatNumber(todayOrdersTotal)}
        />
        <SummaryCard
          detail={`${formatMoney(pendingPaymentsAmount)} por aprobar`}
          label="Cobranzas pendientes"
          tone={pendingPaymentsTotal > 0 ? "danger" : "success"}
          value={formatNumber(pendingPaymentsTotal)}
        />
        <SummaryCard
          detail="Mañana y pasado"
          label="Preparación próximos 2 días"
          tone={nextTwoDaysTotal > 0 ? "warning" : "neutral"}
          value={formatNumber(nextTwoDaysTotal)}
        />
        <SummaryCard
          detail={`${formatMoney(todayBalance)} saldo de hoy`}
          label="Pedidos vencidos"
          tone={overdueOrders > 0 ? "danger" : "success"}
          value={formatNumber(overdueOrders)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className={panelClassName}>
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Entregas de hoy
            </p>
            <p className="text-xs text-zinc-600">
              Mostrando {formatNumber(todayOrdersPreview.length)} de {formatNumber(todayOrdersTotal)}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <span>Cliente / pedido</span>
            <span className="text-right">Estado</span>
            <span className="text-right">Saldo</span>
          </div>
          <div className="mt-1 max-h-[22rem] divide-y divide-[color:var(--line)] overflow-y-auto">
            {todayOrdersPreview.length ? (
              todayOrdersPreview.map((order) => (
                <div key={order.id} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--chocolate-deep)]">
                      {order.customer.name}
                    </p>
                    <p className="truncate text-xs text-zinc-600">
                      #{order.publicReceiptCode} · {getModeLabel(order.fulfillmentMode)} · {order.customer.phone}
                    </p>
                  </div>
                  <p className="text-right text-xs text-zinc-700">{getOrderStatusLabel(order.status)}</p>
                  <p className="text-right text-sm font-medium text-[color:var(--chocolate-deep)]">
                    {formatMoney(order.amountBalanceArs)}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-zinc-600">No hay entregas programadas para hoy.</p>
            )}
          </div>
        </article>

        <article className={panelClassName}>
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <Coins className="h-3.5 w-3.5" />
              Cobranzas pendientes
            </p>
            <p className="text-xs text-zinc-600">
              Mostrando {formatNumber(pendingPaymentsPreview.length)} de {formatNumber(pendingPaymentsTotal)}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <span>Cliente / referencia</span>
            <span className="text-right">Hora</span>
            <span className="text-right">Monto</span>
          </div>
          <div className="mt-1 max-h-[22rem] divide-y divide-[color:var(--line)] overflow-y-auto">
            {pendingPaymentsPreview.length ? (
              pendingPaymentsPreview.map((payment) => (
                <div key={payment.id} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--chocolate-deep)]">
                      {payment.order?.customer?.name || payment.customerName || "Cobro sin cliente"}
                    </p>
                    <p className="truncate text-xs text-zinc-600">
                      {payment.order?.publicReceiptCode
                        ? `Pedido #${payment.order.publicReceiptCode}`
                        : "Sin pedido asociado"}{" "}
                      · {payment.method}
                    </p>
                  </div>
                  <p className="text-right text-xs text-zinc-700">{formatTime(payment.createdAt)}</p>
                  <p className="text-right text-sm font-medium text-[color:var(--chocolate-deep)]">
                    {formatMoney(payment.amountArs)}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-zinc-600">No hay cobranzas pendientes ahora.</p>
            )}
          </div>
        </article>
      </div>

      <article className={panelClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <PackageCheck className="h-3.5 w-3.5" />
            Preparación próximos 2 días
          </p>
          <p className="text-xs text-zinc-600">
            Mostrando {formatNumber(nextTwoDaysPreview.length)} de {formatNumber(nextTwoDaysTotal)}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {prepDays.length ? (
            prepDays.map((day) => (
              <div
                key={day.dateLabel}
                className="rounded-xl border border-[color:var(--line)] bg-white/80 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[color:var(--chocolate-deep)]">{day.dateLabel}</p>
                  <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                    {formatNumber(day.orders)} pedidos
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {formatNumber(day.pending)} pendientes · {formatNumber(day.confirmed)} confirmados
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">Saldo: {formatMoney(day.balanceArs)}</p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm text-zinc-600 sm:col-span-2">
              No hay pedidos para preparar en los próximos 2 días.
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          <span>Cliente</span>
          <span className="text-right">Fecha</span>
          <span className="text-right">Estado</span>
        </div>
        <div className="mt-1 max-h-[18rem] divide-y divide-[color:var(--line)] overflow-y-auto">
          {nextTwoDaysPreview.length ? (
            nextTwoDaysPreview.map((order) => (
              <div key={order.id} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto] gap-2 py-2.5">
                <p className="truncate text-sm font-medium text-[color:var(--chocolate-deep)]">
                  {order.customer.name}
                </p>
                <p className="text-right text-xs text-zinc-700">{formatDate(order.deliveryDate)}</p>
                <p className="text-right text-xs text-zinc-700">{getOrderStatusLabel(order.status)}</p>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-zinc-600">No hay pedidos en preparación para mañana y pasado.</p>
          )}
        </div>
      </article>

      <div className="flex flex-wrap gap-2">
        <Link className={buttonSoftClassName} href="/interno/pedidos">
          Gestionar estados de pedidos
        </Link>
        <Link className={buttonSoftClassName} href="/interno/cobros">
          Confirmar cobranzas
        </Link>
        <Link className={buttonSoftClassName} href="/interno/cupos">
          Revisar cupos
        </Link>
      </div>
    </section>
  );
}
