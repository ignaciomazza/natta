"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { MercadoPagoCardForm } from "@/components/mercadopago-card-form";

type CatalogSize = {
  id: string;
  slug: string;
  name: string;
  description: string;
  servings: string;
  diameterCm: number | null;
};

type CatalogFlavor = {
  id: string;
  slug: string;
  name: string;
  description: string;
  prices: Array<{
    sizeId: string;
    sizeSlug: string;
    sizeName: string;
    amountArs: number;
  }>;
};

type AvailabilityDay = {
  date: string;
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  bookedUnits: number;
  availableUnits: number;
  minLeadTimeDays: number;
  cutoffHour: number;
};

type CatalogResponse = {
  flavors: CatalogFlavor[];
  sizes: CatalogSize[];
  availability: AvailabilityDay[];
};

type CheckoutSession = {
  orderId: string;
  paymentId: string;
  preferenceId: string;
  amountArs: number;
  publicKey: string;
  receiptCode: string;
  ticketExpirationDays: number;
  walletInitPoint?: string | null;
};

type OrderPaymentsSnapshot = {
  order: {
    id: string;
    status: string;
    amountPaidArs: number;
    amountBalanceArs: number;
    subtotalArs: number;
    publicReceiptCode: string;
    preferenceId: string | null;
    checkoutUrl: string | null;
    deliveryDate: string;
    deliveryAddress: string | null;
    fulfillmentMode: FulfillmentMode | "PICKUP" | "DELIVERY";
    notes: string | null;
    customer: {
      name: string;
      phone: string;
      email: string | null;
      address: string | null;
    };
    items: Array<{
      id: string;
      flavorId: string;
      flavorName: string;
      sizeId: string;
      sizeName: string;
      quantity: number;
      subtotalArs: number;
      unitPriceArs: number;
    }>;
  };
  payments: Array<{
    id: string;
    kind: string;
    status: string;
    method: string;
    amountArs: number;
    paidAt: string | null;
    referenceNote: string | null;
    providerPreferenceId: string | null;
    providerPaymentId: string | null;
    statusDetail: string | null;
    providerPayload: Record<string, unknown> | null;
  }>;
};

type ProcessPaymentResponse = {
  payment: {
    id: string;
    providerPaymentId: string;
    method: string;
    status: string;
    statusDetail: string | null;
    amountArs: number;
    receiptUrl: string | null;
    reference: string | null;
    financialInstitution: string | null;
  };
};

type FulfillmentMode = "pickup" | "delivery";
type QuantityMap = Record<string, number>;
type StepIndex = 0 | 1 | 2 | 3;
type AssistantView = "builder" | "payment" | "success";
type PaymentChoice = "wallet" | "card";

const steps = [
  { label: "Sabores" },
  { label: "Fecha" },
  { label: "Entrega" },
  { label: "Pago" },
] as const;

const paymentStatusLabel: Record<string, string> = {
  APPROVED: "Acreditado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Devuelto",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const itemKey = (flavorId: string, sizeId: string) => `${flavorId}::${sizeId}`;

const getDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultMinDateString = (now: Date, minLeadTimeDays: number) => {
  const minDate = new Date(now);
  minDate.setHours(12, 0, 0, 0);
  minDate.setDate(minDate.getDate() + minLeadTimeDays);
  return getDateOnly(minDate);
};

const getDayBlockingReason = (day: AvailabilityDay, now: Date) => {
  if (!day.isOpen) {
    return "Cerrado";
  }
  if (day.availableUnits <= 0) {
    return "Sin cupo";
  }

  const minDate = getDefaultMinDateString(now, day.minLeadTimeDays);
  if (day.date < minDate) {
    return "Preparación";
  }

  const tomorrowDate = getDefaultMinDateString(now, 1);
  if (day.date === tomorrowDate && now.getHours() >= day.cutoffHour) {
    return `Cierra ${day.cutoffHour}:00`;
  }

  return null;
};

function getReceiptUrlFromPayload(
  providerPayload: Record<string, unknown> | null,
) {
  if (!providerPayload) return null;

  const transactionDetails = providerPayload.transaction_details;
  if (
    transactionDetails &&
    typeof transactionDetails === "object" &&
    !Array.isArray(transactionDetails)
  ) {
    const externalResourceUrl = (transactionDetails as Record<string, unknown>)
      .external_resource_url;
    if (typeof externalResourceUrl === "string" && externalResourceUrl.trim()) {
      return externalResourceUrl;
    }
  }

  return null;
}

function toDisplayDate(date: string) {
  const value = date.includes("T") ? date : `${date}T12:00:00`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatLongDate(date: string) {
  const parsed = toDisplayDate(date);
  if (!parsed) {
    return "Sin definir";
  }

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatCalendarDate(date: string) {
  const dateValue = toDisplayDate(date);
  if (!dateValue) {
    return {
      dayNumber: "--",
      month: "--",
      weekday: "--",
    };
  }

  return {
    dayNumber: new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
    }).format(dateValue),
    month: new Intl.DateTimeFormat("es-AR", {
      month: "short",
    }).format(dateValue),
    weekday: new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
    }).format(dateValue),
  };
}

function isDeliveryMode(mode: string | null | undefined) {
  return mode === "delivery" || mode === "DELIVERY";
}

function getFulfillmentLabel(mode: string | null | undefined) {
  return isDeliveryMode(mode) ? "Uber / Cabify" : "Retiro Devoto";
}

function getDueCopy(
  mode: string | null | undefined,
  balanceArs: number,
) {
  if (isDeliveryMode(mode)) {
    return "Pagás el producto desde la web. El envío se coordina aparte.";
  }

  if (balanceArs > 0) {
    return `Pagás la seña desde la web. Saldo al retirar: ${formatMoney(balanceArs)}.`;
  }

  return "Pagás la seña desde la web.";
}

function getReturnStateMessage(returnState: string | null) {
  if (returnState === "success") {
    return "Volviste después del pago. Estamos revisando la acreditación.";
  }
  if (returnState === "pending") {
    return "El pago quedó pendiente. Podés revisar el estado o intentarlo de nuevo.";
  }
  if (returnState === "failure") {
    return "El pago no se completó. Podés volver a intentarlo.";
  }
  return null;
}

function sanitizeUiMessage(message: string) {
  return message.replace(/checkout/gi, "cobro");
}

function getSizeDetail(size: CatalogSize | undefined) {
  if (!size) return "";
  if (size.diameterCm) {
    return `${size.diameterCm} cm`;
  }
  if (size.servings.trim()) {
    return size.servings;
  }
  return size.description;
}

export function OrderAssistant() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [step, setStep] = useState<StepIndex>(0);
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<FulfillmentMode>("pickup");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [loadingPaymentView, setLoadingPaymentView] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("order");
  });
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [paymentSnapshot, setPaymentSnapshot] = useState<OrderPaymentsSnapshot | null>(null);
  const [paymentResult, setPaymentResult] = useState<ProcessPaymentResponse["payment"] | null>(
    null,
  );
  const [returnPaymentState, setReturnPaymentState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("payment");
  });
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("wallet");

  useEffect(() => {
    void (async () => {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudo cargar el catálogo");
        }

        const payload = (await response.json()) as CatalogResponse;
        setCatalog(payload);

        const now = new Date();
        const firstAvailable = payload.availability.find(
          (item) => !getDayBlockingReason(item, now),
        );
        setDate(firstAvailable?.date ?? "");
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo");
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!createdOrderId) return;

    let cancelled = false;

    void (async () => {
      setLoadingPaymentView(true);
      try {
        const snapshot = await refreshPaymentSnapshot(createdOrderId);
        if (cancelled) return;

        const hasApprovedPayment = snapshot.payments.some(
          (payment) => payment.status === "APPROVED",
        );

        if (snapshot.order.amountBalanceArs > 0 && !hasApprovedPayment) {
          await refreshCheckoutSession(createdOrderId);
        }
      } catch (error) {
        if (cancelled) return;
        setSubmitError(
          sanitizeUiMessage(
            error instanceof Error ? error.message : "No se pudo cargar el pedido",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoadingPaymentView(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createdOrderId]);

  const sizeLookup = useMemo(
    () => new Map((catalog?.sizes ?? []).map((size) => [size.id, size])),
    [catalog],
  );

  const selectedItems = useMemo(() => {
    if (!catalog) return [];

    return catalog.flavors.flatMap((flavor) =>
      flavor.prices
        .map((price) => {
          const quantity = quantities[itemKey(flavor.id, price.sizeId)] ?? 0;
          return {
            flavorId: flavor.id,
            flavorName: flavor.name,
            flavorDescription: flavor.description,
            sizeId: price.sizeId,
            sizeName: price.sizeName,
            sizeDetail: getSizeDetail(sizeLookup.get(price.sizeId)),
            quantity,
            subtotalArs: quantity * price.amountArs,
            unitPriceArs: price.amountArs,
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }, [catalog, quantities, sizeLookup]);

  const totalUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalArs = selectedItems.reduce((sum, item) => sum + item.subtotalArs, 0);
  const dueNowArs = mode === "pickup" ? Math.ceil(totalArs / 2) : totalArs;
  const balanceArs = Math.max(0, totalArs - dueNowArs);

  const availabilityReference = new Date();
  const selectedDay = catalog?.availability.find((item) => item.date === date);
  const selectedDayBlockingReason = selectedDay
    ? getDayBlockingReason(selectedDay, availabilityReference)
    : null;

  const primaryPayment = useMemo(() => {
    if (!paymentSnapshot?.payments.length) return null;
    const approved = paymentSnapshot.payments.find((payment) => payment.status === "APPROVED");
    if (approved) return approved;
    return paymentSnapshot.payments[0];
  }, [paymentSnapshot]);

  const receiptCode = paymentSnapshot?.order.publicReceiptCode ?? submittedCode;
  const paymentReceiptUrl =
    paymentResult?.receiptUrl ??
    getReceiptUrlFromPayload(primaryPayment?.providerPayload ?? null);
  const currentPaymentStatus = paymentResult?.status ?? primaryPayment?.status ?? null;
  const currentPaymentDetail = paymentResult?.statusDetail ?? primaryPayment?.statusDetail ?? null;
  const hasApprovedPayment =
    paymentResult?.status === "APPROVED" ||
    Boolean(paymentSnapshot?.payments.some((payment) => payment.status === "APPROVED"));

  const summaryItems = paymentSnapshot?.order.items.length
    ? paymentSnapshot.order.items.map((item) => ({
        key: item.id,
        title: `${item.quantity} x ${item.flavorName} ${item.sizeName}`,
        unitPriceArs: item.unitPriceArs,
        subtotalArs: item.subtotalArs,
      }))
    : selectedItems.map((item) => ({
        key: `${item.flavorId}-${item.sizeId}`,
        title: `${item.quantity} x ${item.flavorName} ${item.sizeName}`,
        unitPriceArs: item.unitPriceArs,
        subtotalArs: item.subtotalArs,
      }));

  const summaryDate = paymentSnapshot?.order.deliveryDate ?? date;
  const summaryMode = paymentSnapshot?.order.fulfillmentMode ?? mode;
  const summaryTotalArs = paymentSnapshot?.order.subtotalArs ?? totalArs;
  const summaryBalanceArs = paymentSnapshot?.order.amountBalanceArs ?? balanceArs;
  const summaryDueNowArs = checkoutSession?.amountArs ?? dueNowArs;
  const summaryPaidArs =
    paymentSnapshot?.order.amountPaidArs ??
    (paymentResult?.status === "APPROVED" ? paymentResult.amountArs : 0);
  const currentView: AssistantView = createdOrderId
    ? hasApprovedPayment
      ? "success"
      : "payment"
    : "builder";

  const hasContact =
    Boolean(customer.name.trim()) &&
    Boolean(customer.phone.trim());
  const hasDeliveryAddress =
    !isDeliveryMode(mode) || Boolean(customer.address.trim());
  const canSubmit =
    !submitting &&
    totalUnits > 0 &&
    Boolean(date) &&
    !selectedDayBlockingReason &&
    hasContact &&
    hasDeliveryAddress;

  const canAdvance =
    step === 0
      ? totalUnits > 0
      : step === 1
        ? totalUnits > 0 && !selectedDayBlockingReason
        : step === 2
          ? totalUnits > 0 && !selectedDayBlockingReason
          : canSubmit;

  const canOpenStep = (targetStep: number) => {
    if (targetStep <= step) {
      return true;
    }
    if (targetStep === 1) {
      return totalUnits > 0;
    }
    if (targetStep === 2) {
      return totalUnits > 0 && !selectedDayBlockingReason;
    }
    if (targetStep === 3) {
      return totalUnits > 0 && !selectedDayBlockingReason;
    }
    return false;
  };

  const leftColumnContent =
    currentView === "success"
      ? {
          body:
            "Tu pago quedó registrado. Te dejamos el comprobante y el detalle para tenerlo a mano.",
          label: "Pago recibido",
          notes: [
            "Natta te escribe para confirmar el pedido.",
            summaryBalanceArs > 0
              ? `Queda un saldo para el retiro: ${formatMoney(summaryBalanceArs)}.`
              : "No queda saldo pendiente.",
          ],
          title: "Pago recibido.",
        }
      : currentView === "payment"
        ? {
            body:
              "Elegí si querés pagar con dinero en cuenta, QR o tarjeta. Cuando se acredita, te mostramos el comprobante acá mismo.",
            label: "Último paso",
            notes: [
              "Dinero en cuenta y QR se abren en Mercado Pago.",
              "La tarjeta se paga sin salir de Natta.",
            ],
            title: "Elegí cómo pagar.",
          }
        : {
            body:
              "Elegí sabores, fecha y modalidad. Natta te confirma por mensaje cuando el pedido queda tomado.",
            label: "Pedido asistido",
            notes: [
              "Podés combinar sabores y tamaños en un mismo pedido.",
              "El calendario marca preparación, disponibilidad y domingos cerrados.",
            ],
            title: "Armá tu pedido.",
          };

  function updateQuantity(flavorId: string, sizeId: string, delta: number) {
    const key = itemKey(flavorId, sizeId);
    setQuantities((current) => {
      const previous = current[key] ?? 0;
      return {
        ...current,
        [key]: Math.max(0, Math.min(24, previous + delta)),
      };
    });
  }

  function updateCustomer(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function goToNextStep() {
    if (!canAdvance) return;
    setStep((current) => Math.min(current + 1, 3) as StepIndex);
  }

  function goToPreviousStep() {
    setStep((current) => Math.max(current - 1, 0) as StepIndex);
  }

  async function refreshCheckoutSession(orderId: string) {
    const checkoutResponse = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    const checkoutResult = (await checkoutResponse.json().catch(() => null)) as
      | ({ error?: string } & CheckoutSession)
      | null;

    if (!checkoutResponse.ok || !checkoutResult?.preferenceId) {
      throw new Error(
        sanitizeUiMessage(
          checkoutResult?.error ??
            "Pedido creado, pero no se pudo preparar el cobro. Probá nuevamente.",
        ),
      );
    }

    setCheckoutSession(checkoutResult);
    setSubmittedCode(checkoutResult.receiptCode);
    return checkoutResult;
  }

  async function refreshPaymentSnapshot(orderId: string) {
    const response = await fetch(`/api/payments/order/${orderId}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | ({ error?: string } & OrderPaymentsSnapshot)
      | null;

    if (!response.ok || !payload?.order) {
      throw new Error(payload?.error ?? "No se pudo cargar el estado del pago");
    }

    setPaymentSnapshot(payload);
    setSubmittedCode(payload.order.publicReceiptCode);
    setDate(payload.order.deliveryDate.split("T")[0] ?? payload.order.deliveryDate);
    setMode(isDeliveryMode(payload.order.fulfillmentMode) ? "delivery" : "pickup");
    setCustomer({
      name: payload.order.customer.name,
      phone: payload.order.customer.phone,
      email: payload.order.customer.email ?? "",
      address:
        payload.order.deliveryAddress ??
        payload.order.customer.address ??
        "",
    });
    setNotes(payload.order.notes ?? "");
    setQuantities(() =>
      payload.order.items.reduce<QuantityMap>((accumulator, item) => {
        accumulator[itemKey(item.flavorId, item.sizeId)] = item.quantity;
        return accumulator;
      }, {}),
    );
    return payload;
  }

  function resetPaymentFlow(targetStep: StepIndex, message: string | null = null) {
    setCreatedOrderId(null);
    setCheckoutSession(null);
    setPaymentSnapshot(null);
    setPaymentResult(null);
    setSubmittedCode(null);
    setReturnPaymentState(null);
    setLoadingPaymentView(false);
    setCheckingStatus(false);
    setPaymentChoice("wallet");
    setSubmitError(message);
    setStep(targetStep);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("order");
    nextUrl.searchParams.delete("payment");
    window.history.replaceState({}, "", nextUrl);

    requestAnimationFrame(() => {
      document
        .getElementById("pedido-asistido")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function returnToBuilder(targetStep: StepIndex) {
    if (!createdOrderId || hasApprovedPayment) {
      setStep(targetStep);
      requestAnimationFrame(() => {
        document
          .getElementById("pedido-asistido")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    setLoadingPaymentView(true);

    let message: string | null = null;

    try {
      if (receiptCode) {
        const response = await fetch(`/api/public/order/${createdOrderId}/discard`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiptCode,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error ??
              "No se pudo cerrar el intento anterior. Podés corregir el pedido y volver a confirmar.",
          );
        }
      }
    } catch (error) {
      message = sanitizeUiMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cerrar el intento anterior. Podés corregir el pedido y volver a confirmar.",
      );
    } finally {
      resetPaymentFlow(targetStep, message);
    }
  }

  async function createOrderAndPreparePayment() {
    if (!catalog || !canSubmit) return;

    if (selectedDayBlockingReason) {
      setSubmitError(`La fecha elegida no está disponible: ${selectedDayBlockingReason}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setCreatedOrderId(null);
    setSubmittedCode(null);
    setCheckoutSession(null);
    setPaymentSnapshot(null);
    setPaymentResult(null);
    setReturnPaymentState(null);
    setPaymentChoice("wallet");
    setLoadingPaymentView(true);

    try {
      const orderPayload = {
        deliveryDate: date,
        fulfillmentMode: mode,
        customer: {
          name: customer.name,
          phone: customer.phone,
          address: customer.address || undefined,
        },
        notes: notes || undefined,
        items: selectedItems.map((item) => ({
          flavorId: item.flavorId,
          sizeId: item.sizeId,
          quantity: item.quantity,
        })),
      };

      const createOrderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const createOrderResult = (await createOrderResponse.json().catch(() => null)) as
        | {
            error?: string;
            orderId?: string;
            publicReceiptCode?: string;
          }
        | null;

      if (!createOrderResponse.ok || !createOrderResult?.orderId) {
        throw new Error(createOrderResult?.error ?? "No se pudo crear el pedido");
      }

      setCreatedOrderId(createOrderResult.orderId);
      setSubmittedCode(createOrderResult.publicReceiptCode ?? null);

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("order", createOrderResult.orderId);
      nextUrl.searchParams.delete("payment");
      window.history.replaceState({}, "", nextUrl);

      await refreshCheckoutSession(createOrderResult.orderId);
      await refreshPaymentSnapshot(createOrderResult.orderId);

      requestAnimationFrame(() => {
        document
          .getElementById("pago-final")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setSubmitError(
        sanitizeUiMessage(
          error instanceof Error ? error.message : "No se pudo crear el pedido",
        ),
      );
    } finally {
      setLoadingPaymentView(false);
      setSubmitting(false);
    }
  }

  async function refreshPaymentStatus() {
    if (!createdOrderId) return;

    setCheckingStatus(true);
    setSubmitError(null);
    try {
      const snapshot = await refreshPaymentSnapshot(createdOrderId);
      const hasApprovedPayment = snapshot.payments.some(
        (payment) => payment.status === "APPROVED",
      );

      if (snapshot.order.amountBalanceArs > 0 && !hasApprovedPayment) {
        await refreshCheckoutSession(createdOrderId);
      }
    } catch (error) {
      setSubmitError(
        sanitizeUiMessage(
          error instanceof Error ? error.message : "No se pudo revisar el pago",
        ),
      );
    } finally {
      setCheckingStatus(false);
    }
  }

  function openWalletPayment() {
    if (!checkoutSession?.walletInitPoint) {
      setSubmitError("No se pudo abrir Mercado Pago. Probá preparar el pago de nuevo.");
      return;
    }

    window.location.href = checkoutSession.walletInitPoint;
  }

  async function handlePaymentResult(result: ProcessPaymentResponse) {
    setPaymentResult(result.payment);
    if (!createdOrderId) return;

    try {
      await refreshPaymentSnapshot(createdOrderId);
    } catch (error) {
      setSubmitError(
        sanitizeUiMessage(
          error instanceof Error ? error.message : "No se pudo actualizar el pago",
        ),
      );
    }
  }

  function handleBuilderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < 3) {
      goToNextStep();
      return;
    }

    void createOrderAndPreparePayment();
  }

  function renderStepHeader(
    activeStep: StepIndex,
    interactive: boolean,
    onStepSelect?: (targetStep: StepIndex) => void,
  ) {
    return (
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
        {steps.map((item, index) => {
          const isActive = activeStep === index;
          const isDisabled = interactive ? !canOpenStep(index) : true;

          return (
            <button
              className={`step-card rounded-xl border px-2 py-2 text-center transition sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left ${
                isActive
                  ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                  : "border-[var(--line)] bg-white/55 text-[var(--chocolate)]/70 hover:border-[var(--caramel)] disabled:opacity-55 disabled:hover:border-[var(--line)]"
              }`}
              disabled={isDisabled}
              key={item.label}
              onClick={() => {
                if (!interactive) return;
                if (onStepSelect) {
                  onStepSelect(index as StepIndex);
                  return;
                }
                setStep(index as StepIndex);
              }}
              type="button"
            >
              <span className="block text-xs font-medium sm:text-base">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (loadingCatalog) {
    return (
      <div className="rounded-3xl border border-white/70 bg-[var(--milk)] p-8 text-[var(--chocolate)] image-shadow">
        <p className="flex items-center gap-2 text-sm text-[var(--sage)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Cargando sabores y fechas...
        </p>
      </div>
    );
  }

  if (catalogError || !catalog) {
    return (
      <div className="rounded-3xl border border-white/70 bg-[var(--milk)] p-8 text-[var(--chocolate)] image-shadow">
        <p className="text-sm text-red-600">{catalogError ?? "No se pudo cargar el catálogo"}</p>
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 gap-5 md:gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
      <div
        className="hidden min-w-0 space-y-4 md:block lg:sticky lg:top-24 lg:space-y-6"
        data-reveal="subtle"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--sage)] md:text-sm md:tracking-[0.24em]">
          <Clock className="h-4 w-4" />
          {leftColumnContent.label}
        </div>
        <div>
          <h2 className="max-w-full break-words font-display text-4xl leading-none tracking-[-0.03em] text-[var(--chocolate-deep)] md:text-7xl">
            {leftColumnContent.title}
          </h2>
          <p className="mt-3 max-w-xl break-words text-base leading-7 text-[var(--chocolate)]/78 md:mt-5 md:text-lg md:leading-8">
            {leftColumnContent.body}
          </p>
        </div>

        <div className="hidden gap-3 text-sm text-[var(--chocolate)]/76 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          {leftColumnContent.notes.map((note) => (
            <div className="border-t border-[var(--line)] pt-4" key={note}>
              <Check className="mb-3 h-5 w-5 text-[var(--sage)]" />
              {note}
            </div>
          ))}
        </div>
      </div>

      {currentView === "builder" ? (
        <form
          className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:border sm:border-white/70 sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:p-7"
          data-testid="order-assistant"
          id="pedido-asistido"
          onSubmit={handleBuilderSubmit}
        >
          {renderStepHeader(step, true)}

          {step === 0 ? (
            <section className="step-panel mt-5 sm:mt-7">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                    <ShoppingBag className="h-4 w-4" />
                    Sabores y cantidad
                  </p>
                  <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                    Sumá unidades por sabor según el tamaño que quieras llevar.
                  </p>
                </div>
                <p className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--sage)]/85 md:flex">
                  Deslizá para ver más sabores
                  <ArrowDown className="h-3.5 w-3.5" />
                </p>
              </div>

              <div className="mt-3 divide-y divide-[var(--line)] sm:mt-5">
                {catalog.flavors.map((flavor) => (
                  <article className="py-3 sm:py-5" key={flavor.id}>
                    <div className="grid gap-3 sm:gap-5 xl:grid-cols-[0.52fr_1.48fr] xl:items-stretch">
                      <div className="flex min-h-full flex-wrap items-baseline gap-x-3 gap-y-1 md:flex-col md:flex-nowrap md:items-start md:justify-center md:gap-0">
                        <h3 className="font-display text-2xl leading-none text-[var(--chocolate-deep)] sm:text-3xl">
                          {flavor.name}
                        </h3>
                        <p className="min-w-0 flex-1 text-xs leading-5 text-[var(--chocolate)]/70 sm:text-sm sm:leading-6 md:mt-3 md:max-w-[17rem] md:flex-none">
                          {flavor.description}
                        </p>
                      </div>

                      <div className="grid min-w-0 grid-cols-3 gap-2">
                        {flavor.prices.map((price) => {
                          const key = itemKey(flavor.id, price.sizeId);
                          const quantity = quantities[key] ?? 0;
                          const size = sizeLookup.get(price.sizeId);

                          return (
                            <div
                              className={`order-card flex min-h-[5.35rem] flex-col justify-between rounded-xl border p-1.5 transition sm:min-h-36 sm:rounded-2xl sm:p-3 ${
                                quantity > 0
                                  ? "border-[var(--chocolate)] bg-[var(--cream)]"
                                  : "border-[var(--line)] bg-white/55"
                              }`}
                              key={key}
                            >
                              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                                <div>
                                  <p className="text-xs font-medium sm:text-base">{price.sizeName}</p>
                                  <p className="mt-1 hidden text-xs text-[var(--chocolate)]/62 sm:block">
                                    {getSizeDetail(size)}
                                  </p>
                                </div>
                                <p className="font-mono text-[0.56rem] text-[var(--chocolate)]/72 sm:text-xs">
                                  {formatMoney(price.amountArs)}
                                </p>
                              </div>
                              <div className="mt-2 flex h-7 w-full items-center justify-between self-center rounded-full border border-[var(--line)] bg-[var(--milk)] px-1 sm:mt-3 sm:h-10 sm:px-2">
                                <button
                                  aria-label={`Restar ${price.sizeName} ${flavor.name}`}
                                  className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-[var(--sage-soft)] disabled:opacity-35 sm:h-8 sm:w-8"
                                  disabled={quantity === 0}
                                  onClick={() => updateQuantity(flavor.id, price.sizeId, -1)}
                                  type="button"
                                >
                                  <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                                </button>
                                <span className="font-mono text-xs sm:text-sm">{quantity}</span>
                                <button
                                  aria-label={`Sumar ${price.sizeName} ${flavor.name}`}
                                  className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-[var(--sage-soft)] sm:h-8 sm:w-8"
                                  onClick={() => updateQuantity(flavor.id, price.sizeId, 1)}
                                  type="button"
                                >
                                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
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
            <section className="step-panel mt-5 space-y-5 sm:mt-7 sm:space-y-7">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <CalendarDays className="h-4 w-4" />
                  Disponibilidad
                </p>
                <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                  Las primeras 48/72 h quedan como preparación. Los domingos no se toman pedidos ni retiros.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {catalog.availability.map((day) => {
                  const blockedReason = getDayBlockingReason(day, availabilityReference);
                  const isDisabled = Boolean(blockedReason);
                  const parts = formatCalendarDate(day.date);

                  return (
                    <button
                      className={`order-card rounded-xl border p-2 text-left transition sm:rounded-2xl sm:p-3 ${
                        date === day.date
                          ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                          : isDisabled
                            ? "border-[var(--line)] bg-[var(--cream)] text-[var(--chocolate)]/42"
                            : "border-[var(--line)] bg-white/60 hover:border-[var(--caramel)]"
                      }`}
                      disabled={isDisabled}
                      key={day.date}
                      onClick={() => setDate(day.date)}
                      type="button"
                    >
                      <span className="text-[0.58rem] uppercase tracking-[0.14em] opacity-70 sm:text-[0.68rem] sm:tracking-[0.16em]">
                        {parts.weekday}
                      </span>
                      <span className="mt-1 block font-display text-2xl leading-none sm:mt-2 sm:text-4xl">
                        {parts.dayNumber}
                      </span>
                      <span className="mt-0.5 block text-[0.58rem] uppercase tracking-[0.14em] opacity-70 sm:mt-1 sm:text-xs sm:tracking-[0.16em]">
                        {parts.month}
                      </span>
                      <span className="mt-1.5 block text-[0.62rem] font-medium sm:mt-3 sm:text-xs">
                        {blockedReason ?? "Disponible"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="step-panel mt-5 space-y-5 sm:mt-7 sm:space-y-7">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <Truck className="h-4 w-4" />
                  Entrega
                </p>
                <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                  Elegí si retirás por Devoto o si coordinamos envío por Uber / Cabify.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className={`order-card rounded-xl border p-3 text-left transition sm:rounded-2xl sm:p-4 ${
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
                  <span className="mt-1 block text-sm opacity-80">Seña desde la web del 50%</span>
                </button>
                <button
                  className={`order-card rounded-xl border p-3 text-left transition sm:rounded-2xl sm:p-4 ${
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
                  <span className="mt-1 block text-sm opacity-80">Pago desde la web del producto</span>
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="step-panel mt-5 grid gap-5 sm:mt-7 sm:gap-7 xl:grid-cols-[1fr_0.82fr]">
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                    <UserRound className="h-4 w-4" />
                    Datos de contacto
                  </p>
                  <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                    Natta usa estos datos para avisarte cuando el pedido queda confirmado.
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Nombre</span>
                  <input
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                    onChange={(event) => updateCustomer("name", event.target.value)}
                    placeholder="Tu nombre"
                    value={customer.name}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Teléfono</span>
                  <input
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                    onChange={(event) => updateCustomer("phone", event.target.value)}
                    placeholder="Para recibir confirmación"
                    value={customer.phone}
                  />
                </label>

                {mode === "delivery" ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Dirección</span>
                    <input
                      className="h-12 w-full rounded-xl border border-[var(--line)] bg-white/70 px-4 outline-none transition focus:border-[var(--chocolate)] sm:h-14 sm:rounded-2xl"
                      onChange={(event) => updateCustomer("address", event.target.value)}
                      placeholder="Calle, número, piso o departamento"
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

              <aside className="order-card rounded-[20px] bg-[var(--cream)] p-4 sm:rounded-[24px] sm:p-5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <CreditCard className="h-4 w-4" />
                  Resumen y pago
                </p>

                <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
                  {summaryItems.map((item) => (
                    <div
                      className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-sm last:border-b-0 sm:pb-3"
                      key={item.key}
                    >
                      <div>
                        <p className="font-medium text-[var(--chocolate-deep)]">{item.title}</p>
                        <p className="mt-1 text-[var(--chocolate)]/62">
                          {formatMoney(item.unitPriceArs)} c/u
                        </p>
                      </div>
                      <p className="font-mono">{formatMoney(item.subtotalArs)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm sm:mt-5 sm:space-y-3 sm:pt-5">
                  <div className="flex justify-between gap-4">
                    <span>Fecha</span>
                    <strong className="text-right font-medium">
                      {summaryDate ? formatLongDate(summaryDate) : "Sin definir"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Modalidad</span>
                    <strong className="text-right font-medium">
                      {getFulfillmentLabel(summaryMode)}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Total</span>
                    <strong className="font-mono">{formatMoney(summaryTotalArs)}</strong>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-[var(--milk)] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--sage)] sm:text-xs sm:tracking-[0.2em]">
                    A pagar ahora
                  </p>
                  <p className="mt-2 font-display text-3xl text-[var(--chocolate-deep)] sm:text-4xl">
                    {formatMoney(dueNowArs)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/70">
                    {getDueCopy(mode, balanceArs)}
                  </p>
                </div>
              </aside>
            </section>
          ) : null}

          {submitError ? <p className="mt-5 text-sm text-red-600">{submitError}</p> : null}

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
              <p className="text-center text-sm text-[var(--chocolate)]/68 sm:text-left">
                {totalUnits > 0
                  ? `${totalUnits} ${totalUnits === 1 ? "unidad" : "unidades"} · ${formatMoney(totalArs)}`
                  : "Agregá al menos un producto."}
              </p>
              <button
                className="motion-button inline-flex h-11 items-center justify-center rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] disabled:bg-[var(--line)] disabled:text-[var(--chocolate)]/45 sm:h-12 sm:px-6 sm:text-sm"
                disabled={!canAdvance}
                type="submit"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Preparando pedido...
                  </span>
                ) : step === 3 ? (
                  "Confirmar y pagar"
                ) : (
                  "Continuar"
                )}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {currentView === "payment" ? (
        <section
          className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:border sm:border-white/70 sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:p-7"
          id="pago-final"
        >
          {renderStepHeader(3, true, (targetStep) => {
            void returnToBuilder(targetStep);
          })}

          {loadingPaymentView ? (
            <div className="mt-8 flex min-h-72 flex-col items-center justify-center gap-3 rounded-[24px] border border-[var(--line)] bg-white/60 px-6 text-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--sage)]" />
              <p className="text-sm text-[var(--chocolate)]/72">
                Preparando las opciones de pago...
              </p>
            </div>
          ) : (
            <>
              {submitError ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              ) : null}

              {!submitError && currentPaymentStatus === "REJECTED" ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  El pago no se pudo acreditar. Podés volver a intentarlo.
                </div>
              ) : null}

              {!submitError &&
              currentPaymentStatus !== "REJECTED" &&
              getReturnStateMessage(returnPaymentState) ? (
                <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--chocolate)]">
                  {getReturnStateMessage(returnPaymentState)}
                </div>
              ) : null}

              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.82fr] xl:gap-7">
                <div>
                <div>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--line)] px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] sm:h-10 sm:px-4 sm:text-xs"
                    onClick={() => {
                      void returnToBuilder(3);
                    }}
                    type="button"
                  >
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5 rotate-180" />
                    Volver
                  </button>

                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                    <CreditCard className="h-4 w-4" />
                    Elegí cómo pagar
                  </p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      className={`rounded-xl border p-4 text-left transition sm:rounded-2xl ${
                        paymentChoice === "wallet"
                          ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                          : "border-[var(--line)] bg-white/60 hover:border-[var(--caramel)]"
                      }`}
                      onClick={() => setPaymentChoice("wallet")}
                      type="button"
                    >
                      <QrCode className="mb-3 h-5 w-5" />
                      <span className="block font-semibold">Dinero en cuenta o QR</span>
                      <span className="mt-1 block text-sm opacity-80">
                        Se abre Mercado Pago para terminar el pago.
                      </span>
                    </button>

                    <button
                      className={`rounded-xl border p-4 text-left transition sm:rounded-2xl ${
                        paymentChoice === "card"
                          ? "border-[var(--chocolate)] bg-[var(--chocolate)] text-[var(--milk)]"
                          : "border-[var(--line)] bg-white/60 hover:border-[var(--caramel)]"
                      }`}
                      onClick={() => setPaymentChoice("card")}
                      type="button"
                    >
                      <CreditCard className="mb-3 h-5 w-5" />
                      <span className="block font-semibold">Tarjeta</span>
                      <span className="mt-1 block text-sm opacity-80">
                        Pagás sin salir de Natta.
                      </span>
                    </button>
                  </div>

                  {checkoutSession ? (
                    paymentChoice === "wallet" ? (
                      <section className="mt-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,#413935_0%,#2b2521_100%)] p-5 text-[var(--milk)]">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                          <QrCode className="h-5 w-5" />
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold">Abrir Mercado Pago</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--milk)]/75">
                          Se abre Mercado Pago para terminar el pago con saldo en cuenta o con el QR disponible.
                        </p>
                        <button
                          className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--milk)] px-5 text-sm font-semibold text-[var(--chocolate-deep)] transition hover:bg-[var(--caramel-soft)]"
                          onClick={openWalletPayment}
                          type="button"
                        >
                          <span>Abrir Mercado Pago</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </section>
                    ) : (
                      <section className="mt-5 rounded-[24px] border border-[var(--line)] bg-white/82 p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cream)] text-[var(--chocolate-deep)]">
                            <CreditCard className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)]">
                              Tarjeta
                            </p>
                          </div>
                        </div>

                        <MercadoPagoCardForm
                          checkout={checkoutSession}
                          onPaymentResult={(result) => {
                            void handlePaymentResult(result);
                          }}
                        />
                      </section>
                    )
                  ) : (
                    <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--chocolate)]">
                      <p>No se pudo preparar el pago todavía.</p>
                      <button
                        className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] sm:text-sm"
                        disabled={submitting || checkingStatus}
                        onClick={() => {
                          if (!createdOrderId) return;
                          void refreshCheckoutSession(createdOrderId);
                        }}
                        type="button"
                      >
                        Preparar pago otra vez
                      </button>
                    </section>
                  )}

                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--chocolate)]/82">
                    <button
                      className="font-semibold underline underline-offset-4"
                      disabled={checkingStatus}
                      onClick={() => {
                        void refreshPaymentStatus();
                      }}
                      type="button"
                    >
                      {checkingStatus ? "Revisando..." : "Actualizar estado"}
                    </button>
                    {receiptCode ? (
                      <a
                        className="font-semibold underline underline-offset-4"
                        href={`/comprobante/${receiptCode}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver comprobante
                      </a>
                    ) : null}
                    {paymentReceiptUrl ? (
                      <a
                        className="font-semibold underline underline-offset-4"
                        href={paymentReceiptUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver constancia del pago
                      </a>
                    ) : null}
                  </div>
                </div>

                <aside className="order-card rounded-[22px] border border-[var(--line)] bg-[var(--cream)] p-4 sm:rounded-[24px] sm:border-0 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                      Resumen
                    </p>
                    <span className="inline-flex rounded-full bg-white/85 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] sm:text-[0.72rem]">
                      {paymentStatusLabel[currentPaymentStatus ?? "PENDING"] ??
                        currentPaymentStatus ??
                        "Pendiente"}
                    </span>
                  </div>
                  {receiptCode ? (
                    <p className="mt-2 text-sm text-[var(--chocolate)]/72">
                      Comprobante <strong>{receiptCode}</strong>
                    </p>
                  ) : null}
                  {currentPaymentDetail ? (
                    <p className="mt-3 text-sm text-[var(--chocolate)]/70">
                      {currentPaymentDetail}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2 sm:space-y-3">
                    {summaryItems.map((item) => (
                      <div
                        className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-sm last:border-b-0 sm:pb-3"
                        key={item.key}
                      >
                        <div>
                          <p className="font-medium text-[var(--chocolate-deep)]">{item.title}</p>
                          <p className="mt-1 text-[var(--chocolate)]/62">
                            {formatMoney(item.unitPriceArs)} c/u
                          </p>
                        </div>
                        <p className="font-mono">{formatMoney(item.subtotalArs)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm sm:space-y-3">
                    <div className="flex justify-between gap-4">
                      <span>Fecha</span>
                      <strong className="text-right font-medium">
                        {summaryDate ? formatLongDate(summaryDate) : "Sin definir"}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Modalidad</span>
                      <strong className="text-right font-medium">
                        {getFulfillmentLabel(summaryMode)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Total</span>
                      <strong className="font-mono">{formatMoney(summaryTotalArs)}</strong>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/80 p-4 sm:rounded-2xl">
                    <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--sage)] sm:text-xs sm:tracking-[0.2em]">
                      A pagar ahora
                    </p>
                    <p className="mt-2 font-display text-3xl text-[var(--chocolate-deep)] sm:text-4xl">
                      {formatMoney(summaryDueNowArs)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/70">
                      {getDueCopy(summaryMode, summaryBalanceArs)}
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      ) : null}

      {currentView === "success" ? (
        <section className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:border sm:border-white/70 sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:p-7">
          {renderStepHeader(3, false)}

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.82fr] xl:gap-7">
            <div className="rounded-[24px] bg-[var(--cream)] p-5 sm:p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chocolate-deep)] text-[var(--milk)]">
                <Check className="h-5 w-5" />
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)]">
                Pago recibido
              </p>
              <h3 className="mt-2 font-display text-4xl leading-none tracking-[-0.03em] text-[var(--chocolate-deep)] sm:text-5xl">
                Ya podés guardar el comprobante.
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--chocolate)]/76 sm:text-base">
                Tu pedido quedó registrado y el pago ya figura acreditado. Natta te escribe para confirmar el pedido.
              </p>

              {receiptCode ? (
                <div className="mt-5 rounded-2xl bg-white/80 px-4 py-3 text-sm">
                  <p>
                    Código de comprobante: <strong>{receiptCode}</strong>
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {receiptCode ? (
                  <a
                    className="motion-button inline-flex h-11 items-center justify-center rounded-full bg-[var(--chocolate-deep)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--milk)] transition hover:bg-[var(--sage)] sm:h-12 sm:text-sm"
                    href={`/comprobante/${receiptCode}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ver comprobante
                  </a>
                ) : null}
                {paymentReceiptUrl ? (
                  <a
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] transition hover:border-[var(--chocolate)] sm:h-12 sm:text-sm"
                    href={paymentReceiptUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ver constancia del pago
                  </a>
                ) : null}
              </div>
            </div>

            <aside className="order-card rounded-[20px] bg-[var(--cream)] p-4 sm:rounded-[24px] sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                Resumen del pedido
              </p>

              <div className="mt-4 space-y-2 sm:space-y-3">
                {summaryItems.map((item) => (
                  <div
                    className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 text-sm last:border-b-0 sm:pb-3"
                    key={item.key}
                  >
                    <div>
                      <p className="font-medium text-[var(--chocolate-deep)]">{item.title}</p>
                      <p className="mt-1 text-[var(--chocolate)]/62">
                        {formatMoney(item.unitPriceArs)} c/u
                      </p>
                    </div>
                    <p className="font-mono">{formatMoney(item.subtotalArs)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm sm:space-y-3">
                <div className="flex justify-between gap-4">
                  <span>Fecha</span>
                  <strong className="text-right font-medium">
                    {summaryDate ? formatLongDate(summaryDate) : "Sin definir"}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Modalidad</span>
                  <strong className="text-right font-medium">
                    {getFulfillmentLabel(summaryMode)}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Total</span>
                  <strong className="font-mono">{formatMoney(summaryTotalArs)}</strong>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white/80 p-4 sm:rounded-2xl">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--sage)] sm:text-xs sm:tracking-[0.2em]">
                  Cobrado ahora
                </p>
                <p className="mt-2 font-display text-3xl text-[var(--chocolate-deep)] sm:text-4xl">
                  {formatMoney(summaryPaidArs || summaryDueNowArs)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--chocolate)]/70">
                  {summaryBalanceArs > 0
                    ? `Saldo al retirar: ${formatMoney(summaryBalanceArs)}.`
                    : "No queda saldo pendiente."}
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
