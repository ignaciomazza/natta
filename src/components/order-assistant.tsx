"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  ImageIcon,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { MercadoPagoCardForm } from "@/components/mercadopago-card-form";

type CatalogSize = {
  id: string;
  slug: string;
  name: string;
  description: string;
  servings: string;
  diameterCm: number | null;
  grams: number | null;
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
    receiptUrl: string | null;
    reference: string | null;
    financialInstitution: string | null;
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
type FlavorPhoto = {
  src: string;
  alt: string;
};

const steps = [
  { label: "Sabores" },
  { label: "Fecha" },
  { label: "Entrega" },
  { label: "Pago" },
] as const;

const DATE_PAGE_SIZE = 9;

const paymentStatusLabel: Record<string, string> = {
  APPROVED: "Acreditado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Devuelto",
};

const menuPhotoVersion = "20260612-menu-grade";
const getMenuPhotoSrc = (slug: string) =>
  `/images/menu/optimized/${slug}.jpg?v=${menuPhotoVersion}`;

const flavorPhotosBySlug: Record<string, FlavorPhoto> = {
  natta: {
    src: getMenuPhotoSrc("natta"),
    alt: "Tartas Natta vistas desde arriba en sus moldes",
  },
  limu: {
    src: getMenuPhotoSrc("limu"),
    alt: "Porcion cremosa de tarta Natta sobre plato negro",
  },
  choco: {
    src: getMenuPhotoSrc("choco"),
    alt: "Porcion de tarta Natta con cucharita dorada",
  },
  tella: {
    src: getMenuPhotoSrc("tella"),
    alt: "Porcion de tarta Natta con frutos secos",
  },
  blanca: {
    src: getMenuPhotoSrc("blanca"),
    alt: "Tarta Natta entera sobre plato negro",
  },
  tachio: {
    src: getMenuPhotoSrc("tachio"),
    alt: "Porcion de tarta Natta con pistachos",
  },
  duo: {
    src: getMenuPhotoSrc("duo"),
    alt: "Lattas Natta con etiquetas de sabores",
  },
  argenta: {
    src: getMenuPhotoSrc("argenta"),
    alt: "Tarta Natta caramelizada en molde",
  },
  mocha: {
    src: getMenuPhotoSrc("mocha"),
    alt: "Lattas Natta listas para entregar",
  },
  brulee: {
    src: getMenuPhotoSrc("brulee"),
    alt: "Tarta Natta creme brulee con superficie caramelizada",
  },
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const itemKey = (flavorId: string, sizeId: string) => `${flavorId}::${sizeId}`;

const getFlavorPhoto = (flavor: CatalogFlavor) =>
  flavorPhotosBySlug[flavor.slug] ?? flavorPhotosBySlug.natta;

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
  return isDeliveryMode(mode) ? "Uber" : "Retiro Devoto";
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

function getMercadoPagoReturnPaymentId() {
  if (typeof window === "undefined") return null;

  const searchParams = new URLSearchParams(window.location.search);
  return (
    searchParams.get("payment_id") ??
    searchParams.get("collection_id") ??
    null
  );
}

function sanitizeUiMessage(message: string) {
  return message.replace(/checkout/gi, "cobro");
}

function getSizeDetail(size: CatalogSize | undefined) {
  if (!size) return "";
  const parts: string[] = [];
  if (size.diameterCm) {
    parts.push(`${size.diameterCm} cm`);
  }
  if (size.grams) {
    const gramsLabel =
      size.grams >= 1000 && size.grams % 1000 === 0
        ? `${size.grams / 1000} kg`
        : `${size.grams} g`;
    parts.push(size.slug === "latta" ? gramsLabel : `${gramsLabel} aprox.`);
  }
  if (parts.length) {
    return parts.join(" · ");
  }
  if (size.servings.trim()) {
    return size.servings;
  }
  return size.description;
}

const mobileSizeWeightLabels: Record<string, string> = {
  chica: "950g",
  grande: "1.900g",
  latta: "300g",
};

function getMobileSizeWeight(size: CatalogSize | undefined) {
  if (!size) return null;
  return mobileSizeWeightLabels[size.slug] ?? null;
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
  const [submittedCode, setSubmittedCode] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("code");
  });
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
  const [returnPaymentId, setReturnPaymentId] = useState<string | null>(() =>
    getMercadoPagoReturnPaymentId(),
  );
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("wallet");
  const [photoFlavor, setPhotoFlavor] = useState<CatalogFlavor | null>(null);
  const [datePage, setDatePage] = useState(0);

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
        const firstAvailableIndex = payload.availability.findIndex(
          (item) => !getDayBlockingReason(item, now),
        );
        const firstAvailable = payload.availability[firstAvailableIndex];
        setDate(firstAvailable?.date ?? "");
        setDatePage(firstAvailableIndex >= 0 ? Math.floor(firstAvailableIndex / DATE_PAGE_SIZE) : 0);
      } catch (error) {
        setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo");
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!photoFlavor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhotoFlavor(null);
      }
    };
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photoFlavor]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (!createdOrderId || !loadingPaymentView) return;

    scrollPageToTop("auto");
  }, [createdOrderId, loadingPaymentView]);

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
  const availabilityPageCount = Math.max(
    1,
    Math.ceil((catalog?.availability.length ?? 0) / DATE_PAGE_SIZE),
  );
  const activeDatePage = Math.min(Math.max(datePage, 0), availabilityPageCount - 1);
  const visibleAvailability = catalog?.availability.slice(
    activeDatePage * DATE_PAGE_SIZE,
    activeDatePage * DATE_PAGE_SIZE + DATE_PAGE_SIZE,
  ) ?? [];

  const primaryPayment = useMemo(() => {
    if (!paymentSnapshot?.payments.length) return null;
    const approved = paymentSnapshot.payments.find((payment) => payment.status === "APPROVED");
    if (approved) return approved;
    return paymentSnapshot.payments[0];
  }, [paymentSnapshot]);

  const receiptCode = paymentSnapshot?.order.publicReceiptCode ?? submittedCode;
  const paymentReceiptUrl =
    paymentResult?.receiptUrl ?? primaryPayment?.receiptUrl ?? null;
  const currentPaymentStatus = paymentResult?.status ?? primaryPayment?.status ?? null;
  const currentPaymentDetail = paymentResult?.statusDetail ?? primaryPayment?.statusDetail ?? null;
  const hasApprovedPayment =
    paymentResult?.status === "APPROVED" ||
    Boolean(paymentSnapshot?.payments.some((payment) => payment.status === "APPROVED"));
  const returnedFromSuccessfulPayment =
    Boolean(createdOrderId) && returnPaymentState === "success";

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
    ? hasApprovedPayment || returnedFromSuccessfulPayment
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

  const modalPhoto = photoFlavor ? getFlavorPhoto(photoFlavor) : null;

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

  function scrollPageToTop(behavior: ScrollBehavior = "smooth") {
    const scroll = (nextBehavior: ScrollBehavior) => {
      window.scrollTo({ left: 0, top: 0, behavior: nextBehavior });
      if (nextBehavior === "auto") {
        window.scrollTo(0, 0);
      }
    };

    requestAnimationFrame(() => {
      scroll(behavior);
      window.setTimeout(() => scroll("auto"), 120);
      window.setTimeout(() => scroll("auto"), 360);
    });
  }

  function goToNextStep() {
    if (!canAdvance) return;
    setStep((current) => Math.min(current + 1, 3) as StepIndex);
  }

  function goToPreviousStep() {
    setStep((current) => Math.max(current - 1, 0) as StepIndex);
  }

  const getCurrentReceiptCode = useCallback(
    (override?: string | null) => override ?? submittedCode,
    [submittedCode],
  );

  const refreshCheckoutSession = useCallback(async (
    orderId: string,
    receiptCodeOverride?: string | null,
  ) => {
    const currentReceiptCode = getCurrentReceiptCode(receiptCodeOverride);
    if (!currentReceiptCode) {
      throw new Error("No se pudo verificar el comprobante del pedido.");
    }

    const checkoutResponse = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        receiptCode: currentReceiptCode,
      }),
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
  }, [getCurrentReceiptCode]);

  const refreshPaymentSnapshot = useCallback(async (
    orderId: string,
    options?: {
      receiptCode?: string | null;
      syncPaymentId?: string | null;
    },
  ) => {
    const currentReceiptCode = getCurrentReceiptCode(options?.receiptCode);
    if (!currentReceiptCode) {
      throw new Error("No se pudo verificar el comprobante del pedido.");
    }

    const searchParams = new URLSearchParams();
    searchParams.set("receiptCode", currentReceiptCode);
    if (options?.syncPaymentId) {
      searchParams.set("syncPaymentId", options.syncPaymentId);
    }

    const requestPath = `/api/payments/order/${orderId}?${searchParams.toString()}`;

    const response = await fetch(requestPath, {
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
    const deliveryDate = payload.order.deliveryDate.split("T")[0] ?? payload.order.deliveryDate;
    setDate(deliveryDate);
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
  }, [getCurrentReceiptCode]);

  useEffect(() => {
    if (!createdOrderId) return;

    let cancelled = false;

    void (async () => {
      setLoadingPaymentView(true);
      try {
        const snapshot = await refreshPaymentSnapshot(createdOrderId, {
          syncPaymentId: returnPaymentId,
        });
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
  }, [
    createdOrderId,
    refreshCheckoutSession,
    refreshPaymentSnapshot,
    returnPaymentId,
    returnPaymentState,
  ]);

  function resetPaymentFlow(targetStep: StepIndex, message: string | null = null) {
    setCreatedOrderId(null);
    setCheckoutSession(null);
    setPaymentSnapshot(null);
    setPaymentResult(null);
    setSubmittedCode(null);
    setReturnPaymentState(null);
    setReturnPaymentId(null);
    setLoadingPaymentView(false);
    setCheckingStatus(false);
    setPaymentChoice("wallet");
    setSubmitError(message);
    setStep(targetStep);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("order");
    nextUrl.searchParams.delete("code");
    nextUrl.searchParams.delete("payment");
    nextUrl.searchParams.delete("payment_id");
    nextUrl.searchParams.delete("collection_id");
    nextUrl.searchParams.delete("collection_status");
    nextUrl.searchParams.delete("status");
    nextUrl.searchParams.delete("external_reference");
    nextUrl.searchParams.delete("merchant_order_id");
    nextUrl.searchParams.delete("preference_id");
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
    scrollPageToTop();

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
      if (createOrderResult.publicReceiptCode) {
        nextUrl.searchParams.set("code", createOrderResult.publicReceiptCode);
      }
      nextUrl.searchParams.delete("payment");
      window.history.replaceState({}, "", nextUrl);

      await refreshCheckoutSession(
        createOrderResult.orderId,
        createOrderResult.publicReceiptCode ?? null,
      );
      await refreshPaymentSnapshot(createOrderResult.orderId, {
        receiptCode: createOrderResult.publicReceiptCode ?? null,
      });

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
      const snapshot = await refreshPaymentSnapshot(createdOrderId, {
        syncPaymentId: returnPaymentId,
      });
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
      await refreshPaymentSnapshot(createdOrderId, {
        syncPaymentId: result.payment.providerPaymentId,
      });
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
              className={`step-card rounded-xl px-2 py-2 text-center transition sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left ${
                isActive
                  ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_8px_18px_rgba(43,26,24,0.16)]"
                  : "bg-white/58 text-[var(--chocolate)]/70 shadow-[0_5px_14px_rgba(43,26,24,0.055)] hover:bg-white/82 hover:shadow-[0_8px_18px_rgba(43,26,24,0.085)] disabled:opacity-45 disabled:hover:bg-white/58 disabled:hover:shadow-[0_5px_14px_rgba(43,26,24,0.055)]"
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
    <>
      <div
        className={`grid w-full min-w-0 gap-5 md:gap-6 lg:items-start ${
          currentView === "builder"
            ? "lg:grid-cols-1 lg:justify-items-center"
            : "lg:grid-cols-[0.72fr_1.28fr]"
        }`}
      >
      {currentView !== "builder" ? (
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
      ) : null}

      {currentView === "builder" ? (
        <form
          className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:max-w-[70rem] lg:p-8 xl:max-w-[74rem]"
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
              </div>

              <div className="mt-4 space-y-5 sm:mt-6 sm:space-y-6 lg:mt-7 lg:space-y-4">
                {catalog.flavors.map((flavor) => (
                  <article className="py-1" key={flavor.id}>
                    <div className="grid gap-3 sm:gap-5 lg:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] lg:items-center lg:gap-5">
                      <div className="flex min-h-full items-start justify-between gap-3 lg:min-h-[8.25rem] lg:flex-col lg:items-start lg:justify-center lg:gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-2xl leading-none text-[var(--chocolate-deep)] sm:text-3xl lg:text-[2.35rem]">
                            {flavor.name}
                          </h3>
                          <p className="mt-1 min-w-0 text-xs leading-5 text-[var(--chocolate)]/70 sm:text-sm sm:leading-6 lg:max-w-[12rem]">
                            {flavor.description}
                          </p>
                        </div>
                        <button
                          aria-label={`Ver foto de ${flavor.name}`}
                          className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full bg-white/75 px-2.5 uppercase tracking-[0.1em] text-[var(--chocolate)] shadow-[0_4px_12px_rgba(43,26,24,0.075)] transition hover:bg-[var(--milk)] hover:shadow-[0_6px_16px_rgba(43,26,24,0.1)] sm:h-8 lg:px-3"
                          onClick={() => setPhotoFlavor(flavor)}
                          type="button"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span className="text-[0.48rem] font-semibold sm:text-[0.52rem]">Ver foto</span>
                        </button>
                      </div>

                      <div className="grid min-w-0 grid-cols-3 gap-2 lg:gap-3">
                        {flavor.prices.map((price) => {
                          const key = itemKey(flavor.id, price.sizeId);
                          const quantity = quantities[key] ?? 0;
                          const size = sizeLookup.get(price.sizeId);
                          const mobileSizeWeight = getMobileSizeWeight(size);

                          return (
                            <div
                              className={`order-card flex min-h-[5.35rem] flex-col justify-between rounded-[1rem] p-1.5 transition sm:min-h-36 sm:rounded-[1.35rem] sm:p-3 lg:min-h-[8.25rem] lg:rounded-[1.2rem] lg:p-3.5 ${
                                quantity > 0
                                  ? "bg-[var(--cream)] shadow-[0_10px_24px_rgba(43,26,24,0.13)]"
                                  : "bg-white/62 shadow-[0_7px_18px_rgba(43,26,24,0.075)]"
                              }`}
                              key={key}
                            >
                              <div className="flex flex-col gap-2 px-1 pt-1 sm:flex-row sm:items-start sm:justify-between sm:px-1.5 sm:pt-1.5 lg:min-h-[4.4rem] lg:flex-col lg:justify-start lg:gap-1 lg:px-2 lg:pt-2">
                                <div className="flex items-center justify-between gap-1 sm:block">
                                  <p className="text-xs font-medium leading-none tracking-[0] sm:text-base sm:leading-normal lg:text-[0.95rem]">
                                    {price.sizeName}
                                  </p>
                                  {mobileSizeWeight ? (
                                    <p className="flex shrink-0 items-center text-right text-[0.58rem] font-medium leading-none tracking-[0] text-[var(--chocolate)]/58 sm:hidden">
                                      {mobileSizeWeight}
                                    </p>
                                  ) : null}
                                  <p className="mt-1 hidden text-xs text-[var(--chocolate)]/62 sm:block lg:whitespace-nowrap lg:text-[0.72rem]">
                                    {getSizeDetail(size)}
                                  </p>
                                </div>
                                <p className="font-mono text-[0.56rem] text-[var(--chocolate)]/72 sm:text-xs lg:mt-1.5 lg:text-[0.78rem]">
                                  {formatMoney(price.amountArs)}
                                </p>
                              </div>
                              <div className="mt-2 flex h-7 w-full items-center justify-between self-center rounded-full bg-[var(--milk)] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_4px_12px_rgba(43,26,24,0.07)] sm:mt-3 sm:h-10 sm:px-2 lg:mt-auto">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                    <CalendarDays className="h-4 w-4" />
                    Disponibilidad
                  </p>
                  <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                    Las primeras 48 h quedan como preparación. Los domingos no se toman pedidos ni retiros.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    aria-label="Fechas anteriores"
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/72 text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.07)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.1)] disabled:opacity-35 disabled:hover:bg-white/72 disabled:hover:shadow-[0_5px_14px_rgba(43,26,24,0.07)]"
                    disabled={activeDatePage === 0}
                    onClick={() => setDatePage((current) => Math.max(0, current - 1))}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-10 text-center font-mono text-[0.68rem] text-[var(--chocolate)]/60"
                  >
                    {activeDatePage + 1}/{availabilityPageCount}
                  </span>
                  <button
                    aria-label="Fechas siguientes"
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/72 text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.07)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.1)] disabled:opacity-35 disabled:hover:bg-white/72 disabled:hover:shadow-[0_5px_14px_rgba(43,26,24,0.07)]"
                    disabled={activeDatePage >= availabilityPageCount - 1}
                    onClick={() =>
                      setDatePage((current) => Math.min(availabilityPageCount - 1, current + 1))
                    }
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {visibleAvailability.map((day) => {
                  const blockedReason = getDayBlockingReason(day, availabilityReference);
                  const isDisabled = Boolean(blockedReason);
                  const parts = formatCalendarDate(day.date);

                  return (
                    <button
                      className={`order-card rounded-[1rem] p-2 text-left transition sm:rounded-[1.35rem] sm:p-3 ${
                        date === day.date
                          ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_10px_24px_rgba(43,26,24,0.16)]"
                          : isDisabled
                            ? "bg-[var(--cream)] text-[var(--chocolate)]/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_12px_rgba(43,26,24,0.045)]"
                            : "bg-white/66 shadow-[0_7px_18px_rgba(43,26,24,0.075)] hover:bg-white/84 hover:shadow-[0_10px_22px_rgba(43,26,24,0.105)]"
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
                  Elegí si retirás por Devoto o si coordinamos envío por Uber.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className={`order-card rounded-[1rem] p-3 text-left transition sm:rounded-[1.35rem] sm:p-4 ${
                    mode === "pickup"
                      ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_10px_24px_rgba(43,26,24,0.16)]"
                      : "bg-white/66 shadow-[0_7px_18px_rgba(43,26,24,0.075)] hover:bg-white/84 hover:shadow-[0_10px_22px_rgba(43,26,24,0.105)]"
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
                  className={`order-card rounded-[1rem] p-3 text-left transition sm:rounded-[1.35rem] sm:p-4 ${
                    mode === "delivery"
                      ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_10px_24px_rgba(43,26,24,0.16)]"
                      : "bg-white/66 shadow-[0_7px_18px_rgba(43,26,24,0.075)] hover:bg-white/84 hover:shadow-[0_10px_22px_rgba(43,26,24,0.105)]"
                  }`}
                  data-testid="mode-delivery"
                  onClick={() => setMode("delivery")}
                  type="button"
                >
                  <Truck className="mb-2 h-4 w-4 sm:mb-3 sm:h-5 sm:w-5" />
                  <span className="block font-semibold">Uber</span>
                  <span className="mt-1 block text-sm opacity-80">Pago desde la web del producto</span>
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="step-panel mt-5 grid gap-5 sm:mt-7 sm:gap-7 xl:grid-cols-[1fr_0.82fr]">
              <div className="order-card space-y-4 rounded-[20px] bg-[var(--cream)] p-4 shadow-[0_10px_24px_rgba(43,26,24,0.09)] sm:space-y-5 sm:rounded-[24px] sm:p-5">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                    <UserRound className="h-4 w-4" />
                    Datos de contacto
                  </p>
                  <p className="mt-1.5 hidden text-sm leading-6 text-[var(--chocolate)]/68 md:block">
                    Natta usa estos datos para avisarte cuando el pedido queda confirmado.
                  </p>
                </div>

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium">Nombre</span>
                  <input
                    className="h-12 w-full rounded-[1rem] bg-white/68 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_5px_14px_rgba(43,26,24,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.18),0_7px_18px_rgba(43,26,24,0.08)] sm:h-14 sm:rounded-[1.25rem]"
                    onChange={(event) => updateCustomer("name", event.target.value)}
                    placeholder="Tu nombre"
                    value={customer.name}
                  />
                </label>

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium">Teléfono</span>
                  <input
                    className="h-12 w-full rounded-[1rem] bg-white/68 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_5px_14px_rgba(43,26,24,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.18),0_7px_18px_rgba(43,26,24,0.08)] sm:h-14 sm:rounded-[1.25rem]"
                    onChange={(event) => updateCustomer("phone", event.target.value)}
                    placeholder="Para recibir confirmación"
                    value={customer.phone}
                  />
                </label>

                {mode === "delivery" ? (
                  <label className="flex flex-col gap-3">
                    <span className="text-sm font-medium">Dirección</span>
                    <input
                      className="h-12 w-full rounded-[1rem] bg-white/68 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_5px_14px_rgba(43,26,24,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.18),0_7px_18px_rgba(43,26,24,0.08)] sm:h-14 sm:rounded-[1.25rem]"
                      onChange={(event) => updateCustomer("address", event.target.value)}
                      placeholder="Calle, número, piso o departamento"
                      value={customer.address}
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium">Notas</span>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-[1rem] bg-white/68 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_5px_14px_rgba(43,26,24,0.06)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(64,58,55,0.18),0_7px_18px_rgba(43,26,24,0.08)] sm:min-h-24 sm:rounded-[1.25rem]"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Horario preferido o aclaraciones."
                    value={notes}
                  />
                </label>
              </div>

              <aside className="order-card rounded-[20px] bg-[var(--cream)] p-4 shadow-[0_10px_24px_rgba(43,26,24,0.09)] sm:rounded-[24px] sm:p-5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                  <CreditCard className="h-4 w-4" />
                  Resumen y pago
                </p>

                <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
                  {summaryItems.map((item) => (
                    <div
                      className="flex justify-between gap-4 rounded-2xl bg-white/48 px-3 py-2 text-sm shadow-[0_4px_12px_rgba(43,26,24,0.045)] sm:px-4 sm:py-3"
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

                <div className="mt-4 space-y-2 p-3 text-sm sm:mt-5 sm:space-y-3 sm:p-4">
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

                <div className="mt-4 rounded-2xl bg-[var(--milk)] p-3 shadow-[0_6px_16px_rgba(43,26,24,0.06)] sm:mt-5 sm:p-4">
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

          <div className="mt-5 flex flex-col-reverse gap-3 pt-1 sm:mt-7 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full bg-white/68 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] disabled:opacity-0 sm:h-12 sm:text-sm"
              disabled={step === 0}
              onClick={goToPreviousStep}
              type="button"
            >
              <ArrowRight className="mr-2 h-3.5 w-3.5 rotate-180" />
              Volver
            </button>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Confirmar y pagar
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Continuar
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {currentView === "payment" ? (
        <section
          className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:p-7"
          id="pago-final"
        >
          {renderStepHeader(3, true, (targetStep) => {
            void returnToBuilder(targetStep);
          })}

          {loadingPaymentView ? (
            <div className="mt-8 flex min-h-72 flex-col items-center justify-center gap-3 rounded-[24px] bg-white/60 px-6 text-center shadow-[0_8px_22px_rgba(43,26,24,0.07)]">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--sage)]" />
              <p className="text-sm text-[var(--chocolate)]/72">
                Preparando las opciones de pago...
              </p>
            </div>
          ) : (
            <>
              {submitError ? (
                <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_5px_14px_rgba(153,27,27,0.08)]">
                  {submitError}
                </div>
              ) : null}

              {!submitError && currentPaymentStatus === "REJECTED" ? (
                <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_5px_14px_rgba(153,27,27,0.08)]">
                  El pago no se pudo acreditar. Podés volver a intentarlo.
                </div>
              ) : null}

              {!submitError &&
              currentPaymentStatus !== "REJECTED" &&
              getReturnStateMessage(returnPaymentState) ? (
                <div className="mt-5 rounded-2xl bg-white/70 px-4 py-3 text-sm text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.055)]">
                  {getReturnStateMessage(returnPaymentState)}
                </div>
              ) : null}

              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.82fr] xl:gap-7">
                <div>
                <div>
                  <button
                    className="mb-5 inline-flex h-9 items-center justify-center rounded-full bg-white/68 px-3 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] sm:h-10 sm:px-4 sm:text-[0.68rem]"
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
                      className={`rounded-[1rem] p-4 text-left transition sm:rounded-[1.35rem] ${
                        paymentChoice === "wallet"
                          ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_10px_24px_rgba(43,26,24,0.16)]"
                          : "bg-white/66 shadow-[0_7px_18px_rgba(43,26,24,0.075)] hover:bg-white/84 hover:shadow-[0_10px_22px_rgba(43,26,24,0.105)]"
                      }`}
                      onClick={() => setPaymentChoice("wallet")}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 shrink-0" />
                        <span className="font-semibold">Dinero en cuenta o QR</span>
                      </span>
                      <span className="mt-1 block text-sm opacity-80">
                        Se abre Mercado Pago para terminar el pago.
                      </span>
                    </button>

                    <button
                      className={`rounded-[1rem] p-4 text-left transition sm:rounded-[1.35rem] ${
                        paymentChoice === "card"
                          ? "bg-[var(--chocolate)] text-[var(--milk)] shadow-[0_10px_24px_rgba(43,26,24,0.16)]"
                          : "bg-white/66 shadow-[0_7px_18px_rgba(43,26,24,0.075)] hover:bg-white/84 hover:shadow-[0_10px_22px_rgba(43,26,24,0.105)]"
                      }`}
                      onClick={() => setPaymentChoice("card")}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 shrink-0" />
                        <span className="font-semibold">Tarjeta</span>
                      </span>
                      <span className="mt-1 block text-sm opacity-80">
                        Pagás sin salir de Natta.
                      </span>
                    </button>
                  </div>

                  {checkoutSession ? (
                    paymentChoice === "wallet" ? (
                      <section className="mt-5 rounded-[24px] bg-[linear-gradient(145deg,#413935_0%,#2b2521_100%)] p-5 text-[var(--milk)] shadow-[0_12px_26px_rgba(43,26,24,0.16)]">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                            <QrCode className="h-5 w-5" />
                          </span>
                          <h3 className="text-2xl font-semibold">Abrir Mercado Pago</h3>
                        </div>
                        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--milk)]/75">
                          Se abre Mercado Pago para terminar el pago con saldo en cuenta o con el QR disponible.
                        </p>
                        <button
                          className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--milk)] px-5 text-sm font-semibold text-[var(--chocolate-deep)] transition hover:bg-[var(--caramel-soft)]"
                          onClick={openWalletPayment}
                          type="button"
                        >
                          <QrCode className="h-4 w-4" />
                          <span>Abrir Mercado Pago</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </section>
                    ) : (
                      <section className="mt-5 rounded-[24px] bg-white/82 p-4 shadow-[0_8px_22px_rgba(43,26,24,0.075)] sm:p-5">
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
                    <section className="mt-5 rounded-2xl bg-white/70 p-4 text-sm text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.055)]">
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

                  <div className="mt-5 grid grid-cols-2 gap-2 text-sm text-[var(--chocolate)]/82 sm:inline-grid">
                    <button
                      className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/68 px-2 text-[0.44rem] font-semibold uppercase tracking-[0.07em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] sm:px-3 sm:text-[0.5rem]"
                      disabled={checkingStatus}
                      onClick={() => {
                        void refreshPaymentStatus();
                      }}
                      style={{ fontSize: "0.5rem" }}
                      type="button"
                    >
                      {checkingStatus ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {checkingStatus ? "Revisando..." : "Actualizar estado"}
                    </button>
                    {receiptCode ? (
                      <a
                        className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/68 px-2 text-[0.54rem] font-semibold uppercase tracking-[0.08em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] sm:px-3 sm:text-[0.62rem]"
                        href={`/comprobante/${receiptCode}`}
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        Ver comprobante
                      </a>
                    ) : null}
                    {paymentReceiptUrl ? (
                      <a
                        className="col-span-2 inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/68 px-2 text-[0.54rem] font-semibold uppercase tracking-[0.08em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] sm:col-span-1 sm:px-3 sm:text-[0.62rem]"
                        href={paymentReceiptUrl}
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        Ver constancia del pago
                      </a>
                    ) : null}
                  </div>
                </div>

                <aside className="order-card rounded-[22px] bg-[var(--cream)] p-4 shadow-[0_10px_24px_rgba(43,26,24,0.09)] sm:rounded-[24px] sm:p-5">
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
                        className="flex justify-between gap-4 rounded-2xl bg-white/48 px-3 py-2 text-sm shadow-[0_4px_12px_rgba(43,26,24,0.045)] sm:px-4 sm:py-3"
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

                  <div className="mt-4 space-y-2 p-3 text-sm sm:space-y-3 sm:p-4">
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

                  <div className="mt-4 rounded-2xl bg-white/80 p-4 shadow-[0_6px_16px_rgba(43,26,24,0.06)]">
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
        <section className="w-full min-w-0 overflow-visible p-0 text-[var(--chocolate)] sm:rounded-[24px] sm:bg-[var(--milk)] sm:p-6 sm:image-shadow lg:p-7">
          {renderStepHeader(3, false)}

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.82fr] xl:gap-7">
            <div className="rounded-[24px] bg-[var(--cream)] p-5 shadow-[0_10px_24px_rgba(43,26,24,0.09)] sm:p-6">
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
                  >
                    Ver comprobante
                  </a>
                ) : null}
                {paymentReceiptUrl ? (
                  <a
                    className="inline-flex h-11 items-center justify-center rounded-full bg-white/68 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--chocolate)] shadow-[0_5px_14px_rgba(43,26,24,0.06)] transition hover:bg-white hover:shadow-[0_7px_18px_rgba(43,26,24,0.09)] sm:h-12 sm:text-sm"
                    href={paymentReceiptUrl}
                  >
                    Ver constancia del pago
                  </a>
                ) : null}
              </div>
            </div>

            <aside className="order-card rounded-[20px] bg-[var(--cream)] p-4 shadow-[0_10px_24px_rgba(43,26,24,0.09)] sm:rounded-[24px] sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sage)] sm:text-sm sm:tracking-[0.2em]">
                Resumen del pedido
              </p>

              <div className="mt-4 space-y-2 sm:space-y-3">
                {summaryItems.map((item) => (
                  <div
                    className="flex justify-between gap-4 rounded-2xl bg-white/48 px-3 py-2 text-sm shadow-[0_4px_12px_rgba(43,26,24,0.045)] sm:px-4 sm:py-3"
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

              <div className="mt-4 space-y-2 rounded-2xl bg-white/44 p-3 text-sm shadow-[0_4px_12px_rgba(43,26,24,0.045)] sm:space-y-3 sm:p-4">
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

              <div className="mt-4 rounded-2xl bg-white/80 p-4 shadow-[0_6px_16px_rgba(43,26,24,0.06)]">
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

      {photoFlavor && modalPhoto ? (
        <div
          aria-labelledby="flavor-photo-title"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-7"
          role="dialog"
        >
          <button
            aria-label="Cerrar foto"
            className="absolute inset-0 bg-[var(--chocolate-deep)]/42 backdrop-blur-md"
            onClick={() => setPhotoFlavor(null)}
            type="button"
          />

          <article className="image-shadow relative w-full max-w-[27rem] overflow-hidden rounded-[28px] border border-white/55 bg-[var(--milk)] text-[var(--chocolate)]">
            <div className="absolute inset-0 opacity-20">
              <img
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
                decoding="async"
                loading="lazy"
                src={modalPhoto.src}
              />
            </div>

            <div className="relative p-2">
              <div className="relative aspect-[9/10] overflow-hidden rounded-[22px] bg-[var(--cream)]">
                <img
                  alt={modalPhoto.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                  src={modalPhoto.src}
                />
              </div>

              <button
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/60 bg-[var(--milk)]/86 text-[var(--chocolate)] shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-white"
                onClick={() => setPhotoFlavor(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="px-4 pb-5 pt-5 sm:px-5 sm:pb-6">
                <h3
                  className="font-display text-4xl leading-none text-[var(--chocolate-deep)]"
                  id="flavor-photo-title"
                >
                  {photoFlavor.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--chocolate)]/72 sm:text-base sm:leading-7">
                  {photoFlavor.description}
                </p>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
