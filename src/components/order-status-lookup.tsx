"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  Phone,
  ReceiptText,
  Search,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";

type LookupMode = "code" | "recovery";

type PublicOrderStatus = {
  code: string;
  status: string;
  statusLabel: string;
  statusTone: "pending" | "confirmed" | "delivered" | "cancelled";
  statusDetail: string;
  receiptHref: string;
  deliveryDate: string;
  fulfillmentMode: string;
  subtotalArs: number;
  amountPaidArs: number;
  amountBalanceArs: number;
  items: Array<{
    flavor: string;
    size: string;
    quantity: number;
    unitPriceArs: number;
    subtotalArs: number;
  }>;
  payments: Array<{
    id: string;
    statusLabel: string;
    methodLabel: string;
    amountArs: number;
    paidAt: string | null;
    createdAt: string;
  }>;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const toneClassName: Record<PublicOrderStatus["statusTone"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-sky-200 bg-sky-50 text-sky-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusIcon: Record<PublicOrderStatus["statusTone"], LucideIcon> = {
  pending: Clock3,
  confirmed: CheckCircle2,
  delivered: Package,
  cancelled: XCircle,
};

async function lookupOrder(payload: Record<string, string>) {
  const response = await fetch("/api/public/order-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as {
    order?: PublicOrderStatus;
    error?: string;
  };

  if (!response.ok || !data.order) {
    throw new Error(data.error ?? "No se pudo consultar el pedido.");
  }

  return data.order;
}

export function OrderStatusLookup() {
  const [mode, setMode] = useState<LookupMode>("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result =
        mode === "code"
          ? await lookupOrder({ mode, code })
          : await lookupOrder({ mode, name, phone, deliveryDate });

      setOrder(result);
    } catch (caughtError) {
      setOrder(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo consultar el pedido.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
      <section
        aria-labelledby="lookup-title"
        className="rounded-[28px] border border-white/70 bg-[var(--milk)] p-5 text-[var(--chocolate)] image-shadow sm:p-7 lg:p-8"
      >
        <div>
          <h2
            className="font-display text-4xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] sm:text-5xl"
            id="lookup-title"
          >
            Buscar pedido
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[var(--cream)] p-1">
          <button
            className={`h-10 rounded-full text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition sm:text-xs ${
              mode === "code"
                ? "bg-[var(--milk)] text-[var(--chocolate-deep)] shadow-[0_8px_18px_rgba(43,26,24,0.08)]"
                : "text-[var(--chocolate)]/62 hover:text-[var(--chocolate)]"
            }`}
            onClick={() => {
              setMode("code");
              setError(null);
            }}
            type="button"
          >
            Código
          </button>
          <button
            className={`h-10 rounded-full text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition sm:text-xs ${
              mode === "recovery"
                ? "bg-[var(--milk)] text-[var(--chocolate-deep)] shadow-[0_8px_18px_rgba(43,26,24,0.08)]"
                : "text-[var(--chocolate)]/62 hover:text-[var(--chocolate)]"
            }`}
            onClick={() => {
              setMode("recovery");
              setError(null);
            }}
            type="button"
          >
            Sin código
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "code" ? (
            <label className="block">
              <input
                aria-label="Código o comprobante"
                autoComplete="off"
                className="h-12 w-full rounded-[1.1rem] bg-[var(--cream)] px-4 text-base outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.2),0_8px_18px_rgba(43,26,24,0.08)]"
                onChange={(event) => setCode(event.target.value)}
                placeholder="Pegá el código de tu comprobante"
                required
                value={code}
              />
            </label>
          ) : (
            <div className="grid gap-4">
              <label className="block">
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--sage)]">
                  <UserRound className="h-3.5 w-3.5" />
                  Nombre
                </span>
                <input
                  autoComplete="name"
                  className="mt-2 h-12 w-full rounded-[1.1rem] bg-[var(--cream)] px-4 text-base outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.2),0_8px_18px_rgba(43,26,24,0.08)]"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como lo cargaste en el pedido"
                  required
                  value={name}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--sage)]">
                    <Phone className="h-3.5 w-3.5" />
                    Teléfono
                  </span>
                  <input
                    autoComplete="tel"
                    className="mt-2 h-12 w-full rounded-[1.1rem] bg-[var(--cream)] px-4 text-base outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.2),0_8px_18px_rgba(43,26,24,0.08)]"
                    inputMode="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+54 11..."
                    required
                    value={phone}
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--sage)]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Entrega
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[1.1rem] bg-[var(--cream)] px-4 text-base outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.2),0_8px_18px_rgba(43,26,24,0.08)]"
                    onChange={(event) => setDeliveryDate(event.target.value)}
                    required
                    type="date"
                    value={deliveryDate}
                  />
                </label>
              </div>
            </div>
          )}

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            className="motion-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--chocolate)]/45"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Consultar estado
          </button>
        </form>
      </section>

      <section
        aria-live="polite"
        className="min-h-[31rem] rounded-[28px] border border-white/70 bg-[var(--milk)] p-5 text-[var(--chocolate)] image-shadow sm:p-7 lg:p-8"
      >
        {order ? <OrderStatusResult order={order} /> : <EmptyResult />}
      </section>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="flex h-full min-h-[27rem] flex-col justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--sage)]">
          Estado del pedido
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] sm:text-5xl">
          Todo en un solo lugar
        </h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-[var(--chocolate)]/68 sm:text-base">
          Cuando encontremos tu pedido vas a ver el estado, el pago registrado,
          el detalle y el comprobante.
        </p>
      </div>
      <div className="mt-8 grid gap-3 border-t border-[var(--line)] pt-5 sm:grid-cols-3">
        {[
          ["Código", "Consulta directa"],
          ["Datos", "Nombre, teléfono y fecha"],
          ["Comprobante", "Disponible si el pedido existe"],
        ].map(([title, description]) => (
          <div key={title}>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--sage)]">
              {title}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/66">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderStatusResult({ order }: { order: PublicOrderStatus }) {
  const StatusIcon = statusIcon[order.statusTone];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--sage)]">
            Pedido {order.code}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-none tracking-[-0.04em] text-[var(--chocolate-deep)] sm:text-5xl">
            {order.statusLabel}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--chocolate)]/72">
            {order.statusDetail}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${toneClassName[order.statusTone]}`}
        >
          <StatusIcon className="h-4 w-4" />
          {order.statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        <StatusMeta
          label="Entrega"
          value={formatDate(order.deliveryDate)}
        />
        <StatusMeta
          label="Modalidad"
          value={order.fulfillmentMode}
        />
        <StatusMeta
          label="Pagado"
          value={formatMoney(order.amountPaidArs)}
        />
      </div>

      <div className="border-t border-[var(--line)] pt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--sage)]">
          Detalle
        </p>
        <ul className="mt-4 space-y-3">
          {order.items.map((item, index) => (
            <li
              className="flex items-start justify-between gap-4 border-b border-[rgba(64,58,55,0.1)] pb-3 last:border-b-0 last:pb-0"
              key={`${item.flavor}-${item.size}-${index}`}
            >
              <div>
                <p className="font-medium text-[var(--chocolate-deep)]">
                  {item.quantity} x {item.flavor}
                </p>
                <p className="mt-1 text-sm text-[var(--chocolate)]/62">
                  {item.size} · {formatMoney(item.unitPriceArs)} c/u
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm text-[var(--chocolate)]">
                {formatMoney(item.subtotalArs)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2 text-sm text-[var(--chocolate)]/72">
          <p className="flex items-center justify-between gap-4">
            <span>Total</span>
            <strong className="font-mono text-[var(--chocolate-deep)]">
              {formatMoney(order.subtotalArs)}
            </strong>
          </p>
          <p className="flex items-center justify-between gap-4">
            <span>Saldo pendiente</span>
            <strong className="font-mono text-[var(--chocolate-deep)]">
              {formatMoney(order.amountBalanceArs)}
            </strong>
          </p>
          {order.payments[0] ? (
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--sage)]">
              {order.payments[0].methodLabel} · {order.payments[0].statusLabel}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Link
            className="motion-button inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)]"
            href={order.receiptHref}
          >
            Ver comprobante
            <ReceiptText className="h-4 w-4" />
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--chocolate)] transition hover:border-[var(--chocolate)]"
            href="/pedido"
          >
            Armar otro
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.64rem] uppercase tracking-[0.14em] text-[var(--sage)] sm:text-xs">
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium leading-5 text-[var(--chocolate-deep)] sm:text-base">
        {value}
      </p>
    </div>
  );
}
