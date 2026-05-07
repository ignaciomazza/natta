"use client";

import {
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  cakeSizes,
  flavors,
  formatCurrency,
  getMinOrderDate,
  isSunday,
  type FulfillmentMode,
  type SizeId,
} from "@/lib/catalog";

type StepIndex = 0 | 1 | 2 | 3;
type SizeQuantities = Record<SizeId, number>;
type OrderQuantities = Record<string, SizeQuantities>;

const steps = [
  { label: "Sabores" },
  { label: "Fecha" },
  { label: "Entrega" },
  { label: "Pago" },
] as const;

const emptyQuantities = () =>
  flavors.reduce<OrderQuantities>((accumulator, flavor) => {
    accumulator[flavor.id] = { latta: 0, chica: 0, grande: 0 };
    return accumulator;
  }, {});

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getFirstAvailableDate = () => {
  let cursor = new Date(`${getMinOrderDate()}T12:00:00`);

  while (isSunday(toDateValue(cursor))) {
    cursor = addDays(cursor, 1);
  }

  return toDateValue(cursor);
};

const formatReadableDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));

const paymentCopy: Record<FulfillmentMode, string> = {
  pickup: "Pagás la seña online. El resto queda para el retiro.",
  delivery: "Pagás el producto online. El envío se coordina aparte.",
};

export function OrderAssistant() {
  const [step, setStep] = useState<StepIndex>(0);
  const [quantities, setQuantities] = useState<OrderQuantities>(() =>
    emptyQuantities(),
  );
  const [date, setDate] = useState(getFirstAvailableDate);
  const [mode, setMode] = useState<FulfillmentMode>("pickup");
  const [customer, setCustomer] = useState({
    address: "",
    name: "",
    phone: "",
  });
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedItems = useMemo(
    () =>
      flavors.flatMap((flavor) =>
        cakeSizes
          .map((size) => {
            const quantity = quantities[flavor.id]?.[size.id] ?? 0;
            const unitPrice = flavor.prices[size.id];

            return {
              flavor,
              quantity,
              size,
              subtotal: unitPrice * quantity,
              unitPrice,
            };
          })
          .filter((item) => item.quantity > 0),
      ),
    [quantities],
  );

  const dayOptions = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const minimumDate = getMinOrderDate();

    return Array.from({ length: 14 }, (_, index) => {
      const optionDate = addDays(today, index);
      const value = toDateValue(optionDate);
      const closed = isSunday(value);
      const tooSoon = value < minimumDate;
      const available = !closed && !tooSoon;

      return {
        available,
        dayNumber: new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
        }).format(optionDate),
        month: new Intl.DateTimeFormat("es-AR", {
          month: "short",
        }).format(optionDate),
        status: closed ? "Cerrado" : tooSoon ? "Preparación" : "Disponible",
        value,
        weekday: new Intl.DateTimeFormat("es-AR", {
          weekday: "short",
        }).format(optionDate),
      };
    });
  }, []);

  const productCount = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const total = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const dueNow = mode === "pickup" ? Math.ceil(total / 2) : total;
  const balance = total - dueNow;
  const invalidDate = !date || isSunday(date);
  const hasContact = Boolean(customer.name.trim() && customer.phone.trim());
  const hasDeliveryAddress =
    mode !== "delivery" || Boolean(customer.address.trim());
  const canSubmit =
    productCount > 0 && !invalidDate && hasContact && hasDeliveryAddress;
  const canAdvance =
    step === 0
      ? productCount > 0
      : step === 1
        ? productCount > 0 && !invalidDate
        : step === 2
          ? productCount > 0 && !invalidDate
        : canSubmit;

  const canOpenStep = (targetStep: number) => {
    if (targetStep <= step) {
      return true;
    }

    if (targetStep === 1) {
      return productCount > 0;
    }

    if (targetStep === 2) {
      return step >= 1 && productCount > 0 && !invalidDate;
    }

    if (targetStep === 3) {
      return step >= 2 && productCount > 0 && !invalidDate;
    }

    if (targetStep > 3) {
      return false;
    }

    return step >= 1 && productCount > 0 && !invalidDate;
  };

  const updateQuantity = (flavorId: string, sizeId: SizeId, delta: number) => {
    setQuantities((current) => ({
      ...current,
      [flavorId]: {
        ...current[flavorId],
        [sizeId]: Math.max(0, Math.min(12, current[flavorId][sizeId] + delta)),
      },
    }));
  };

  const goToNextStep = () => {
    if (!canAdvance) {
      return;
    }

    setStep((current) => Math.min(current + 1, 3) as StepIndex);
  };

  const goToPreviousStep = () => {
    setStep((current) => Math.max(current - 1, 0) as StepIndex);
  };

  const updateCustomer = (field: keyof typeof customer, value: string) => {
    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < 3) {
      goToNextStep();
      return;
    }

    if (!canAdvance) {
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl rounded-[24px] border border-white/70 bg-[var(--milk)] p-5 text-[var(--chocolate)] image-shadow md:p-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sage-soft)] text-[var(--chocolate-deep)]">
          <Check className="h-5 w-5" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.22em] text-[var(--sage)] md:text-sm">
          Pedido preparado
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none tracking-[-0.03em] text-[var(--chocolate-deep)] md:text-7xl">
          Ya quedó listo para confirmar.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-[var(--chocolate)]/76 md:text-lg md:leading-8">
          El cobro queda dentro del flujo. Después Natta te manda la
          confirmación del pedido por mensaje, sin que tengas que consultar
          aparte.
        </p>
        <button
          className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] md:h-12 md:px-6 md:text-sm"
          onClick={() => {
            setSubmitted(false);
            setStep(0);
          }}
          type="button"
        >
          Armar otro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 max-w-[calc(100vw-2rem)] gap-6 lg:max-w-full lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
      <div className="hidden min-w-0 max-w-[calc(100vw-2rem)] space-y-4 md:block lg:sticky lg:top-24 lg:max-w-full lg:space-y-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:text-sm md:tracking-[0.24em]">
          <Clock className="h-4 w-4" />
          Pedido asistido
        </div>
        <div>
          <h2 className="max-w-full break-words font-display text-4xl leading-none tracking-[-0.03em] text-[var(--chocolate-deep)] md:text-7xl">
            Armá tu pedido.
          </h2>
          <p className="mt-3 max-w-xl break-words text-base leading-7 text-[var(--chocolate)]/78 md:mt-5 md:text-lg md:leading-8">
            Elegí sabores, fecha y modalidad. Natta te confirma por mensaje
            cuando el pedido queda tomado.
          </p>
        </div>

        <div className="hidden gap-3 text-sm text-[var(--chocolate)]/76 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          <div className="border-t border-[var(--line)] pt-4">
            <Check className="mb-3 h-5 w-5 text-[var(--sage)]" />
            Podés combinar sabores y tamaños en un mismo pedido.
          </div>
          <div className="border-t border-[var(--line)] pt-4">
            <Check className="mb-3 h-5 w-5 text-[var(--sage)]" />
            El calendario marca preparación, disponibilidad y domingos cerrados.
          </div>
        </div>
      </div>

      <form
        className="w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-white/70 bg-[var(--milk)] p-3 text-[var(--chocolate)] image-shadow sm:p-6 lg:max-w-full"
        data-testid="order-assistant"
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {steps.map((item, index) => (
            <button
              className={`rounded-xl border px-2 py-2 text-left transition sm:rounded-2xl sm:px-4 sm:py-3 ${
                step === index
                  ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                  : "border-[var(--line)] bg-white/55 text-[var(--chocolate)]/70 hover:border-[var(--caramel)] disabled:opacity-45 disabled:hover:border-[var(--line)]"
              }`}
              disabled={!canOpenStep(index)}
              key={item.label}
              onClick={() => setStep(index as StepIndex)}
              type="button"
            >
              <span className="block text-xs font-medium sm:text-base">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {step === 0 ? (
          <section className="mt-5 sm:mt-7">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <ShoppingBag className="h-4 w-4" />
                  Sabores y cantidad
                </p>
                <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                  Sumá unidades por sabor en Latta, Chica o Grande.
                </p>
              </div>
            </div>

            <div className="mt-3 divide-y divide-[var(--line)] sm:mt-5">
              {flavors.map((flavor) => (
                <article className="py-3 sm:py-5" key={flavor.id}>
                  <div className="grid gap-2 sm:gap-4 xl:grid-cols-[0.58fr_1.42fr]">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-display text-2xl leading-none text-[var(--chocolate-deep)] sm:text-3xl">
                        {flavor.name}
                      </h3>
                      <p className="text-xs leading-5 text-[var(--chocolate)]/70 sm:text-sm sm:leading-6">
                        {flavor.description}
                      </p>
                      {flavor.note ? (
                        <p className="basis-full text-xs text-[var(--sage)] sm:text-sm">
                          {flavor.note}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                      {cakeSizes.map((size) => {
                        const quantity = quantities[flavor.id][size.id];

                        return (
                          <div
                            className={`rounded-xl border p-1.5 transition sm:rounded-2xl sm:p-3 ${
                              quantity > 0
                                ? "border-[var(--chocolate)] bg-[var(--cream)]"
                                : "border-[var(--line)] bg-white/55"
                            }`}
                            key={size.id}
                          >
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                              <div>
                                <p className="text-xs font-medium sm:text-base">
                                  {size.label}
                                </p>
                                <p className="mt-1 hidden text-xs text-[var(--chocolate)]/62 sm:block">
                                  {size.detail}
                                </p>
                              </div>
                              <p className="font-mono text-[0.58rem] text-[var(--chocolate)]/72 sm:text-xs">
                                {formatCurrency(flavor.prices[size.id])}
                              </p>
                            </div>
                            <div className="mt-2 flex h-8 items-center justify-between rounded-full border border-[var(--line)] bg-[var(--milk)] px-1 sm:mt-3 sm:h-10 sm:px-2">
                              <button
                                aria-label={`Restar ${size.label} ${flavor.name}`}
                                className="grid h-6 w-6 place-items-center rounded-full transition hover:bg-[var(--sage-soft)] disabled:opacity-35 sm:h-8 sm:w-8"
                                disabled={quantity === 0}
                                onClick={() =>
                                  updateQuantity(flavor.id, size.id, -1)
                                }
                                type="button"
                              >
                                <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </button>
                              <span className="font-mono text-xs sm:text-sm">
                                {quantity}
                              </span>
                              <button
                                aria-label={`Sumar ${size.label} ${flavor.name}`}
                                className="grid h-6 w-6 place-items-center rounded-full transition hover:bg-[var(--sage-soft)] sm:h-8 sm:w-8"
                                onClick={() =>
                                  updateQuantity(flavor.id, size.id, 1)
                                }
                                type="button"
                              >
                                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="mt-5 space-y-5 sm:mt-7 sm:space-y-7">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                <CalendarDays className="h-4 w-4" />
                Disponibilidad
              </p>
              <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                Las primeras 48/72 h quedan como preparación. Los domingos no se
                toman pedidos ni retiros.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {dayOptions.map((day) => (
                <button
                  className={`rounded-xl border p-2 text-left transition sm:rounded-2xl sm:p-3 ${
                    date === day.value
                      ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                      : day.available
                        ? "border-[var(--line)] bg-white/60 hover:border-[var(--caramel)]"
                        : "border-[var(--line)] bg-[var(--cream)] text-[var(--chocolate)]/42"
                  }`}
                  disabled={!day.available}
                  key={day.value}
                  onClick={() => setDate(day.value)}
                  type="button"
                >
                  <span className="text-[0.58rem] uppercase tracking-[0.14em] opacity-70 sm:text-[0.68rem] sm:tracking-[0.16em]">
                    {day.weekday}
                  </span>
                  <span className="mt-1 block font-display text-2xl leading-none sm:mt-2 sm:text-4xl">
                    {day.dayNumber}
                  </span>
                  <span className="mt-0.5 block text-[0.58rem] uppercase tracking-[0.14em] opacity-70 sm:mt-1 sm:text-xs sm:tracking-[0.16em]">
                    {day.month}
                  </span>
                  <span className="mt-1.5 block text-[0.62rem] font-medium sm:mt-3 sm:text-xs">
                    {day.status}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="mt-5 space-y-5 sm:mt-7 sm:space-y-7">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                <Truck className="h-4 w-4" />
                Entrega
              </p>
              <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                Elegí si retirás por Devoto o si coordinamos envío por Uber /
                Cabify.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded-xl border p-3 text-left transition sm:rounded-2xl sm:p-4 ${
                  mode === "pickup"
                    ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                    : "border-[var(--line)] bg-white/55 hover:border-[var(--caramel)]"
                }`}
                data-testid="mode-pickup"
                onClick={() => setMode("pickup")}
                type="button"
              >
                <MapPin className="mb-2 h-4 w-4 sm:mb-3 sm:h-5 sm:w-5" />
                <span className="block font-semibold">Retiro Devoto</span>
                <span className="mt-1 block text-sm opacity-80">
                  Seña online del 50%
                </span>
              </button>
              <button
                className={`rounded-xl border p-3 text-left transition sm:rounded-2xl sm:p-4 ${
                  mode === "delivery"
                    ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                    : "border-[var(--line)] bg-white/55 hover:border-[var(--caramel)]"
                }`}
                data-testid="mode-delivery"
                onClick={() => setMode("delivery")}
                type="button"
              >
                <Truck className="mb-2 h-4 w-4 sm:mb-3 sm:h-5 sm:w-5" />
                <span className="block font-semibold">Uber / Cabify</span>
                <span className="mt-1 block text-sm opacity-80">
                  Pago online del producto
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mt-5 grid gap-5 sm:mt-7 sm:gap-7 xl:grid-cols-[1fr_0.82fr]">
            <div className="space-y-4 sm:space-y-5">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <UserRound className="h-4 w-4" />
                  Datos de contacto
                </p>
                <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                  Natta usa estos datos para avisarte cuando el pedido queda
                  confirmado.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Nombre</span>
                <input
                  className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                  onChange={(event) =>
                    updateCustomer("name", event.target.value)
                  }
                  placeholder="Tu nombre"
                  value={customer.name}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Teléfono</span>
                <input
                  className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                  onChange={(event) =>
                    updateCustomer("phone", event.target.value)
                  }
                  placeholder="Para recibir confirmación"
                  value={customer.phone}
                />
              </label>

              {mode === "delivery" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Dirección</span>
                  <input
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                    onChange={(event) =>
                      updateCustomer("address", event.target.value)
                    }
                    placeholder="Calle, número, piso/depto"
                    value={customer.address}
                  />
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium">Notas</span>
                <textarea
                  className="min-h-20 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 p-4 outline-none transition focus:border-[var(--chocolate)] sm:min-h-24 sm:rounded-2xl"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Horario preferido o aclaraciones."
                  value={notes}
                />
              </label>
            </div>

            <aside className="rounded-[20px] bg-[var(--cream)] p-4 sm:rounded-[24px] sm:p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                <CreditCard className="h-4 w-4" />
                Resumen y pago
              </p>

              <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
                {selectedItems.map((item) => (
                  <div
                    className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-sm last:border-b-0 sm:pb-3"
                    key={`${item.flavor.id}-${item.size.id}`}
                  >
                    <div>
                      <p className="font-medium text-[var(--chocolate-deep)]">
                        {item.quantity} x {item.flavor.name} {item.size.label}
                      </p>
                      <p className="mt-1 text-[var(--chocolate)]/62">
                        {formatCurrency(item.unitPrice)} c/u
                      </p>
                    </div>
                    <p className="font-mono">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm sm:mt-5 sm:space-y-3 sm:pt-5">
                <div className="flex justify-between gap-4">
                  <span>Fecha</span>
                  <strong className="text-right font-medium">
                    {formatReadableDate(date)}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Modalidad</span>
                  <strong className="text-right font-medium">
                    {mode === "pickup" ? "Retiro Devoto" : "Uber / Cabify"}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Total</span>
                  <strong className="font-mono">{formatCurrency(total)}</strong>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[var(--milk)] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--sage)] sm:text-xs sm:tracking-[0.2em]">
                  A pagar ahora
                </p>
                <p className="mt-2 font-display text-3xl text-[var(--chocolate-deep)] sm:text-4xl">
                  {formatCurrency(dueNow)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/70">
                  {paymentCopy[mode]}
                  {balance > 0 ? ` Saldo al retirar: ${formatCurrency(balance)}.` : ""}
                </p>
              </div>
            </aside>
          </section>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
          <button
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] disabled:opacity-0 sm:h-12 sm:text-sm"
            disabled={step === 0}
            onClick={goToPreviousStep}
            type="button"
          >
            Volver
          </button>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-[var(--chocolate)]/68">
              {productCount > 0
                ? `${productCount} unidades · ${formatCurrency(total)}`
                : "Agregá al menos un producto."}
            </p>
            <button
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] disabled:bg-[var(--line)] disabled:text-[var(--chocolate)]/45 sm:h-12 sm:px-6 sm:text-sm"
              disabled={!canAdvance}
              type="submit"
            >
              {step === 3 ? "Confirmar y pagar" : "Continuar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
