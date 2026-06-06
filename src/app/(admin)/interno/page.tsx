import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Coins,
  PackageSearch,
  Receipt,
  Sparkles,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

type Tone = "neutral" | "warning" | "danger" | "success" | "info";

type ActionCardProps = {
  title: string;
  detail: string;
  value: string;
  href: string;
  tone: Tone;
};

type KpiCardProps = {
  title: string;
  value: string;
  detail: string;
  tone?: Tone;
};

type ModuleCardProps = {
  title: string;
  value: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("es-AR").format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);

function safeRatio(value: number, total: number) {
  if (total <= 0) return 0;
  return value / total;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getHealthLabel(score: number | null) {
  if (score === null) return "Sin historial suficiente";
  if (score >= 75) return "Operación sólida";
  if (score >= 55) return "Operación estable";
  if (score >= 35) return "Operación exigida";
  return "Operación en riesgo";
}

function getToneClasses(tone: Tone) {
  if (tone === "danger") return "border-rose-200 bg-rose-50/85";
  if (tone === "warning") return "border-amber-200 bg-amber-50/85";
  if (tone === "success") return "border-emerald-200 bg-emerald-50/80";
  if (tone === "info") return "border-sky-200 bg-sky-50/80";
  return "border-[color:var(--line)] bg-white/90";
}

function ActionCard({ title, detail, value, href, tone }: ActionCardProps) {
  return (
    <Link
      className={`group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(40,35,32,0.06)] ${getToneClasses(tone)}`}
      href={href}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-[color:var(--chocolate-deep)]">{title}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-3xl font-semibold text-[color:var(--chocolate-deep)]">{value}</span>
        <ArrowRight className="h-4 w-4 text-zinc-500 transition group-hover:text-[color:var(--accent)]" />
      </div>
    </Link>
  );
}

function KpiCard({ title, value, detail, tone = "neutral" }: KpiCardProps) {
  return (
    <div className={`rounded-2xl border p-4 ${getToneClasses(tone)}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--chocolate-deep)]">{value}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </div>
  );
}

function ModuleCard({ title, value, detail, href, icon: Icon }: ModuleCardProps) {
  return (
    <Link
      className="group rounded-2xl border border-[color:var(--line)] bg-white/90 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(40,35,32,0.06)]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">{title}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-white text-zinc-700 transition group-hover:border-[color:var(--accent)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold text-[color:var(--chocolate-deep)]">{value}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </Link>
  );
}

export default async function InternoHomePage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const nextTwoDaysEnd = new Date(todayStart);
  nextTwoDaysEnd.setDate(nextTwoDaysEnd.getDate() + 3);

  const [
    orders,
    pendingOrders,
    confirmedOrders,
    deliveredOrders,
    cancelledOrders,
    customers,
    suppliers,
    expenses,
    purchases,
    payments,
    dueTodayOrders,
    dueNextTwoDaysOrders,
    overdueOrders,
    pendingPaymentsCount,
    approvedPaymentsAggregate,
    approvedPurchasesAggregate,
    approvedExpensesAggregate,
    billedOrdersAggregate,
    outstandingOrdersAggregate,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "CONFIRMED" } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.expense.count(),
    prisma.purchase.count(),
    prisma.payment.count(),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        deliveryDate: { gte: todayStart, lt: tomorrowStart },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        deliveryDate: { gte: tomorrowStart, lt: nextTwoDaysEnd },
      },
    }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        deliveryDate: { lt: todayStart },
      },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where: { status: "APPROVED" },
      _sum: { amountArs: true },
    }),
    prisma.purchase.aggregate({
      where: { status: "APPROVED" },
      _sum: { amountArs: true },
    }),
    prisma.expense.aggregate({
      where: { status: "APPROVED" },
      _sum: { amountArs: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: ["PENDING", "CONFIRMED", "DELIVERED"] } },
      _sum: { subtotalArs: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: ["PENDING", "CONFIRMED", "DELIVERED"] } },
      _sum: { amountBalanceArs: true },
    }),
  ]);

  const approvedIncomeArs = approvedPaymentsAggregate._sum.amountArs ?? 0;
  const approvedPurchasesArs = approvedPurchasesAggregate._sum.amountArs ?? 0;
  const approvedExpensesArs = approvedExpensesAggregate._sum.amountArs ?? 0;
  const approvedCostsArs = approvedPurchasesArs + approvedExpensesArs;
  const billedArs = billedOrdersAggregate._sum.subtotalArs ?? 0;
  const outstandingArs = outstandingOrdersAggregate._sum.amountBalanceArs ?? 0;
  const operatingResultArs = approvedIncomeArs - approvedCostsArs;

  const operationalUniverse = Math.max(orders - cancelledOrders, 0);
  const activeOrders = pendingOrders + confirmedOrders;

  const progressRate = safeRatio(confirmedOrders + deliveredOrders, operationalUniverse);
  const collectionRate = safeRatio(approvedIncomeArs, billedArs);
  const pendingLoadRate = safeRatio(pendingOrders, Math.max(activeOrders, 1));

  const hasEnoughHistory =
    operationalUniverse >= 5 || billedArs >= 100_000 || approvedIncomeArs > 0 || approvedCostsArs > 0;
  const healthScore = hasEnoughHistory
    ? clamp(
        Math.round(progressRate * 40 + collectionRate * 35 + (1 - pendingLoadRate) * 25),
        0,
        100,
      )
    : null;
  const healthLabel = getHealthLabel(healthScore);

  const todayLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(todayStart);

  return (
    <section className="space-y-7">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.17em] text-zinc-500">Panel operativo</p>
            <h2 className="mt-1 text-3xl font-semibold text-[color:var(--chocolate-deep)]">
              Resumen general del negocio
            </h2>
            <p className="mt-1.5 text-sm text-zinc-700">
              Vista de decisión rápida: qué atender primero y dónde actuar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--line)] bg-white/90 px-3 py-1 text-xs text-zinc-700">
              {todayLabel}
            </span>
            <span className="rounded-full border border-[color:var(--line)] bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-700">
              Salud: {healthScore === null ? "N/D" : `${healthScore}/100`}
            </span>
            <span className="rounded-full border border-[color:var(--line)] bg-white/90 px-3 py-1 text-xs text-zinc-700">
              {healthLabel}
            </span>
            <Link
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[color:var(--accent)]"
              href="/interno/foco-hoy"
            >
              Abrir foco de hoy
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-zinc-500">
          <Sparkles className="h-3.5 w-3.5" />
          Prioridades
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            detail="Pedidos activos con entrega hoy"
            href="/interno/pedidos"
            title="Entregas de hoy"
            tone={dueTodayOrders > 0 ? "warning" : "neutral"}
            value={formatNumber(dueTodayOrders)}
          />
          <ActionCard
            detail="Cobros pendientes de aprobación"
            href="/interno/cobros"
            title="Cobranzas pendientes"
            tone={pendingPaymentsCount > 0 ? "danger" : "success"}
            value={formatNumber(pendingPaymentsCount)}
          />
          <ActionCard
            detail="Pedidos para mañana y pasado"
            href="/interno/foco-hoy"
            title="Preparar próximos 2 días"
            tone={dueNextTwoDaysOrders > 0 ? "info" : "neutral"}
            value={formatNumber(dueNextTwoDaysOrders)}
          />
          <ActionCard
            detail="Pedidos activos fuera de fecha"
            href="/interno/pedidos"
            title="Pedidos vencidos"
            tone={overdueOrders > 0 ? "danger" : "success"}
            value={formatNumber(overdueOrders)}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">Indicadores clave</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            detail={`${formatNumber(confirmedOrders + deliveredOrders)} de ${formatNumber(operationalUniverse)} pedidos no cancelados`}
            title="Avance de pedidos"
            value={formatPercent(progressRate)}
          />
          <KpiCard
            detail={`${formatMoney(approvedIncomeArs)} sobre ${formatMoney(billedArs)} facturados`}
            title="Cobranza efectiva"
            tone={collectionRate >= 0.6 ? "success" : "warning"}
            value={formatPercent(collectionRate)}
          />
          <KpiCard
            detail={`${formatMoney(approvedIncomeArs)} ingresos · ${formatMoney(approvedCostsArs)} egresos`}
            title="Resultado operativo"
            tone={operatingResultArs >= 0 ? "success" : "danger"}
            value={formatMoney(operatingResultArs)}
          />
          <KpiCard
            detail={`${formatNumber(pendingOrders)} pendientes de ${formatNumber(activeOrders)} activos`}
            title="Carga pendiente"
            tone={pendingLoadRate > 0.6 ? "warning" : "neutral"}
            value={formatPercent(pendingLoadRate)}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-zinc-500">Módulos de gestión</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            detail={`${formatNumber(activeOrders)} activos · ${formatNumber(deliveredOrders)} entregados`}
            href="/interno/pedidos"
            icon={ClipboardList}
            title="Pedidos"
            value={formatNumber(orders)}
          />
          <ModuleCard
            detail={`${formatMoney(outstandingArs)} saldo por cobrar`}
            href="/interno/cobros"
            icon={Coins}
            title="Cobros"
            value={formatNumber(payments)}
          />
          <ModuleCard
            detail={`${formatNumber(customers)} registrados`}
            href="/interno/clientes"
            icon={UsersRound}
            title="Clientes"
            value={formatNumber(customers)}
          />
          <ModuleCard
            detail={`${formatNumber(suppliers)} activos`}
            href="/interno/proveedores"
            icon={Truck}
            title="Proveedores"
            value={formatNumber(suppliers)}
          />
          <ModuleCard
            detail={`${formatMoney(approvedPurchasesArs)} aprobados`}
            href="/interno/compras"
            icon={PackageSearch}
            title="Compras"
            value={formatNumber(purchases)}
          />
          <ModuleCard
            detail={`${formatMoney(approvedExpensesArs)} aprobados`}
            href="/interno/gastos"
            icon={Receipt}
            title="Gastos"
            value={formatNumber(expenses)}
          />
        </div>
      </div>
    </section>
  );
}
