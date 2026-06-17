"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { MoneyInput } from "@/components/internal/money-input";
import {
  Disclosure,
  Pill,
  SectionTitle,
  buttonSoftClassName,
  emptyStateClassName,
  fieldLabelClassName,
  inputClassName,
  listCardClassName,
} from "@/components/internal/ui";
import { SelectField, SelectOption } from "@/components/internal/select-field";

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED";
type ExpenseCategory = "INGREDIENTS" | "OPERATIONS" | "MARKETING" | "LOGISTICS" | "OTHER";
type PaymentMethod = "MERCADO_PAGO" | "TRANSFER" | "CASH" | "MANUAL";

type Expense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountArs: number;
  occurredAt: string;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
};

const categories: ExpenseCategory[] = [
  "INGREDIENTS",
  "OPERATIONS",
  "MARKETING",
  "LOGISTICS",
  "OTHER",
];

const paymentMethods: PaymentMethod[] = ["MANUAL", "TRANSFER", "CASH", "MERCADO_PAGO"];
const statuses: ExpenseStatus[] = ["APPROVED", "PENDING", "REJECTED", "CANCELLED", "REFUNDED"];

const categoryLabel: Record<ExpenseCategory, string> = {
  INGREDIENTS: "Ingredientes",
  OPERATIONS: "Operación",
  MARKETING: "Marketing",
  LOGISTICS: "Logística",
  OTHER: "Otros",
};

const methodLabel: Record<PaymentMethod, string> = {
  MANUAL: "Manual",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
};

const statusLabel: Record<ExpenseStatus, string> = {
  APPROVED: "Aprobado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reintegrado",
};

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

function statusTone(status: ExpenseStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "REJECTED" || status === "CANCELLED") return "danger" as const;
  return "info" as const;
}

export function ExpensesAdmin() {
  const [items, setItems] = useState<Expense[]>([]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [amountArs, setAmountArs] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MANUAL");
  const [status, setStatus] = useState<ExpenseStatus>("APPROVED");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ExpenseCategory>("ALL");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/expenses", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar gastos");
    const payload = (await response.json()) as { items: Expense[] };
    setItems(payload.items);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Error");
    });
  }, []);

  const visibleItems = useMemo(() => {
    if (categoryFilter === "ALL") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, items]);

  const totals = useMemo(() => {
    let amount = 0;
    let approved = 0;
    for (const item of items) {
      amount += item.amountArs;
      if (item.status === "APPROVED") approved += 1;
    }
    return { amount, approved };
  }, [items]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (amountArs < 1) {
      setError("Ingresá un monto válido");
      return;
    }

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        category,
        amountArs,
        paymentMethod,
        status,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo crear gasto");
      return;
    }

    setDescription("");
    setAmountArs(0);
    setAmountInput("");
    await load();
  };

  return (
    <section className="space-y-5">
      <SectionTitle
        icon={Receipt}
        title="Gastos"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>Total: {items.length}</Pill>
        <Pill tone="success">Aprobados: {totals.approved}</Pill>
        <Pill tone="info">Monto total: {formatMoney(totals.amount)}</Pill>
      </div>

      <Disclosure
        title="Filtros de gastos"
        variant="dashed"
      >
        <label className={`${fieldLabelClassName} block w-full sm:w-56`}>
          Categoría
          <SelectField
            onChange={(value) => setCategoryFilter(value as "ALL" | ExpenseCategory)}
            value={categoryFilter}
          >
            <SelectOption value="ALL">Todas</SelectOption>
            {categories.map((option) => (
              <SelectOption key={option} value={option}>
                {categoryLabel[option]}
              </SelectOption>
            ))}
          </SelectField>
        </label>
      </Disclosure>

      <Disclosure title="Nuevo gasto" variant="dashed">
        <form className="grid gap-3 md:grid-cols-2 md:items-end" onSubmit={onSubmit}>
          <label className={fieldLabelClassName}>
            Descripción
            <input
              className={inputClassName}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción"
              required
              value={description}
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
            Categoría
            <SelectField
              onChange={(value) => setCategory(value as ExpenseCategory)}
              value={category}
            >
              {categories.map((option) => (
                <SelectOption key={option} value={option}>
                  {categoryLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>
          <label className={fieldLabelClassName}>
            Método
            <SelectField
              onChange={(value) => setPaymentMethod(value as PaymentMethod)}
              value={paymentMethod}
            >
              {paymentMethods.map((option) => (
                <SelectOption key={option} value={option}>
                  {methodLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>
          <label className={`${fieldLabelClassName} md:col-span-2`}>
            Estado
            <SelectField onChange={(value) => setStatus(value as ExpenseStatus)} value={status}>
              {statuses.map((option) => (
                <SelectOption key={option} value={option}>
                  {statusLabel[option]}
                </SelectOption>
              ))}
            </SelectField>
          </label>

          <button className={`${buttonSoftClassName} md:col-span-2`} type="submit">
            Registrar gasto
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
              className={`${listCardClassName} md:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.45fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_auto] md:items-center`}
              key={item.id}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Fecha</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--chocolate-deep)]">
                  {formatDate(item.occurredAt)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Descripción</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--chocolate-deep)]">
                  {item.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill mini>{categoryLabel[item.category]}</Pill>
                <Pill mini tone="info">
                  {methodLabel[item.paymentMethod]}
                </Pill>
              </div>
              <div className="flex items-center">
                <Pill mini tone={statusTone(item.status)}>
                  {statusLabel[item.status]}
                </Pill>
              </div>
              <p className="text-lg font-semibold text-zinc-950 md:text-right">
                {formatMoney(item.amountArs)}
              </p>
            </article>
          ))
        ) : (
          <p className={emptyStateClassName}>No hay gastos para mostrar.</p>
        )}
      </div>
    </section>
  );
}
