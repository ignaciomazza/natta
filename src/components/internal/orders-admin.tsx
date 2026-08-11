"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  ListFilter,
  Mail,
  PackageCheck,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Truck,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Disclosure,
  Pill,
  SectionTitle,
  buttonSoftClassName,
  controlRowClassName,
  fieldLabelClassName,
  inputClassName,
} from "@/components/internal/ui";
import { SelectField, SelectOption } from "@/components/internal/select-field";
import { formatDateOnly } from "@/lib/date-only";
import { branches, type Branch, type BranchSlug } from "@/lib/branches";

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
type PeriodUnit = "day" | "week" | "month";
type PeriodMode = PeriodUnit | "custom";
type DateRange = { from: string; to: string };
type NearbyOrderCounts = {
  next: number;
  previous: number;
};

type OrderLineItem = {
  id: string;
  quantity: number;
  unitPriceArs: number;
  subtotalArs: number;
  flavor: string;
  size: string;
};

type OrderPayment = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED";
  method: "MERCADO_PAGO" | "TRANSFER" | "CASH" | "MANUAL";
  externalReference: string | null;
  providerPreferenceId: string | null;
  providerPaymentId: string | null;
  referenceNote: string | null;
  statusDetail: string | null;
};

type OrderItem = {
  id: string;
  branch: Branch;
  status: OrderStatus;
  fulfillmentMode: "PICKUP" | "DELIVERY";
  deliveryDate: string;
  publicReceiptCode: string;
  mercadoPagoExternalReference: string | null;
  mercadoPagoPreferenceId: string | null;
  subtotalArs: number;
  amountDueNowArs: number;
  amountPaidArs: number;
  amountBalanceArs: number;
  receiptEmailLastError: string | null;
  receiptEmailSentAt: string | null;
  receiptEmailSentTo: string | null;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
  items: OrderLineItem[];
  payments: OrderPayment[];
};

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const statusOptions: OrderStatus[] = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];
const statusFilterOptions: {
  icon: LucideIcon;
  label: string;
  value: "ALL" | OrderStatus;
}[] = [
  { icon: CheckCircle2, label: "Confirmados", value: "CONFIRMED" },
  { icon: Clock3, label: "Pendientes", value: "PENDING" },
  { icon: PackageCheck, label: "Entregados", value: "DELIVERED" },
  { icon: XCircle, label: "Cancelados", value: "CANCELLED" },
  { icon: ListFilter, label: "Todos", value: "ALL" },
];
const periodOptions: { label: string; value: PeriodUnit }[] = [
  { label: "Día", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
];

const statusSelectToneClass: Record<OrderStatus, string> = {
  PENDING: "border-amber-300 bg-amber-100 text-amber-800",
  CONFIRMED: "border-emerald-300 bg-emerald-100 text-emerald-800",
  DELIVERED: "border-sky-300 bg-sky-100 text-sky-800",
  CANCELLED: "border-rose-300 bg-rose-100 text-rose-800",
};

const statusIconByStatus: Record<OrderStatus, LucideIcon> = {
  PENDING: Clock3,
  CONFIRMED: CheckCircle2,
  DELIVERED: PackageCheck,
  CANCELLED: XCircle,
};

function getStatusSelectClassName(status: OrderStatus) {
  return `!h-8 !w-full !min-w-[9.75rem] cursor-pointer !rounded-full !border !px-3 !py-0 !pr-8 !text-xs !font-semibold leading-tight focus:!border-[color:var(--accent)] focus:!ring-0 ${statusSelectToneClass[status]}`;
}

const statusSelectWrapperClassName = "w-full min-w-[9.75rem]";
const orderCardClassName =
  "order-card grid gap-3 rounded-[1.6rem] bg-[color:var(--milk)]/92 p-3.5 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.72),0_8px_18px_-18px_rgba(82,74,70,0.48)] transition-shadow hover:shadow-[0_20px_44px_-30px_rgba(38,35,33,0.78),0_12px_24px_-18px_rgba(82,74,70,0.52)]";
const orderCompactButtonClassName =
  "inline-flex h-8 min-w-0 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--line)] bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55";
const mercadoPagoReviewTitle =
  "Consulta Mercado Pago y actualiza el estado si encuentra un pago aprobado. No confirma pagos manualmente.";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function formatDate(value: string) {
  return formatDateOnly(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function getItemCount(items: OrderLineItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function getOrderSummary(items: OrderLineItem[]) {
  if (!items.length) return "Sin detalle de productos";
  return items
    .map((item) => `${item.quantity} ${item.size} ${item.flavor}`)
    .join(" · ");
}

function formatReference(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

const mercadoPagoStatusDetailLabels: Record<string, string> = {
  accredited: "Acreditado",
  pending_contingency: "Pendiente de acreditación",
  pending_review_manual: "En revisión manual",
};

function formatMercadoPagoStatusDetail(value: string | null | undefined) {
  if (!value) return null;
  return mercadoPagoStatusDetailLabels[value] ?? value.replaceAll("_", " ");
}

function getPrimaryMercadoPagoPayment(item: OrderItem) {
  const mercadoPagoPayments = item.payments.filter(
    (payment) => payment.method === "MERCADO_PAGO",
  );
  return (
    mercadoPagoPayments.find((payment) => payment.status === "APPROVED") ??
    mercadoPagoPayments.find((payment) => payment.providerPaymentId) ??
    mercadoPagoPayments[0] ??
    null
  );
}

function getMercadoPagoSyncPayload(item: OrderItem) {
  const payment = getPrimaryMercadoPagoPayment(item);
  if (!payment) return null;

  return {
    orderId: item.id,
    ...(payment.providerPaymentId
      ? { providerPaymentId: payment.providerPaymentId }
      : {}),
    ...(payment.externalReference
      ? { externalReference: payment.externalReference }
      : item.mercadoPagoExternalReference
        ? { externalReference: item.mercadoPagoExternalReference }
        : {}),
  };
}

function getMercadoPagoSummary(item: OrderItem) {
  const payment = getPrimaryMercadoPagoPayment(item);
  if (!payment) {
    return {
      title: "Sin cobro MP",
      detail: null,
    };
  }

  if (payment.providerPaymentId) {
    return {
      title: `Operación MP ${payment.providerPaymentId}`,
      detail: formatMercadoPagoStatusDetail(payment.statusDetail),
    };
  }

  if (payment.providerPreferenceId ?? item.mercadoPagoPreferenceId) {
    return {
      title: `Preferencia ${formatReference(payment.providerPreferenceId ?? item.mercadoPagoPreferenceId)}`,
      detail: "Pago iniciado, todavía sin operación aprobada.",
    };
  }

  const externalReference =
    payment.externalReference ?? item.mercadoPagoExternalReference;

  return {
    title: externalReference
      ? `Referencia ${formatReference(externalReference)}`
      : "Cobro pendiente",
    detail: "Referencia del intento de pago; no confirma cobro.",
  };
}

function shouldShowMercadoPagoReview(item: OrderItem) {
  const payment = getPrimaryMercadoPagoPayment(item);
  return item.status === "PENDING" || payment?.status !== "APPROVED";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfPeriod(date: Date, unit: PeriodUnit) {
  const current = startOfDay(date);

  if (unit === "day") return current;

  if (unit === "week") {
    const mondayOffset = (current.getDay() + 6) % 7;
    return addDays(current, -mondayOffset);
  }

  if (unit === "month") {
    return new Date(current.getFullYear(), current.getMonth(), 1);
  }

  return current;
}

function addPeriod(date: Date, unit: PeriodUnit, direction: -1 | 1) {
  const current = startOfPeriod(date, unit);

  if (unit === "day") return addDays(current, direction);
  if (unit === "week") return addDays(current, direction * 7);
  return new Date(current.getFullYear(), current.getMonth() + direction, 1);
}

function getPeriodRange(unit: PeriodUnit, anchor: Date) {
  const from = startOfPeriod(anchor, unit);

  if (unit === "day") return { from, to: from };
  if (unit === "week") return { from, to: addDays(from, 6) };
  return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 0) };
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateParam(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateRange(range: DateRange, direction: -1 | 1) {
  const from = parseDateParam(range.from);
  const to = parseDateParam(range.to);
  const days = Math.max(
    1,
    Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1,
  );

  return {
    from: formatDateParam(addDays(from, days * direction)),
    to: formatDateParam(addDays(to, days * direction)),
  };
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date).replace(".", "");
}

function formatPeriodLabel(mode: PeriodMode, range: { from: Date; to: Date }) {
  if (mode === "day") return formatShortDate(range.from);

  if (mode === "month") {
    return new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(range.from);
  }

  return `${formatShortDate(range.from)} - ${formatShortDate(range.to)}`;
}

function formatOrderQuantity(count: number) {
  return `${count} ${count === 1 ? "pedido" : "pedidos"}`;
}

function FulfillmentModeChip({
  mode,
}: {
  mode: "PICKUP" | "DELIVERY";
}) {
  const isPickup = mode === "PICKUP";
  const label = isPickup ? "Retiro" : "Envío";
  const Icon = isPickup ? Store : Truck;

  return (
    <Pill mini tone={isPickup ? "neutral" : "info"}>
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    </Pill>
  );
}

function OrderStatusSelect({
  item,
  onChange,
}: {
  item: Pick<OrderItem, "status" | "id">;
  onChange: (id: string, status: OrderStatus) => void;
}) {
  return (
    <div className={statusSelectWrapperClassName}>
      <SelectField
        className={getStatusSelectClassName(item.status)}
        onChange={(value) => {
          onChange(item.id, value as OrderStatus);
        }}
        value={item.status}
      >
        {statusOptions.map((status) => {
          const Icon = statusIconByStatus[status];

          return (
            <SelectOption key={status} value={status}>
              <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{statusLabel[status]}</span>
              </span>
            </SelectOption>
          );
        })}
      </SelectField>
    </div>
  );
}

export function OrdersAdmin() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [receiptEmailConfirmItem, setReceiptEmailConfirmItem] =
    useState<OrderItem | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [nearbyCounts, setNearbyCounts] = useState<NearbyOrderCounts>({
    next: 0,
    previous: 0,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("CONFIRMED");
  const [modeFilter, setModeFilter] = useState<"ALL" | "pickup" | "delivery">("ALL");
  const [branchFilter, setBranchFilter] = useState<"ALL" | BranchSlug>("ALL");
  const [dateMode, setDateMode] = useState<PeriodMode>("week");
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("week");
  const [periodAnchor, setPeriodAnchor] = useState(() => startOfPeriod(new Date(), "week"));
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [customDraftFrom, setCustomDraftFrom] = useState("");
  const [customDraftTo, setCustomDraftTo] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  const load = async (
    overrides: Partial<{
      query: string;
      status: "ALL" | OrderStatus;
      mode: "ALL" | "pickup" | "delivery";
      branch: "ALL" | BranchSlug;
      dateMode: PeriodMode;
      periodUnit: PeriodUnit;
      periodAnchor: Date;
      customRange: DateRange | null;
    }> = {},
  ) => {
    setLoading(true);
    setError(null);
    try {
      const nextQuery = overrides.query ?? query;
      const nextStatus = overrides.status ?? statusFilter;
      const nextMode = overrides.mode ?? modeFilter;
      const nextBranch = overrides.branch ?? branchFilter;
      const nextDateMode = overrides.dateMode ?? dateMode;
      const nextPeriodUnit = overrides.periodUnit ?? periodUnit;
      const nextPeriodAnchor = overrides.periodAnchor ?? periodAnchor;
      const nextCustomRange =
        overrides.customRange === undefined ? customRange : overrides.customRange;
      const nextPeriodRange =
        nextDateMode === "custom" && nextCustomRange
          ? {
              from: parseDateParam(nextCustomRange.from),
              to: parseDateParam(nextCustomRange.to),
            }
          : getPeriodRange(nextPeriodUnit, nextPeriodAnchor);
      const baseParams = new URLSearchParams();
      if (nextQuery.trim()) baseParams.set("q", nextQuery.trim());
      if (nextStatus !== "ALL") baseParams.set("status", nextStatus.toLowerCase());
      if (nextMode !== "ALL") baseParams.set("mode", nextMode);
      if (nextBranch !== "ALL") baseParams.set("branch", nextBranch);
      const fetchRange = async (from: Date, to: Date) => {
        const params = new URLSearchParams(baseParams);
        params.set("from", formatDateParam(from));
        params.set("to", formatDateParam(to));

        const response = await fetch(`/api/orders?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar pedidos");
        }
        const payload = (await response.json()) as { items: OrderItem[] };
        return payload.items;
      };

      const [currentItems, previousItems, nextItems] = await Promise.all([
        fetchRange(nextPeriodRange.from, nextPeriodRange.to),
        fetchRange(addDays(nextPeriodRange.from, -3), addDays(nextPeriodRange.from, -1)),
        fetchRange(addDays(nextPeriodRange.to, 1), addDays(nextPeriodRange.to, 3)),
      ]);

      setNearbyCounts({
        next: nextItems.length,
        previous: previousItems.length,
      });
      setItems(currentItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchStatus = async (id: string, status: OrderStatus) => {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el estado");
      }

      await load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteCancelledOrder = async (item: OrderItem) => {
    if (item.status !== "CANCELLED") return;

    const confirmed = window.confirm(
      "Eliminar este pedido cancelado? Esta accion no se puede deshacer.",
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudo eliminar el pedido");
      }

      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error");
    } finally {
      setDeletingId(null);
    }
  };

  const syncMercadoPagoPayment = async (item: OrderItem) => {
    const payload = getMercadoPagoSyncPayload(item);
    if (!payload || (!("providerPaymentId" in payload) && !("externalReference" in payload))) {
      setError("No hay identificador de Mercado Pago para revisar");
      return;
    }

    setSyncingId(item.id);
    setError(null);
    try {
      const response = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; found?: number; synced?: number }
        | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "No se pudo revisar Mercado Pago");
      }

      if (result?.found === 0) {
        setError("Mercado Pago no encontró pagos para esa referencia");
      }

      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Error");
    } finally {
      setSyncingId(null);
    }
  };

  const sendReceiptEmail = async (item: OrderItem) => {
    if (!item.customer.email) {
      setError("El pedido no tiene email cargado");
      return;
    }

    setEmailingId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${item.id}/receipt-email`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "No se pudo enviar el comprobante");
      }

      await load();
      setReceiptEmailConfirmItem(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Error");
    } finally {
      setEmailingId(null);
    }
  };

  const selectStatusFilter = (nextStatus: "ALL" | OrderStatus) => {
    setStatusFilter(nextStatus);
    void load({ status: nextStatus });
  };

  const periodRange = useMemo(
    () =>
      dateMode === "custom" && customRange
        ? {
            from: parseDateParam(customRange.from),
            to: parseDateParam(customRange.to),
          }
        : getPeriodRange(periodUnit, periodAnchor),
    [customRange, dateMode, periodAnchor, periodUnit],
  );
  const periodLabel = formatPeriodLabel(dateMode, periodRange);

  const selectPeriodUnit = (nextUnit: PeriodUnit) => {
    const nextAnchor = startOfPeriod(periodAnchor, nextUnit);
    setDateMode(nextUnit);
    setPeriodUnit(nextUnit);
    setPeriodAnchor(nextAnchor);
    void load({ dateMode: nextUnit, periodUnit: nextUnit, periodAnchor: nextAnchor });
  };

  const selectDateMode = (nextMode: string) => {
    if (nextMode === "custom") {
      openCustomModal();
      return;
    }

    selectPeriodUnit(nextMode as PeriodUnit);
  };

  const openCustomModal = () => {
    setCustomDraftFrom(customRange?.from ?? formatDateParam(periodRange.from));
    setCustomDraftTo(customRange?.to ?? formatDateParam(periodRange.to));
    setError(null);
    setCustomRangeError(null);
    setCustomModalOpen(true);
  };

  const applyCustomRange = () => {
    if (!customDraftFrom || !customDraftTo) {
      setCustomRangeError("Elegí fecha desde y hasta");
      return;
    }

    if (customDraftFrom > customDraftTo) {
      setCustomRangeError("La fecha desde no puede ser posterior a la fecha hasta");
      return;
    }

    const nextRange = { from: customDraftFrom, to: customDraftTo };
    setCustomRange(nextRange);
    setDateMode("custom");
    setCustomModalOpen(false);
    setCustomRangeError(null);
    setError(null);
    void load({ customRange: nextRange, dateMode: "custom" });
  };

  const movePeriod = (direction: -1 | 1) => {
    if (dateMode === "custom" && customRange) {
      const nextRange = shiftDateRange(customRange, direction);
      setCustomRange(nextRange);
      void load({ customRange: nextRange, dateMode: "custom" });
      return;
    }

    const nextAnchor = addPeriod(periodAnchor, periodUnit, direction);
    setPeriodAnchor(nextAnchor);
    void load({ periodAnchor: nextAnchor });
  };

  const counts = useMemo(() => {
    const data = {
      total: items.length,
      pending: 0,
      confirmed: 0,
      delivered: 0,
      cancelled: 0,
      products: 0,
    };
    for (const item of items) {
      if (item.status === "PENDING") data.pending += 1;
      if (item.status === "CONFIRMED") data.confirmed += 1;
      if (item.status === "DELIVERED") data.delivered += 1;
      if (item.status === "CANCELLED") data.cancelled += 1;
      data.products += getItemCount(item.items);
    }
    return data;
  }, [items]);

  return (
    <section className="space-y-5">
      <SectionTitle
        icon={ClipboardList}
        title="Pedidos"
      />

      <div className="flex flex-wrap gap-2">
        <Pill>Total: {counts.total}</Pill>
        <Pill tone="warning">Pendientes: {counts.pending}</Pill>
        <Pill tone="success">Confirmados: {counts.confirmed}</Pill>
        <Pill tone="info">Entregados: {counts.delivered}</Pill>
        <Pill>Productos: {counts.products}</Pill>
        {counts.cancelled ? <Pill tone="danger">Cancelados: {counts.cancelled}</Pill> : null}
      </div>

      <Disclosure
        title="Filtros de pedidos"
        variant="dashed"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(10rem,0.65fr)_minmax(10rem,0.65fr)_auto] md:items-end">
          <label className={fieldLabelClassName}>
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                className={`${inputClassName} pl-9`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cliente, teléfono o código"
                value={query}
              />
            </div>
          </label>

          <label className={fieldLabelClassName}>
            Modo
            <SelectField
              onChange={(value) => setModeFilter(value as "ALL" | "pickup" | "delivery")}
              value={modeFilter}
            >
              <SelectOption value="ALL">Todos</SelectOption>
              <SelectOption value="pickup">Retiro</SelectOption>
              <SelectOption value="delivery">Envío</SelectOption>
            </SelectField>
          </label>

          <label className={fieldLabelClassName}>
            Sucursal
            <SelectField
              onChange={(value) => setBranchFilter(value as "ALL" | BranchSlug)}
              value={branchFilter}
            >
              <SelectOption value="ALL">Todas</SelectOption>
              {branches.map((branch) => (
                <SelectOption key={branch.slug} value={branch.slug}>
                  {branch.name}
                </SelectOption>
              ))}
            </SelectField>
          </label>

          <div className={controlRowClassName}>
            <button className={`${buttonSoftClassName} w-full`} onClick={() => void load()} type="button">
              Aplicar
            </button>
          </div>
        </div>
      </Disclosure>

      <div className="mt-1 space-y-3">
        <div className="flex w-full flex-wrap items-start justify-between gap-2">
          <div className="relative w-[12rem] shrink-0">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 z-30 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--accent)]" />
            <div className="relative z-20">
              <SelectField
                className="!h-11 !rounded-[1.45rem] !border-transparent !bg-[color:var(--milk)]/92 !py-0 !pl-9 !pr-8 !text-xs !font-semibold shadow-[0_16px_36px_-30px_rgba(38,35,33,0.7),0_8px_18px_-18px_rgba(82,74,70,0.46)] focus:!border-transparent focus:!ring-0"
                onChange={selectDateMode}
                value={dateMode}
              >
                {periodOptions.map((option) => (
                  <SelectOption key={option.value} value={option.value}>
                    {option.label}
                  </SelectOption>
                ))}
                <SelectOption value="custom">Personalizado</SelectOption>
              </SelectField>
            </div>
          </div>

          <div
            aria-label="Estado de pedidos"
            className="flex w-fit max-w-full justify-end overflow-x-auto rounded-[1.45rem] bg-[color:var(--milk)]/92 p-1.5 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.7),0_8px_18px_-18px_rgba(82,74,70,0.46)]"
            role="group"
          >
            <div className="flex shrink-0 flex-nowrap gap-1">
              {statusFilterOptions.map((option) => {
                const selected = option.value === statusFilter;
                const Icon = option.icon;

                return (
                  <button
                    aria-pressed={selected}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-[1rem] px-2.5 text-xs font-medium transition ${
                      selected
                        ? "bg-[color:var(--chocolate)] text-white shadow-[0_8px_18px_-14px_rgba(38,35,33,0.76)]"
                        : "text-zinc-600 hover:bg-white/70 hover:text-[color:var(--chocolate-deep)]"
                    }`}
                    key={option.value}
                    onClick={() => selectStatusFilter(option.value)}
                    type="button"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-[21.5rem] max-w-full items-center gap-1.5 rounded-[1.45rem] bg-[color:var(--milk)]/92 p-1.5 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.7),0_8px_18px_-18px_rgba(82,74,70,0.46)] sm:w-[23rem]">
          <button
            aria-label="Periodo anterior"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[1rem] bg-white/70 text-[color:var(--chocolate)] transition hover:bg-white"
            onClick={() => movePeriod(-1)}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[1rem] bg-white/70 px-2.5 text-center text-xs font-semibold text-[color:var(--chocolate-deep)]">
            <CalendarDays className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
            <span className="truncate">{periodLabel}</span>
          </div>
          <button
            aria-label="Periodo siguiente"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[1rem] bg-white/70 text-[color:var(--chocolate)] transition hover:bg-white"
            onClick={() => movePeriod(1)}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-[color:var(--milk)]/80 px-3 py-1 text-xs font-medium text-zinc-600 shadow-[0_10px_24px_-20px_rgba(38,35,33,0.62)]">
            3 días previos: {formatOrderQuantity(nearbyCounts.previous)}
          </span>
          <span className="rounded-full bg-[color:var(--milk)]/80 px-3 py-1 text-xs font-medium text-zinc-600 shadow-[0_10px_24px_-20px_rgba(38,35,33,0.62)]">
            3 días próximos: {formatOrderQuantity(nearbyCounts.next)}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600">Cargando pedidos...</p>
      ) : (
        <div className="order-list space-y-2.5">
          {items.length ? (
            items.map((item) => {
              const mercadoPagoSummary = getMercadoPagoSummary(item);
              const mercadoPagoSyncPayload = getMercadoPagoSyncPayload(item);
              const canSyncMercadoPago = Boolean(
                mercadoPagoSyncPayload &&
                  ("providerPaymentId" in mercadoPagoSyncPayload ||
                    "externalReference" in mercadoPagoSyncPayload),
              ) && shouldShowMercadoPagoReview(item);

              return (
              <article
                className={orderCardClassName}
                key={item.id}
              >
                <div className="order-card__customer min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--chocolate-deep)]">
                    {item.customer.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {item.customer.phone}
                    {item.customer.email ? ` · ${item.customer.email}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <FulfillmentModeChip mode={item.fulfillmentMode} />
                    <Pill mini>{item.branch.name}</Pill>
                    <Pill mini tone="info">{formatDate(item.deliveryDate)}</Pill>
                  </div>
                  <p
                    className="mt-1.5 truncate text-[11px] font-medium text-zinc-500"
                    title={item.publicReceiptCode}
                  >
                    Comprobante {item.publicReceiptCode}
                  </p>
                </div>

                <div className="order-card__summary min-w-0">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    Pedido
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-[color:var(--chocolate-deep)] md:text-[13px] lg:text-sm">
                    {getOrderSummary(item.items)}
                  </p>
                </div>

                <div className="order-card__payment min-w-0">
                  <p className="text-base font-semibold text-zinc-950 lg:text-lg">
                    {formatMoney(item.subtotalArs)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Pagado {formatMoney(item.amountPaidArs)} · Saldo{" "}
                    {formatMoney(item.amountBalanceArs)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-zinc-500" title={mercadoPagoSummary.title}>
                    {mercadoPagoSummary.title}
                  </p>
                  {mercadoPagoSummary.detail ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-500">
                      {mercadoPagoSummary.detail}
                    </p>
                  ) : null}
                </div>

                <div className="order-card__controls grid min-w-0 gap-1.5">
                  <div className="order-card__status min-w-0 md:w-full">
                    <OrderStatusSelect
                      item={item}
                      onChange={(id, status) => {
                        void patchStatus(id, status);
                      }}
                    />
                  </div>

                  <a
                    className={`${orderCompactButtonClassName} order-card__receipt-action`}
                    href={`/comprobante/${item.publicReceiptCode}`}
                    rel="noreferrer"
                    target="_blank"
                    title={item.publicReceiptCode}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">Ver comprobante</span>
                  </a>
                  <button
                    className={`${orderCompactButtonClassName} order-card__email-action`}
                    disabled={emailingId === item.id || !item.customer.email}
                    onClick={() => setReceiptEmailConfirmItem(item)}
                    title={
                      item.customer.email
                        ? `Enviar comprobante a ${item.customer.email}`
                        : "El pedido no tiene email cargado"
                    }
                    type="button"
                  >
                    <Mail className={`h-3.5 w-3.5 shrink-0 ${emailingId === item.id ? "animate-pulse" : ""}`} />
                    <span className="min-w-0 truncate">
                      {!item.customer.email
                        ? "Sin email"
                        : emailingId === item.id
                          ? "Enviando"
                          : "Enviar comprobante"}
                    </span>
                  </button>
                  {item.receiptEmailSentAt ? (
                    <p className="order-card__email-note truncate text-[10px] leading-4 text-zinc-500">
                      Enviado {formatDateTime(item.receiptEmailSentAt)}
                      {item.receiptEmailSentTo ? ` · ${item.receiptEmailSentTo}` : ""}
                    </p>
                  ) : null}
                  {item.receiptEmailLastError ? (
                    <p className="order-card__email-note line-clamp-2 text-[10px] leading-4 text-rose-600">
                      {item.receiptEmailLastError}
                    </p>
                  ) : null}
                  {canSyncMercadoPago ? (
                    <button
                      className={`${orderCompactButtonClassName} order-card__secondary-action`}
                      disabled={syncingId === item.id}
                      onClick={() => void syncMercadoPagoPayment(item)}
                      title={mercadoPagoReviewTitle}
                      type="button"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 shrink-0 ${syncingId === item.id ? "animate-spin" : ""}`}
                      />
                      {syncingId === item.id ? "Revisando" : "Revisar pago"}
                    </button>
                  ) : null}
                  {item.status === "CANCELLED" ? (
                    <button
                      className={`${orderCompactButtonClassName} order-card__secondary-action text-rose-700 hover:border-rose-200 hover:text-rose-800`}
                      disabled={deletingId === item.id}
                      onClick={() => void deleteCancelledOrder(item)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      {deletingId === item.id ? "Eliminando" : "Eliminar"}
                    </button>
                  ) : null}
                </div>
              </article>
              );
            })
          ) : (
            <p className="rounded-[1.6rem] bg-[color:var(--milk)]/82 px-4 py-6 text-sm text-zinc-600 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.68),0_8px_18px_-18px_rgba(82,74,70,0.42)]">
              No hay pedidos para los filtros aplicados.
            </p>
          )}
        </div>
      )}

      {updatingId ? (
        <p className="text-xs text-zinc-500">Actualizando pedido {updatingId.slice(-6)}...</p>
      ) : null}
      {deletingId ? (
        <p className="text-xs text-zinc-500">Eliminando pedido {deletingId.slice(-6)}...</p>
      ) : null}

      {receiptEmailConfirmItem ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <button
            aria-label="Cerrar confirmación de envío"
            className="absolute inset-0 bg-[#262321]/24 backdrop-blur-[3px]"
            onClick={() => setReceiptEmailConfirmItem(null)}
            type="button"
          />
          <div
            aria-labelledby="receipt-email-confirm-title"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[1.8rem] bg-[color:var(--milk)] p-5 shadow-[0_28px_80px_-36px_rgba(38,35,33,0.76),0_16px_36px_-20px_rgba(82,74,70,0.56)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3
                  className="text-lg font-semibold text-[color:var(--chocolate-deep)]"
                  id="receipt-email-confirm-title"
                >
                  ¿Enviar comprobante?
                </h3>
              </div>
              <button
                aria-label="Cerrar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/70 text-zinc-600 transition hover:border-[color:var(--accent)] hover:text-[color:var(--chocolate-deep)]"
                onClick={() => setReceiptEmailConfirmItem(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Al concretarse la venta, el comprobante ya debería haberse enviado
              automáticamente. Usá esta opción solo si ese envío falló o si necesitás
              reenviarlo por un motivo puntual.
            </p>

            <div className="mt-4 rounded-2xl border border-[color:var(--line)] bg-white/55 px-3 py-2.5 text-sm text-zinc-600">
              <p className="truncate font-semibold text-[color:var(--chocolate-deep)]">
                {receiptEmailConfirmItem.customer.name}
              </p>
              <p className="mt-1 truncate text-xs">
                {receiptEmailConfirmItem.customer.email}
              </p>
              <p className="mt-1 truncate text-xs">
                Comprobante {receiptEmailConfirmItem.publicReceiptCode}
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className={`${buttonSoftClassName} sm:min-w-[7rem]`}
                disabled={emailingId === receiptEmailConfirmItem.id}
                onClick={() => setReceiptEmailConfirmItem(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--chocolate)] px-4 text-sm font-medium text-white transition hover:bg-[color:var(--chocolate-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[12rem]"
                disabled={emailingId === receiptEmailConfirmItem.id}
                onClick={() => void sendReceiptEmail(receiptEmailConfirmItem)}
                type="button"
              >
                <Mail
                  className={`h-4 w-4 ${emailingId === receiptEmailConfirmItem.id ? "animate-pulse" : ""}`}
                />
                {emailingId === receiptEmailConfirmItem.id
                  ? "Enviando"
                  : "Enviar comprobante"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <button
            aria-label="Cerrar rango personalizado"
            className="absolute inset-0 bg-[#262321]/20 backdrop-blur-[2px]"
            onClick={() => setCustomModalOpen(false)}
            type="button"
          />
          <div
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[1.8rem] bg-[color:var(--milk)] p-5 shadow-[0_28px_80px_-36px_rgba(38,35,33,0.76),0_16px_36px_-20px_rgba(82,74,70,0.56)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--chocolate-deep)]">
                  Rango personalizado
                </h3>
              </div>
              <button
                className="h-8 rounded-full px-3 text-xs font-medium text-zinc-500 transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--chocolate-deep)]"
                onClick={() => setCustomModalOpen(false)}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className={fieldLabelClassName}>
                Desde
                <input
                  className={inputClassName}
                  onChange={(event) => setCustomDraftFrom(event.target.value)}
                  type="date"
                  value={customDraftFrom}
                />
              </label>
              <label className={fieldLabelClassName}>
                Hasta
                <input
                  className={inputClassName}
                  onChange={(event) => setCustomDraftTo(event.target.value)}
                  type="date"
                  value={customDraftTo}
                />
              </label>
            </div>

            {customRangeError ? (
              <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {customRangeError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                className={buttonSoftClassName}
                onClick={() => setCustomModalOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="h-11 rounded-2xl bg-[color:var(--chocolate)] px-4 text-sm font-medium text-white transition hover:bg-[color:var(--chocolate-deep)]"
                onClick={applyCustomRange}
                type="button"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
