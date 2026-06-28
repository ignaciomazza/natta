import crypto from "node:crypto";

const MERCADOPAGO_API_BASE = "https://api.mercadopago.com";
const MERCADOPAGO_ENVIRONMENTS = ["test", "production"] as const;

export type MercadoPagoEnvironment = (typeof MERCADOPAGO_ENVIRONMENTS)[number];

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
  external_reference?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status?: string;
  status_detail?: string;
  date_approved?: string;
  date_created?: string;
  transaction_amount?: number;
  external_reference?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_details?: {
    external_resource_url?: string;
    financial_institution?: string | null;
    payment_method_reference_id?: string;
    total_paid_amount?: number;
  };
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

export class MercadoPagoConfigError extends Error {
  constructor(message = "Mercado Pago no esta configurado") {
    super(message);
    this.name = "MercadoPagoConfigError";
  }
}

function isMercadoPagoEnvironment(value: string): value is MercadoPagoEnvironment {
  return MERCADOPAGO_ENVIRONMENTS.includes(value as MercadoPagoEnvironment);
}

export function getMercadoPagoEnvironment() {
  const rawValue = process.env.MERCADOPAGO_ENV?.trim().toLowerCase();
  if (!rawValue) return "test" as const;
  if (isMercadoPagoEnvironment(rawValue)) return rawValue;

  throw new MercadoPagoConfigError(
    "MERCADOPAGO_ENV debe ser 'test' o 'production'",
  );
}

function getMercadoPagoCredentialValue(
  type: "publicKey" | "accessToken" | "webhookSecret",
  environment = getMercadoPagoEnvironment(),
) {
  const keyByType = {
    publicKey: {
      production: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_PRODUCTION,
      test: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_TEST,
      legacy: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
    },
    accessToken: {
      production: process.env.MERCADOPAGO_ACCESS_TOKEN_PRODUCTION,
      test: process.env.MERCADOPAGO_ACCESS_TOKEN_TEST,
      legacy: process.env.MERCADOPAGO_ACCESS_TOKEN,
    },
    webhookSecret: {
      production: process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION,
      test: process.env.MERCADOPAGO_WEBHOOK_SECRET_TEST,
      legacy: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    },
  } as const;

  const entry = keyByType[type];
  return entry[environment] ?? entry.legacy ?? null;
}

function getAccessToken() {
  const token = getMercadoPagoCredentialValue("accessToken");
  if (!token) {
    throw new MercadoPagoConfigError(
      "Falta configurar el Access Token de Mercado Pago",
    );
  }
  return token;
}

export function getMercadoPagoPublicKey() {
  const key = getMercadoPagoCredentialValue("publicKey");
  if (!key) {
    throw new MercadoPagoConfigError(
      "Falta configurar la Public Key de Mercado Pago",
    );
  }
  return key;
}

export function getMercadoPagoCheckoutUrl(
  preference: MercadoPagoPreferenceResponse,
  environment = getMercadoPagoEnvironment(),
) {
  if (environment === "production") {
    return preference.init_point ?? preference.sandbox_init_point ?? null;
  }

  return preference.sandbox_init_point ?? preference.init_point ?? null;
}

async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...init.headers,
    },
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string; error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      data?.message ?? data?.error ?? `Mercado Pago respondio ${response.status}`,
    );
  }

  if (!data) {
    throw new Error("Mercado Pago respondio sin datos");
  }

  return data;
}

export function getAppUrl(environment = getMercadoPagoEnvironment()) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (appUrl) {
    if (
      environment === "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(appUrl)
    ) {
      throw new MercadoPagoConfigError(
        "NEXT_PUBLIC_APP_URL no puede apuntar a localhost en production",
      );
    }

    return appUrl;
  }

  if (environment === "production") {
    throw new MercadoPagoConfigError(
      "Falta configurar NEXT_PUBLIC_APP_URL en production",
    );
  }

  return "http://localhost:3000";
}

export function getMercadoPagoTicketExpirationDays() {
  const rawValue = process.env.MERCADOPAGO_TICKET_EXPIRATION_DAYS?.trim();
  if (!rawValue) return 18;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return 18;
  return Math.min(30, Math.max(1, parsed));
}

export function getMercadoPagoTicketExpirationDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + getMercadoPagoTicketExpirationDays());
  expiresAt.setHours(23, 59, 59, 0);
  return expiresAt;
}

export async function createMercadoPagoPreference(input: {
  orderId: string;
  receiptCode: string;
  externalReference: string;
  title: string;
  amountArs: number;
  customerName?: string | null;
  customerEmail?: string | null;
  environment?: MercadoPagoEnvironment;
}) {
  const appUrl = getAppUrl(input.environment);
  const getBackUrl = (payment: "success" | "failure" | "pending") => {
    const params = new URLSearchParams({
      order: input.orderId,
      code: input.receiptCode,
      payment,
    });
    return `${appUrl}/pedido?${params.toString()}`;
  };

  return mercadoPagoRequest<MercadoPagoPreferenceResponse>(
    "/checkout/preferences",
    {
      headers: {
        Authorization: `Bearer ${getAccessTokenForEnvironment(input.environment)}`,
      },
      method: "POST",
      body: JSON.stringify({
        purpose: "wallet_purchase",
        external_reference: input.externalReference,
        statement_descriptor: "NATTA",
        payer: {
          name: input.customerName ?? undefined,
          email: input.customerEmail ?? undefined,
        },
        items: [
          {
            title: input.title,
            quantity: 1,
            currency_id: "ARS",
            unit_price: Number(input.amountArs.toFixed(2)),
          },
        ],
        notification_url: `${appUrl}/api/payments/webhook`,
        back_urls: {
          success: getBackUrl("success"),
          failure: getBackUrl("failure"),
          pending: getBackUrl("pending"),
        },
        auto_return: "approved",
      }),
    },
  );
}

type MercadoPagoCreatePaymentInput = {
  amountArs: number;
  description: string;
  paymentMethodId: string;
  externalReference: string;
  payerEmail: string;
  payerFirstName?: string | null;
  payerLastName?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  token?: string | null;
  issuerId?: string | null;
  installments?: number | null;
  dateOfExpiration?: string | null;
  additionalInfo?: Record<string, unknown>;
  idempotencyKey: string;
  environment?: MercadoPagoEnvironment;
};

export async function createMercadoPagoPayment(
  input: MercadoPagoCreatePaymentInput,
) {
  const appUrl = getAppUrl();

  return mercadoPagoRequest<MercadoPagoPaymentResponse>("/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessTokenForEnvironment(input.environment)}`,
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amountArs.toFixed(2)),
      description: input.description,
      payment_method_id: input.paymentMethodId,
      token: input.token ?? undefined,
      issuer_id: input.issuerId ?? undefined,
      installments: input.installments ?? undefined,
      date_of_expiration: input.dateOfExpiration ?? undefined,
      external_reference: input.externalReference,
      notification_url: `${appUrl}/api/payments/webhook`,
      statement_descriptor: "NATTA",
      payer: {
        email: input.payerEmail,
        first_name: input.payerFirstName ?? undefined,
        last_name: input.payerLastName ?? undefined,
        identification:
          input.identificationType && input.identificationNumber
            ? {
                type: input.identificationType,
                number: input.identificationNumber,
              }
            : undefined,
      },
      additional_info: input.additionalInfo ?? undefined,
    }),
  });
}

function getAccessTokenForEnvironment(
  environment = getMercadoPagoEnvironment(),
) {
  const token = getMercadoPagoCredentialValue("accessToken", environment);
  if (!token) {
    throw new MercadoPagoConfigError(
      `Falta configurar el Access Token de Mercado Pago para ${environment}`,
    );
  }
  return token;
}

export async function getMercadoPagoPayment(
  paymentId: string,
  environment?: MercadoPagoEnvironment,
) {
  return mercadoPagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${getAccessTokenForEnvironment(environment)}`,
    },
  });
}

export function mapMercadoPagoPaymentStatus(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return "APPROVED" as const;
    case "rejected":
      return "REJECTED" as const;
    case "cancelled":
    case "expired":
      return "CANCELLED" as const;
    case "refunded":
    case "charged_back":
      return "REFUNDED" as const;
    default:
      return "PENDING" as const;
  }
}

export function verifyMercadoPagoWebhookSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  environment?: MercadoPagoEnvironment;
  secret?: string;
}) {
  const secret =
    input.secret ??
    getMercadoPagoCredentialValue(
      "webhookSecret",
      input.environment ?? getMercadoPagoEnvironment(),
    );
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!input.signature || !input.requestId || !input.dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    input.signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) {
    return false;
  }

  const normalizedDataId =
    /^[a-z0-9]+$/i.test(input.dataId) && /[a-z]/i.test(input.dataId)
      ? input.dataId.toLowerCase()
      : input.dataId;
  const manifest = `id:${normalizedDataId};request-id:${input.requestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(hash, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
