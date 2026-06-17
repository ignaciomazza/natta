"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
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

type Supplier = {
  id: string;
  name: string;
};

type PurchaseStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED";
type PaymentMethod = "MERCADO_PAGO" | "TRANSFER" | "CASH" | "MANUAL";

type Purchase = {
  id: string;
  description: string;
  amountArs: number;
  purchasedAt: string;
  status: PurchaseStatus;
  paymentMethod: PaymentMethod;
  supplier: Supplier | null;
};

const paymentMethods: PaymentMethod[] = ["MANUAL", "TRANSFER", "CASH", "MERCADO_PAGO"];

const methodLabel: Record<PaymentMethod, string> = {
  MANUAL: "Manual",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
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

export function PurchasesAdmin() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [amountArs, setAmountArs] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MANUAL");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [purchasesRes, suppliersRes] = await Promise.all([
      fetch("/api/purchases", { cache: "no-store" }),
      fetch("/api/suppliers", { cache: "no-store" }),
    ]);

    if (!purchasesRes.ok || !suppliersRes.ok) {
      throw new Error("No se pudieron cargar compras/proveedores");
    }

    const purchasesPayload = (await purchasesRes.json()) as { items: Purchase[] };
    const suppliersPayload = (await suppliersRes.json()) as { items: Supplier[] };
    setItems(purchasesPayload.items);
    setSuppliers(suppliersPayload.items);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Error");
    });
  }, []);

  const totals = useMemo(() => {
    let amount = 0;
    for (const item of items) {
      amount += item.amountArs;
    }
    return { amount };
  }, [items]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (amountArs < 1) {
      setError("Ingresá un monto válido");
      return;
    }

    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: supplierId || undefined,
        description,
        amountArs,
        paymentMethod,
        status: "APPROVED",
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo crear compra");
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
        icon={PackageSearch}
        title="Compras"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>Total: {items.length}</Pill>
        <Pill tone="info">Monto total: {formatMoney(totals.amount)}</Pill>
      </div>

      <Disclosure
        title="Nueva compra"
        variant="dashed"
      >
        <form className="grid gap-3 md:grid-cols-2 md:items-end" onSubmit={onSubmit}>
          <label className={fieldLabelClassName}>
            Proveedor
            <SelectField onChange={setSupplierId} value={supplierId}>
              <SelectOption value="">Sin proveedor</SelectOption>
              {suppliers.map((supplier) => (
                <SelectOption key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectOption>
              ))}
            </SelectField>
          </label>
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

          <button className={`${buttonSoftClassName} md:col-span-2`} type="submit">
            Registrar compra
          </button>
        </form>
      </Disclosure>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <article
              className={`${listCardClassName} md:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.85fr)_auto] md:items-center`}
              key={item.id}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Fecha</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--chocolate-deep)]">
                  {formatDate(item.purchasedAt)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Proveedor</p>
                <p className="mt-1 truncate text-sm text-zinc-700">
                  {item.supplier?.name || "Sin proveedor"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Descripción</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--chocolate-deep)]">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center">
                <Pill mini tone="info">
                  {methodLabel[item.paymentMethod]}
                </Pill>
              </div>
              <p className="text-lg font-semibold text-zinc-950 md:text-right">
                {formatMoney(item.amountArs)}
              </p>
            </article>
          ))
        ) : (
          <p className={emptyStateClassName}>No hay compras para mostrar.</p>
        )}
      </div>
    </section>
  );
}
