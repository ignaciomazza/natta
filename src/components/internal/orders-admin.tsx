"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, Search, Store, Truck } from "lucide-react";
import {
  Disclosure,
  Pill,
  SectionTitle,
  SelectField,
  buttonSoftClassName,
  controlRowClassName,
  fieldLabelClassName,
  inputClassName,
  tableShellClassName,
} from "@/components/internal/ui";

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

type OrderItem = {
  id: string;
  status: OrderStatus;
  fulfillmentMode: "PICKUP" | "DELIVERY";
  deliveryDate: string;
  publicReceiptCode: string;
  subtotalArs: number;
  amountPaidArs: number;
  amountBalanceArs: number;
  customer: {
    name: string;
    phone: string;
  };
};

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const statusOptions: OrderStatus[] = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];

const statusSelectToneClass: Record<OrderStatus, string> = {
  PENDING: "border-amber-300 bg-amber-100 text-amber-800",
  CONFIRMED: "border-emerald-300 bg-emerald-100 text-emerald-800",
  DELIVERED: "border-sky-300 bg-sky-100 text-sky-800",
  CANCELLED: "border-rose-300 bg-rose-100 text-rose-800",
};

function getStatusSelectClassName(status: OrderStatus) {
  return `!h-8 !w-full cursor-pointer !rounded-full !border !px-3 !py-0 !pr-9 !text-xs !font-semibold leading-tight focus:!border-[color:var(--accent)] focus:!ring-0 ${statusSelectToneClass[status]}`;
}

const statusSelectWrapperClassName = "inline-block w-[132px]";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
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
    <span
      aria-label={label}
      className="inline-flex items-center justify-center text-[color:var(--chocolate)]"
      title={label}
    >
      <Icon className="h-4 w-4" />
    </span>
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
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {statusLabel[status]}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function OrdersAdmin() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [modeFilter, setModeFilter] = useState<"ALL" | "pickup" | "delivery">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter.toLowerCase());
      if (modeFilter !== "ALL") params.set("mode", modeFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const response = await fetch(`/api/orders?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("No se pudieron cargar pedidos");
      }
      const payload = (await response.json()) as { items: OrderItem[] };
      setItems(payload.items);
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

  const counts = useMemo(() => {
    const data = {
      total: items.length,
      pending: 0,
      confirmed: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const item of items) {
      if (item.status === "PENDING") data.pending += 1;
      if (item.status === "CONFIRMED") data.confirmed += 1;
      if (item.status === "DELIVERED") data.delivered += 1;
      if (item.status === "CANCELLED") data.cancelled += 1;
    }
    return data;
  }, [items]);

  return (
    <section className="space-y-6">
      <SectionTitle
        description="Seguimiento de estado y control de cobros por pedido."
        icon={ClipboardList}
        title="Pedidos"
      />

      <div className="flex flex-wrap gap-2">
        <Pill>Total: {counts.total}</Pill>
        <Pill tone="warning">Pendientes: {counts.pending}</Pill>
        <Pill tone="success">Confirmados: {counts.confirmed}</Pill>
        <Pill tone="info">Entregados: {counts.delivered}</Pill>
        {counts.cancelled ? <Pill tone="danger">Cancelados: {counts.cancelled}</Pill> : null}
      </div>

      <Disclosure
        description="Buscá por código, nombre o teléfono y acotá por fecha, estado o modalidad."
        title="Filtros de pedidos"
        variant="dashed"
      >
        <div className="grid gap-3 md:grid-cols-[1.45fr_1fr_1fr_1fr_1fr_auto] md:items-end">
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
            Estado
            <SelectField
              onChange={(value) => setStatusFilter(value as "ALL" | OrderStatus)}
              value={statusFilter}
            >
              <option value="ALL">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status]}
                </option>
              ))}
            </SelectField>
          </label>

          <label className={fieldLabelClassName}>
            Modo
            <SelectField
              onChange={(value) => setModeFilter(value as "ALL" | "pickup" | "delivery")}
              value={modeFilter}
            >
              <option value="ALL">Todos</option>
              <option value="pickup">Retiro</option>
              <option value="delivery">Envío</option>
            </SelectField>
          </label>

          <label className={fieldLabelClassName}>
            Desde
            <input
              className={inputClassName}
              onChange={(event) => setFromDate(event.target.value)}
              type="date"
              value={fromDate}
            />
          </label>

          <label className={fieldLabelClassName}>
            Hasta
            <input
              className={inputClassName}
              onChange={(event) => setToDate(event.target.value)}
              type="date"
              value={toDate}
            />
          </label>

          <div className={controlRowClassName}>
            <button className={`${buttonSoftClassName} w-full`} onClick={() => void load()} type="button">
              Aplicar
            </button>
          </div>
        </div>
      </Disclosure>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600">Cargando pedidos...</p>
      ) : (
        <>
          <div className="divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3 md:hidden">
            {items.map((item) => (
              <article className="py-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--chocolate-deep)]">
                      {item.customer.name}
                    </p>
                    <p className="text-xs text-zinc-500">{item.customer.phone}</p>
                  </div>
                  <OrderStatusSelect
                    item={item}
                    onChange={(id, status) => {
                      void patchStatus(id, status);
                    }}
                  />
                </div>

                <div className="mt-3 text-sm text-zinc-700">
                  <p className="inline-flex items-center gap-2">
                    <FulfillmentModeChip mode={item.fulfillmentMode} />
                    <span className="text-zinc-400">•</span>
                    <span>{formatDate(item.deliveryDate)}</span>
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-sm font-medium text-zinc-800">
                    {formatMoney(item.amountPaidArs)} de {formatMoney(item.subtotalArs)} cobrados
                  </p>
                </div>

                <div className="mt-2 flex justify-end">
                  <a
                    className="inline-flex items-center gap-1.5 text-sm text-[color:var(--accent)] underline underline-offset-2"
                    href={`/comprobante/${item.publicReceiptCode}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{item.publicReceiptCode}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className={tableShellClassName}>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--line)] text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Modo</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Pagado</th>
                  <th className="px-3 py-3">Saldo</th>
                  <th className="px-3 py-3">Comprobante</th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="border-b border-[#e2ddd9] transition" key={item.id}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-zinc-900">{item.customer.name}</p>
                      <p className="text-xs text-zinc-500">{item.customer.phone}</p>
                    </td>
                    <td className="px-3 py-3 align-top">{formatDate(item.deliveryDate)}</td>
                    <td className="px-3 py-3 align-top">
                      <FulfillmentModeChip mode={item.fulfillmentMode} />
                    </td>
                    <td className="px-3 py-3 align-top">{formatMoney(item.subtotalArs)}</td>
                    <td className="px-3 py-3 align-top">{formatMoney(item.amountPaidArs)}</td>
                    <td className="px-3 py-3 align-top">{formatMoney(item.amountBalanceArs)}</td>
                    <td className="px-3 py-3 align-top">
                      <a
                        className="inline-flex items-center gap-1.5 text-[color:var(--accent)] underline underline-offset-2"
                        href={`/comprobante/${item.publicReceiptCode}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{item.publicReceiptCode}</span>
                      </a>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <OrderStatusSelect
                        item={item}
                        onChange={(id, status) => {
                          void patchStatus(id, status);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {updatingId ? (
        <p className="text-xs text-zinc-500">Actualizando pedido {updatingId.slice(-6)}...</p>
      ) : null}
    </section>
  );
}
