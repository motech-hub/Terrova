import type { PurchasableProduct } from "@/src/config/billing";
import { getCloudflareBindings } from "@/src/lib/cloudflare";
import { grantPurchasedCredits } from "@/src/lib/credits/credit-store";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { PaydunyaPayment } from "@/src/lib/payments/paydunya";

export type PaymentOrder = {
  orderId: string;
  sessionId: string;
  productType: "plan" | "pack";
  productId: string;
  productName: string;
  credits: number;
  amountXof: number;
  currency: "XOF";
  provider: "paydunya";
  status: "pending" | "completed" | "cancelled" | "failed";
  providerToken?: string;
  checkoutUrl?: string;
  providerTransactionId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

const memoryOrders = new Map<string, PaymentOrder>();

function getDatabase() {
  try {
    return getCloudflareBindings().DB;
  } catch {
    return undefined;
  }
}

function toTimestamp(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function rowToOrder(row: Record<string, unknown>): PaymentOrder {
  return {
    orderId: String(row.order_id),
    sessionId: String(row.user_id ?? row.session_id),
    productType: row.product_type === "plan" ? "plan" : "pack",
    productId: String(row.product_id),
    productName: String(row.product_name),
    credits: Number(row.credits),
    amountXof: Number(row.amount_xof),
    currency: "XOF",
    provider: "paydunya",
    status: row.status === "completed" || row.status === "cancelled" || row.status === "failed" ? row.status : "pending",
    ...(row.provider_token ? { providerToken: String(row.provider_token) } : {}),
    ...(row.checkout_url ? { checkoutUrl: String(row.checkout_url) } : {}),
    ...(row.provider_transaction_id ? { providerTransactionId: String(row.provider_transaction_id) } : {}),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
    ...(row.completed_at ? { completedAt: toTimestamp(row.completed_at) } : {}),
  };
}

export async function createPaymentOrder(sessionId: string, product: PurchasableProduct) {
  const orderId = crypto.randomUUID();
  const now = Date.now();
  const order: PaymentOrder = {
    orderId,
    sessionId,
    productType: product.productType,
    productId: product.productId,
    productName: product.name,
    credits: product.credits,
    amountXof: product.priceXof,
    currency: "XOF",
    provider: "paydunya",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("orders").insert({
      order_id: order.orderId,
      user_id: order.sessionId,
      product_type: order.productType,
      product_id: order.productId,
      product_name: order.productName,
      credits: order.credits,
      amount_xof: order.amountXof,
      currency: order.currency,
      provider: order.provider,
      status: order.status,
    });
    if (error) throw error;
    return order;
  }

  const database = getDatabase();
  if (database) {
    await database.prepare(
      `INSERT INTO orders
       (order_id, session_id, product_type, product_id, product_name, credits, amount_xof, currency, provider, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'XOF', 'paydunya', 'pending', ?8, ?8)`,
    ).bind(order.orderId, order.sessionId, order.productType, order.productId, order.productName, order.credits, order.amountXof, now).run();
    return order;
  }

  memoryOrders.set(order.orderId, order);
  return order;
}

export async function attachPaydunyaInvoice(orderId: string, token: string, checkoutUrl: string, amountXof: number) {
  const now = Date.now();
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error: orderError } = await supabase.from("orders").update({
      provider_token: token,
      checkout_url: checkoutUrl,
      updated_at: new Date(now).toISOString(),
    }).eq("order_id", orderId);
    if (orderError) throw orderError;
    const { error: paymentError } = await supabase.from("payments").upsert({
      order_id: orderId,
      provider: "paydunya",
      provider_token: token,
      status: "pending",
      amount_xof: amountXof,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "provider,provider_token" });
    if (paymentError) throw paymentError;
    return;
  }

  const database = getDatabase();
  if (database) {
    const order = await getPaymentOrder(orderId);
    if (!order) throw new Error("Commande introuvable.");
    await database.prepare(
      "UPDATE orders SET provider_token = ?1, checkout_url = ?2, updated_at = ?3 WHERE order_id = ?4",
    ).bind(token, checkoutUrl, now, orderId).run();
    await database.prepare(
      `INSERT INTO payments
       (payment_id, order_id, provider, provider_token, status, amount_xof, created_at, updated_at)
       VALUES (?1, ?2, 'paydunya', ?3, 'pending', ?4, ?5, ?5)
       ON CONFLICT(provider, provider_token) DO UPDATE SET updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), orderId, token, order.amountXof, now).run();
    return;
  }

  const order = memoryOrders.get(orderId);
  if (order) memoryOrders.set(orderId, { ...order, providerToken: token, checkoutUrl, updatedAt: now });
}

export async function getPaymentOrder(orderId: string) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from("orders").select("*").eq("order_id", orderId).maybeSingle();
    if (error) throw error;
    return data ? rowToOrder(data) : null;
  }

  const database = getDatabase();
  if (database) {
    const row = await database.prepare("SELECT * FROM orders WHERE order_id = ?1").bind(orderId).first<Record<string, unknown>>();
    return row ? rowToOrder(row) : null;
  }
  return memoryOrders.get(orderId) ?? null;
}

export async function getPaymentOrderByToken(token: string) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from("orders").select("*").eq("provider", "paydunya").eq("provider_token", token).maybeSingle();
    if (error) throw error;
    return data ? rowToOrder(data) : null;
  }

  const database = getDatabase();
  if (database) {
    const row = await database.prepare("SELECT * FROM orders WHERE provider = 'paydunya' AND provider_token = ?1").bind(token).first<Record<string, unknown>>();
    return row ? rowToOrder(row) : null;
  }
  return Array.from(memoryOrders.values()).find((order) => order.providerToken === token) ?? null;
}

export async function updatePaymentOrderStatus(orderId: string, status: PaymentOrder["status"]) {
  const now = Date.now();
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date(now).toISOString() }).eq("order_id", orderId).neq("status", "completed");
    if (error) throw error;
    return;
  }
  const database = getDatabase();
  if (database) {
    await database.prepare("UPDATE orders SET status = ?1, updated_at = ?2 WHERE order_id = ?3 AND status <> 'completed'").bind(status, now, orderId).run();
    return;
  }
  const order = memoryOrders.get(orderId);
  if (order && order.status !== "completed") memoryOrders.set(orderId, { ...order, status, updatedAt: now });
}

export async function reconcilePaydunyaPayment(payment: PaydunyaPayment) {
  const order = await getPaymentOrderByToken(payment.token);
  if (!order) throw new Error("Commande PayDunya introuvable.");
  if (order.amountXof !== payment.amountXof) throw new Error("Le montant PayDunya ne correspond pas à la commande.");

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("complete_paydunya_order", {
      p_order_id: order.orderId,
      p_provider_token: payment.token,
      p_status: payment.status,
      p_amount_xof: payment.amountXof,
      p_provider_transaction_id: payment.transactionId ?? null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row && typeof row === "object" ? rowToOrder(row as Record<string, unknown>) : getPaymentOrder(order.orderId);
  }

  const database = getDatabase();
  if (database) {
    const now = Date.now();
    await database.prepare(
      `INSERT INTO payments
       (payment_id, order_id, provider, provider_token, provider_transaction_id, status, amount_xof, created_at, updated_at)
       VALUES (?1, ?2, 'paydunya', ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT(provider, provider_token) DO UPDATE SET
         provider_transaction_id = coalesce(excluded.provider_transaction_id, payments.provider_transaction_id),
         status = excluded.status,
         amount_xof = excluded.amount_xof,
         updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), order.orderId, payment.token, payment.transactionId ?? null, payment.status, payment.amountXof, now).run();
    if (payment.status === "completed" && order.status !== "completed") {
      await grantPurchasedCredits(order.sessionId, order.credits, order.orderId);
      await database.prepare(
        "UPDATE orders SET status = 'completed', provider_transaction_id = ?1, completed_at = coalesce(completed_at, ?2), updated_at = ?2 WHERE order_id = ?3",
      ).bind(payment.transactionId ?? null, now, order.orderId).run();
    } else {
      await database.prepare("UPDATE orders SET status = ?1, updated_at = ?2 WHERE order_id = ?3 AND status <> 'completed'").bind(payment.status, now, order.orderId).run();
    }
    return getPaymentOrder(order.orderId);
  }

  if (payment.status === "completed" && order.status !== "completed") {
    await grantPurchasedCredits(order.sessionId, order.credits, order.orderId);
  }
  const updated = {
    ...order,
    status: payment.status === "completed" ? "completed" : order.status === "completed" ? "completed" : payment.status,
    ...(payment.transactionId ? { providerTransactionId: payment.transactionId } : {}),
    ...(payment.status === "completed" ? { completedAt: Date.now() } : {}),
    updatedAt: Date.now(),
  } satisfies PaymentOrder;
  memoryOrders.set(order.orderId, updated);
  return updated;
}
