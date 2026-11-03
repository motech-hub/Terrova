import { getPaydunyaConfig } from "@/src/lib/env";
import type { PurchasableProduct } from "@/src/config/billing";

export type PaydunyaPaymentStatus = "pending" | "completed" | "cancelled" | "failed";

export type PaydunyaPayment = {
  token: string;
  status: PaydunyaPaymentStatus;
  amountXof: number;
  hash?: string;
  transactionId?: string;
};

type JsonObject = Record<string, unknown>;

const PAYDUNYA_CHECKOUT_HOSTS = new Set(["app.paydunya.com", "paydunya.com"]);

export class PaydunyaApiError extends Error {
  readonly httpStatus: number;
  readonly responseCode: string;
  readonly responseText?: string;

  constructor(httpStatus: number, responseCode: string, responseText?: string) {
    super(`PayDunya a refusé la requête (${httpStatus}, ${responseCode}).`);
    this.name = "PaydunyaApiError";
    this.httpStatus = httpStatus;
    this.responseCode = responseCode;
    this.responseText = responseText?.slice(0, 240);
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asAmount(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

function normalizeStatus(value: unknown): PaydunyaPaymentStatus {
  const status = String(value ?? "pending").toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "failed") return status;
  return "pending";
}

function getDataEnvelope(payload: unknown): JsonObject {
  if (!isObject(payload)) return {};
  if (isObject(payload.data)) return payload.data;
  if (typeof payload.data === "string") {
    try {
      const parsed = JSON.parse(payload.data) as unknown;
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return payload;
}

export function readPaydunyaPayment(payload: unknown): PaydunyaPayment | null {
  const data = getDataEnvelope(payload);
  const invoice = isObject(data.invoice) ? data.invoice : {};
  const token = asText(invoice.token) ?? asText(data.token);
  const amountXof = asAmount(invoice.total_amount) ?? asAmount(data.total_amount);
  if (!token || !amountXof) return null;

  return {
    token,
    status: normalizeStatus(data.status),
    amountXof,
    hash: asText(data.hash),
    transactionId: asText(data.transaction_id) ?? asText(data.transactionId),
  };
}

async function sha512Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPaydunyaHash(hash: string | undefined) {
  const config = getPaydunyaConfig();
  if (!config || !hash) return false;
  const expected = await sha512Hex(config.masterKey);
  if (expected.length !== hash.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ hash.charCodeAt(index);
  }
  return difference === 0;
}

async function requestPaydunya(path: string, init: RequestInit) {
  const config = getPaydunyaConfig();
  if (!config) throw new Error("PayDunya n'est pas configuré.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "PAYDUNYA-MASTER-KEY": config.masterKey,
        "PAYDUNYA-PRIVATE-KEY": config.privateKey,
        "PAYDUNYA-TOKEN": config.token,
        ...(init.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => null)) as JsonObject | null;
    if (!response.ok || payload?.response_code !== "00") {
      throw new PaydunyaApiError(
        response.status,
        typeof payload?.response_code === "string" ? payload.response_code : "REPONSE_INVALIDE",
        typeof payload?.response_text === "string" ? payload.response_text : undefined,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function validateCheckoutUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("PayDunya n'a pas retourné d'URL de paiement.");
  const url = new URL(value);
  if (url.protocol !== "https:" || !PAYDUNYA_CHECKOUT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("PayDunya a retourné une URL de paiement non autorisée.");
  }
  return url.toString();
}

function testLabel(value: string, fallback: string) {
  const safeValue = value
    .replace(/^test[_ -]*/i, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `TEST_${safeValue || fallback}`;
}

export async function createPaydunyaInvoice(input: {
  orderId: string;
  product: PurchasableProduct;
  customer?: { name?: string; email?: string; phone?: string };
  returnUrl?: string;
}) {
  const config = getPaydunyaConfig();
  if (!config) throw new Error("PayDunya n'est pas configuré.");

  const isTestMode = config.mode === "test";
  const invoiceName = isTestMode
    ? testLabel(`${input.product.productType}_${input.product.productId}`, "PAIEMENT")
    : input.product.name;
  const invoiceDescription = isTestMode
    ? "TEST_PAIEMENT_PAYDUNYA"
    : `${input.product.name} — ${input.product.credits} crédits Terrova`;
  const itemDescription = isTestMode ? "TEST_OFFRE_PAYDUNYA" : input.product.description;
  const customData = isTestMode
    ? {
        test_reference: testLabel(input.orderId, "COMMANDE"),
        test_product: invoiceName,
        test_credits: input.product.credits,
      }
    : {
        order_id: input.orderId,
        product_type: input.product.productType,
        product_id: input.product.productId,
        credits: input.product.credits,
      };

  const payload: JsonObject = {
    invoice: {
      total_amount: input.product.priceXof,
      description: invoiceDescription,
      items: {
        item_0: {
          name: invoiceName,
          quantity: 1,
          unit_price: String(input.product.priceXof),
          total_price: String(input.product.priceXof),
          description: itemDescription,
        },
      },
      ...(input.customer && !isTestMode ? { customer: input.customer } : {}),
    },
    store: { name: isTestMode ? "TEST_PAYDUNYA" : config.storeName },
    custom_data: customData,
    actions: {
      cancel_url: config.cancelUrl,
      return_url: input.returnUrl ?? config.returnUrl,
      callback_url: config.callbackUrl,
    },
  };

  const response = await requestPaydunya("/v1/checkout-invoice/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const token = asText(response.token);
  if (!token) throw new Error("PayDunya n'a pas retourné de token de facture.");
  return { token, checkoutUrl: validateCheckoutUrl(response.response_text) };
}

export async function confirmPaydunyaInvoice(token: string) {
  const response = await requestPaydunya(`/v1/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    method: "GET",
  });
  const payment = readPaydunyaPayment(response);
  if (!payment) throw new Error("PayDunya a retourné une confirmation invalide.");
  return payment;
}
