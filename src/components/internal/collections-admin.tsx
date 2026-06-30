"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { MoneyInput } from "@/components/internal/money-input";
import {
  Disclosure,
  Pill,
  SectionTitle,
  Toggle,
  buttonSoftClassName,
  controlRowClassName,
  emptyStateClassName,
  fieldLabelClassName,
  inputClassName,
  listCardClassName,
} from "@/components/internal/ui";
import { SelectField, SelectOption } from "@/components/internal/select-field";

type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED";
type PaymentMethod = "MERCADO_PAGO" | "TRANSFER" | "CASH" | "MANUAL";
type PaymentKind = "DEPOSIT" | "BALANCE" | "FULL";

type Payment = {
  id: string;
  orderId: string | null;
  amountArs: number;
  status: PaymentStatus;
  method: PaymentMethod;
  kind: PaymentKind;
  customerName: string | null;
  customerPhone: string | null;
  referenceNote: string | null;
  externalReference: string | null;
  providerPreferenceId: string | null;
  providerPaymentId: string | null;
  statusDetail: string | null;
  createdAt: string;
  order: {
    id: string;
    publicReceiptCode: string;
    status: string;
  } | null;
};

const statusOptions: PaymentStatus[] = [
  "APPROVED",
  "PENDING",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
];
const methodOptions: PaymentMethod[] = ["MANUAL", "TRANSFER", "CASH", "MERCADO_PAGO"];
const kindOptions: PaymentKind[] = ["FULL", "DEPOSIT", "BALANCE"];

const statusLabel: Record<PaymentStatus, string> = {
  APPROVED: "Aprobado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reintegrado",
};

const methodLabel: Record<PaymentMethod, string> = {
  MANUAL: "Manual",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
};

const kindLabel: Record<PaymentKind, string> = {
  FULL: "Total",
  DEPOSIT: "Seña",
  BALANCE: "Saldo",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function statusTone(status: PaymentStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "REJECTED" || status === "CANCELLED") return "danger" as const;
  return "info" as const;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatReference(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-7)}` : value;
}

function getMercadoPagoReference(item: Payment) {
  if (item.providerPaymentId) return `Operación MP ${item.providerPaymentId}`;
  if (item.providerPreferenceId) {
    return `Preferencia ${formatReference(item.providerPreferenceId)}`;
  }
  if (item.externalReference) {
    return `Referencia ${formatReference(item.externalReference)}`;
  }
  return "Sin identificador MP";
}

function shouldShowMercadoPagoReview(item: Payment) {
  return Boolean(
    item.method === "MERCADO_PAGO" &&
      (item.providerPaymentId || item.externalReference) &&
      (item.status !== "APPROVED" || !item.providerPaymentId),
  );
}

export function CollectionsAdmin() {
  const [items, setItems] = useState<Payment[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountArs, setAmountArs] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("MANUAL");
  const [kind, setKind] = useState<PaymentKind>("FULL");
  const [status, setStatus] = useState<PaymentStatus>("APPROVED");
  const [onlyWithOrder, setOnlyWithOrder] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/collections", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar cobros");
    const payload = (await response.json()) as { items: Payment[] };
    setItems(payload.items);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Error");
    });
  }, []);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (onlyWithOrder && !item.order) return false;
      return true;
    });
  }, [items, onlyWithOrder, statusFilter]);

  const totals = useMemo(() => {
    let amount = 0;
    let approved = 0;
    for (const item of items) {
      amount += item.amountArs;
      if (item.status === "APPROVED") approved += 1;
    }
    return { amount, approved };
  }, [items]);

  const createManualCollection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (amountArs < 1) {
      setError("Ingresá un monto válido");
      return;
    }

    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerPhone,
        amountArs,
        status,
        method,
        kind,
        referenceNote,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo crear cobro");
      return;
    }

    setCustomerName("");
    setCustomerPhone("");
    setAmountArs(0);
    setAmountInput("");
    setReferenceNote("");
    await load();
  };

  const syncMercadoPagoPayment = async (item: Payment) => {
    if (!item.providerPaymentId && !item.externalReference) {
      setError("No hay identificador de Mercado Pago para revisar");
      return;
    }

    setSyncingId(item.id);
    setError(null);
    try {
      const response = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: item.orderId ?? undefined,
          providerPaymentId: item.providerPaymentId ?? undefined,
          externalReference: item.externalReference ?? undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; found?: number }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo revisar Mercado Pago");
      }

      if (payload?.found === 0) {
        setError("Mercado Pago no encontró pagos para esa referencia");
      }

      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Error");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <SectionTitle
        icon={Coins}
        title="Cobros"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>Total: {items.length}</Pill>
        <Pill tone="success">Aprobados: {totals.approved}</Pill>
        <Pill tone="info">Monto total: {formatMoney(totals.amount)}</Pill>
      </div>

      <Disclosure
        title="Filtros de cobros"
        variant="dashed"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className={`${fieldLabelClassName} w-full sm:w-52`}>
            Estado
            <SelectField
              onChange={(value) => setStatusFilter(value as "ALL" | PaymentStatus)}
              value={statusFilter}
            >
              <SelectOption value="ALL">Todos los estados</SelectOption>
              {statusOptions.map((option) => (
                <SelectOption key={option} value={option}>
                  {statusLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>
          <div className={controlRowClassName}>
            <Toggle
              checked={onlyWithOrder}
              label="Solo con pedido"
              mini
              onChange={setOnlyWithOrder}
            />
          </div>
        </div>
      </Disclosure>

      <Disclosure
        title="Registrar cobro manual"
        variant="dashed"
      >
        <form className="grid gap-3 md:grid-cols-2 md:items-end" onSubmit={createManualCollection}>
          <label className={fieldLabelClassName}>
            Cliente
            <input
              className={inputClassName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Cliente"
              required
              value={customerName}
            />
          </label>
          <label className={fieldLabelClassName}>
            Teléfono
            <input
              className={inputClassName}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="Teléfono"
              required
              value={customerPhone}
            />
          </label>
          <label className={fieldLabelClassName}>
            Monto (ARS)
            <MoneyInput
              onChange={(next) => {
                setAmountArs(next.amount);
                setAmountInput(next.display);
              }}
              placeholder="Monto ARS"
              required
              value={amountInput}
            />
          </label>
          <label className={fieldLabelClassName}>
            Nota de referencia
            <input
              className={inputClassName}
              onChange={(event) => setReferenceNote(event.target.value)}
              placeholder="Nota de referencia"
              value={referenceNote}
            />
          </label>
          <label className={fieldLabelClassName}>
            Tipo
            <SelectField onChange={(value) => setKind(value as PaymentKind)} value={kind}>
              {kindOptions.map((option) => (
                <SelectOption key={option} value={option}>
                  {kindLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>
          <label className={fieldLabelClassName}>
            Método
            <SelectField onChange={(value) => setMethod(value as PaymentMethod)} value={method}>
              {methodOptions.map((option) => (
                <SelectOption key={option} value={option}>
                  {methodLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>
          <label className={`${fieldLabelClassName} md:col-span-2`}>
            Estado inicial
            <SelectField onChange={(value) => setStatus(value as PaymentStatus)} value={status}>
              {statusOptions.map((option) => (
                <SelectOption key={option} value={option}>
                  {statusLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>

          <button className={`${buttonSoftClassName} md:col-span-2`} type="submit">
            Registrar cobro
          </button>
        </form>
      </Disclosure>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <article
              className={`${listCardClassName} md:grid-cols-[minmax(8rem,0.85fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center`}
              key={item.id}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Fecha</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--chocolate-deep)]">
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--chocolate-deep)]">
                  {item.customerName || "Cobro manual"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.customerPhone || "Sin teléfono"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pedido</p>
                {item.order ? (
                  <a
                    className="mt-1 inline-flex text-sm text-zinc-700 underline underline-offset-2"
                    href={`/comprobante/${item.order.publicReceiptCode}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.order.publicReceiptCode}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">Sin pedido</p>
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Pill mini>{kindLabel[item.kind]}</Pill>
                  <Pill mini tone="info">
                    {methodLabel[item.method]}
                  </Pill>
                  <Pill mini tone={statusTone(item.status)}>
                    {statusLabel[item.status]}
                  </Pill>
                </div>
                {item.referenceNote ? (
                  <p className="rounded-xl bg-[color:var(--surface-soft)]/75 px-2.5 py-2 text-xs text-zinc-600 shadow-[0_10px_24px_-22px_rgba(38,35,33,0.52)]">
                    {item.referenceNote}
                  </p>
                ) : null}
                {item.method === "MERCADO_PAGO" ? (
                  <div className="rounded-xl bg-white/70 px-2.5 py-2 text-xs text-zinc-600 shadow-[0_10px_24px_-22px_rgba(38,35,33,0.42)]">
                    <p className="truncate" title={getMercadoPagoReference(item)}>
                      {getMercadoPagoReference(item)}
                    </p>
                    {item.statusDetail ? (
                      <p className="mt-1 line-clamp-2 leading-4 text-zinc-500">
                        {item.statusDetail}
                      </p>
                    ) : null}
                    {item.externalReference && !item.providerPaymentId ? (
                      <p className="mt-1 leading-4 text-zinc-500">
                        Esta referencia no confirma un cobro.
                      </p>
                    ) : null}
                    {shouldShowMercadoPagoReview(item) ? (
                      <button
                        className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[color:var(--line)] bg-white px-3 text-[11px] font-semibold text-zinc-700 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={syncingId === item.id}
                        onClick={() => void syncMercadoPagoPayment(item)}
                        title="Consulta Mercado Pago y actualiza el estado si encuentra un pago aprobado. No confirma pagos manualmente."
                        type="button"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${syncingId === item.id ? "animate-spin" : ""}`}
                        />
                        {syncingId === item.id ? "Revisando" : "Revisar pago"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="text-lg font-semibold text-zinc-950 md:text-right">
                {formatMoney(item.amountArs)}
              </p>
            </article>
          ))
        ) : (
          <p className={emptyStateClassName}>No hay cobros para mostrar.</p>
        )}
      </div>
    </section>
  );
}
