"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
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
        description="Registro operativo-financiero de compras."
        icon={PackageSearch}
        title="Compras"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill>Total: {items.length}</Pill>
        <Pill tone="info">Monto total: {formatMoney(totals.amount)}</Pill>
      </div>

      <Disclosure
        description="Carga una compra rápida con proveedor, método y monto."
        title="Nueva compra"
        variant="dashed"
      >
        <form className="grid gap-3 md:grid-cols-2 md:items-end" onSubmit={onSubmit}>
          <label className={fieldLabelClassName}>
            Proveedor
            <SelectField onChange={setSupplierId} value={supplierId}>
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
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
                <option key={option} value={option}>
                  {methodLabel[option]}
                </option>
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

      <div className="divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3 md:hidden">
        {items.map((item) => (
          <article className="py-3" key={item.id}>
            <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
              {item.description}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{formatDate(item.purchasedAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-700">
              <Pill mini>{item.supplier?.name || "Sin proveedor"}</Pill>
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
              <th className="px-3 py-3">Proveedor</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3">Método</th>
              <th className="px-3 py-3">Monto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-b border-[#e2ddd9] transition" key={item.id}>
                <td className="px-3 py-3">{formatDate(item.purchasedAt)}</td>
                <td className="px-3 py-3">{item.supplier?.name || "-"}</td>
                <td className="px-3 py-3">{item.description}</td>
                <td className="px-3 py-3">
                  <Pill mini tone="info">
                    {methodLabel[item.paymentMethod]}
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
