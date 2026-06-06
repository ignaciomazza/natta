"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { MoneyInput } from "@/components/internal/money-input";
import {
  Disclosure,
  Pill,
  SectionTitle,
  SelectField,
  buttonSoftClassName,
  fieldLabelClassName,
  inputClassName,
  tableShellClassName,
} from "@/components/internal/ui";

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
        description="Seguimiento simple de egresos operativos."
        icon={Receipt}
        title="Gastos"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>Total: {items.length}</Pill>
        <Pill tone="success">Aprobados: {totals.approved}</Pill>
        <Pill tone="info">Monto total: {formatMoney(totals.amount)}</Pill>
      </div>

      <Disclosure
        description="Filtrá por categoría para enfocar la vista diaria."
        title="Filtros de gastos"
        variant="dashed"
      >
        <label className={`${fieldLabelClassName} block w-full sm:w-56`}>
          Categoría
          <SelectField
            onChange={(value) => setCategoryFilter(value as "ALL" | ExpenseCategory)}
            value={categoryFilter}
          >
            <option value="ALL">Todas</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {categoryLabel[option]}
              </option>
            ))}
          </SelectField>
        </label>
      </Disclosure>

      <Disclosure description="Cargá un gasto con categoría y estado." title="Nuevo gasto" variant="dashed">
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
                <option key={option} value={option}>
                  {categoryLabel[option]}
                </option>
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
                <option key={option} value={option}>
                  {methodLabel[option]}
                </option>
              ))}
            </SelectField>
          </label>
          <label className={`${fieldLabelClassName} md:col-span-2`}>
            Estado
            <SelectField onChange={(value) => setStatus(value as ExpenseStatus)} value={status}>
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {statusLabel[option]}
                </option>
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

      <div className="divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3 md:hidden">
        {visibleItems.map((item) => (
          <article className="py-3" key={item.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                {item.description}
              </p>
              <Pill mini tone={statusTone(item.status)}>
                {statusLabel[item.status]}
              </Pill>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{formatDate(item.occurredAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-700">
              <Pill mini>{categoryLabel[item.category]}</Pill>
              <Pill mini tone="info">
                {methodLabel[item.paymentMethod]}
              </Pill>
            </div>
            <p className="mt-3 font-medium text-zinc-900">{formatMoney(item.amountArs)}</p>
          </article>
        ))}
      </div>

      <div className={tableShellClassName}>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Método</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Monto</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr className="border-b border-[#e2ddd9] transition" key={item.id}>
                <td className="px-3 py-3">{formatDate(item.occurredAt)}</td>
                <td className="px-3 py-3">{item.description}</td>
                <td className="px-3 py-3">
                  <Pill mini>{categoryLabel[item.category]}</Pill>
                </td>
                <td className="px-3 py-3">
                  <Pill mini tone="info">
                    {methodLabel[item.paymentMethod]}
                  </Pill>
                </td>
                <td className="px-3 py-3">
                  <Pill mini tone={statusTone(item.status)}>
                    {statusLabel[item.status]}
                  </Pill>
                </td>
                <td className="px-3 py-3 font-medium text-zinc-900">
                  {formatMoney(item.amountArs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
