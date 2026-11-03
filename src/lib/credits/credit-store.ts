import { defaultBillingPlan } from "@/src/config/billing";
import { getCloudflareBindings } from "@/src/lib/cloudflare";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export type CreditWallet = {
  sessionId: string;
  planId: string;
  balance: number;
  reserved: number;
  available: number;
  createdAt: number;
  updatedAt: number;
};

export class InsufficientCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(balance: number, required: number) {
    super(`Crédits insuffisants. ${required} crédits sont nécessaires, ${balance} sont disponibles.`);
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.required = required;
  }
}

const memoryWallets = new Map<string, CreditWallet>();
const memoryLedgerReferences = new Set<string>();

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

function rowToWallet(row: Record<string, unknown>): CreditWallet {
  const balance = Number(row.balance);
  const reserved = Number(row.reserved);
  return {
    sessionId: String(row.user_id ?? row.session_id),
    planId: String(row.plan_id),
    balance,
    reserved,
    available: Math.max(0, balance),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function firstRpcRow(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function createMemoryWallet(sessionId: string) {
  const now = Date.now();
  const wallet: CreditWallet = {
    sessionId,
    planId: defaultBillingPlan.id,
    balance: defaultBillingPlan.credits,
    reserved: 0,
    available: defaultBillingPlan.credits,
    createdAt: now,
    updatedAt: now,
  };
  memoryWallets.set(sessionId, wallet);
  return wallet;
}

async function ensureSupabaseWallet(sessionId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return undefined;

  const existing = await supabase
    .from("credit_wallets")
    .select("*")
    .eq("user_id", sessionId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return rowToWallet(existing.data);

  const created = await supabase
    .from("credit_wallets")
    .insert({ user_id: sessionId, plan_id: defaultBillingPlan.id, balance: defaultBillingPlan.credits, reserved: 0 })
    .select()
    .single();
  if (created.error) {
    const retried = await supabase
      .from("credit_wallets")
      .select("*")
      .eq("user_id", sessionId)
      .single();
    if (retried.error) throw created.error;
    return rowToWallet(retried.data);
  }
  return rowToWallet(created.data);
}

async function getDatabaseWallet(sessionId: string) {
  const database = getDatabase();
  if (!database) return undefined;

  const now = Date.now();
  await database
    .prepare(
      `INSERT OR IGNORE INTO credit_wallets
        (session_id, plan_id, balance, reserved, created_at, updated_at)
       VALUES (?1, ?2, ?3, 0, ?4, ?4)`,
    )
    .bind(sessionId, defaultBillingPlan.id, defaultBillingPlan.credits, now)
    .run();

  const row = await database
    .prepare("SELECT * FROM credit_wallets WHERE session_id = ?1")
    .bind(sessionId)
    .first<Record<string, unknown>>();
  return row ? rowToWallet(row) : undefined;
}

export async function getCreditWallet(sessionId: string) {
  const supabaseWallet = await ensureSupabaseWallet(sessionId);
  if (supabaseWallet) return supabaseWallet;

  const databaseWallet = await getDatabaseWallet(sessionId).catch(() => undefined);
  if (databaseWallet) return databaseWallet;
  return memoryWallets.get(sessionId) ?? createMemoryWallet(sessionId);
}

export async function reserveCredits(sessionId: string, amount: number, referenceId: string) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("reserve_credits", {
      p_user_id: sessionId,
      p_amount: amount,
      p_reference_id: referenceId,
    });
    if (error) {
      if (error.message.includes("INSUFFICIENT_CREDITS")) {
        const wallet = await getCreditWallet(sessionId);
        throw new InsufficientCreditsError(wallet.available, amount);
      }
      throw error;
    }
    const wallet = firstRpcRow(data);
    if (!wallet) throw new Error("Le portefeuille Supabase est introuvable.");
    return rowToWallet(wallet);
  }

  const database = getDatabase();
  if (database) {
    await getDatabaseWallet(sessionId);
    const result = await database
      .prepare(
        `UPDATE credit_wallets
         SET balance = balance - ?1, reserved = reserved + ?1, updated_at = ?2
         WHERE session_id = ?3 AND balance >= ?1`,
      )
      .bind(amount, Date.now(), sessionId)
      .run();
    if (!result.meta.changes) {
      const wallet = await getCreditWallet(sessionId);
      throw new InsufficientCreditsError(wallet.available, amount);
    }
    await database
      .prepare(
        `INSERT INTO credit_ledger
          (entry_id, session_id, entry_type, amount, reference_id, created_at)
         VALUES (?1, ?2, 'reservation', ?3, ?4, ?5)`,
      )
      .bind(crypto.randomUUID(), sessionId, amount, referenceId, Date.now())
      .run();
    return getCreditWallet(sessionId);
  }

  const wallet = memoryWallets.get(sessionId) ?? createMemoryWallet(sessionId);
  if (wallet.available < amount) throw new InsufficientCreditsError(wallet.available, amount);
  const updated = { ...wallet, balance: wallet.balance - amount, reserved: wallet.reserved + amount, updatedAt: Date.now() };
  memoryWallets.set(sessionId, updated);
  memoryLedgerReferences.add(`reservation:${referenceId}`);
  return updated;
}

export async function consumeReservedCredits(sessionId: string, amount: number, referenceId: string) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("consume_reserved_credits", {
      p_user_id: sessionId,
      p_amount: amount,
      p_reference_id: referenceId,
    });
    if (error) throw error;
    const wallet = firstRpcRow(data);
    if (!wallet) return getCreditWallet(sessionId);
    return rowToWallet(wallet);
  }

  const ledgerKey = `consumption:${referenceId}`;
  if (memoryLedgerReferences.has(ledgerKey)) return getCreditWallet(sessionId);
  const database = getDatabase();
  if (database) {
    const result = await database
      .prepare(
        `UPDATE credit_wallets
         SET reserved = reserved - ?1, updated_at = ?2
         WHERE session_id = ?3 AND reserved >= ?1`,
      )
      .bind(amount, Date.now(), sessionId)
      .run();
    if (result.meta.changes) {
      await database
        .prepare(
          `INSERT OR IGNORE INTO credit_ledger
            (entry_id, session_id, entry_type, amount, reference_id, created_at)
           VALUES (?1, ?2, 'consumption', ?3, ?4, ?5)`,
        )
        .bind(crypto.randomUUID(), sessionId, amount, referenceId, Date.now())
        .run();
    }
    return getCreditWallet(sessionId);
  }

  const wallet = memoryWallets.get(sessionId) ?? createMemoryWallet(sessionId);
  const updated = { ...wallet, reserved: Math.max(0, wallet.reserved - amount), updatedAt: Date.now() };
  memoryWallets.set(sessionId, updated);
  memoryLedgerReferences.add(ledgerKey);
  return updated;
}

export async function releaseReservedCredits(sessionId: string, amount: number, referenceId: string) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("release_reserved_credits", {
      p_user_id: sessionId,
      p_amount: amount,
      p_reference_id: referenceId,
    });
    if (error) throw error;
    const wallet = firstRpcRow(data);
    if (!wallet) return getCreditWallet(sessionId);
    return rowToWallet(wallet);
  }

  const ledgerKey = `refund:${referenceId}`;
  if (memoryLedgerReferences.has(ledgerKey)) return getCreditWallet(sessionId);
  const database = getDatabase();
  if (database) {
    const result = await database
      .prepare(
        `UPDATE credit_wallets
         SET balance = balance + ?1, reserved = reserved - ?1, updated_at = ?2
         WHERE session_id = ?3 AND reserved >= ?1`,
      )
      .bind(amount, Date.now(), sessionId)
      .run();
    if (result.meta.changes) {
      await database
        .prepare(
          `INSERT OR IGNORE INTO credit_ledger
            (entry_id, session_id, entry_type, amount, reference_id, created_at)
           VALUES (?1, ?2, 'release', ?3, ?4, ?5)`,
        )
        .bind(crypto.randomUUID(), sessionId, amount, referenceId, Date.now())
        .run();
    }
    return getCreditWallet(sessionId);
  }

  const wallet = memoryWallets.get(sessionId) ?? createMemoryWallet(sessionId);
  const updated = { ...wallet, balance: wallet.balance + amount, reserved: Math.max(0, wallet.reserved - amount), updatedAt: Date.now() };
  memoryWallets.set(sessionId, updated);
  memoryLedgerReferences.add(ledgerKey);
  return updated;
}

export async function grantPurchasedCredits(sessionId: string, amount: number, referenceId: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Le nombre de crédits acheté est invalide.");

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("grant_purchased_credits", {
      p_user_id: sessionId,
      p_amount: amount,
      p_reference_id: referenceId,
    });
    if (error) throw error;
    const wallet = firstRpcRow(data);
    if (!wallet) throw new Error("Le portefeuille Supabase est introuvable.");
    return rowToWallet(wallet);
  }

  const database = getDatabase();
  if (database) {
    await getDatabaseWallet(sessionId);
    const insert = await database.prepare(
      `INSERT OR IGNORE INTO credit_ledger
       (entry_id, session_id, entry_type, amount, reference_id, created_at)
       VALUES (?1, ?2, 'purchase', ?3, ?4, ?5)`,
    ).bind(crypto.randomUUID(), sessionId, amount, referenceId, Date.now()).run();
    if (insert.meta.changes) {
      await database.prepare(
        "UPDATE credit_wallets SET balance = balance + ?1, updated_at = ?2 WHERE session_id = ?3",
      ).bind(amount, Date.now(), sessionId).run();
    }
    return getCreditWallet(sessionId);
  }

  const ledgerKey = `purchase:${referenceId}`;
  const wallet = memoryWallets.get(sessionId) ?? createMemoryWallet(sessionId);
  if (memoryLedgerReferences.has(ledgerKey)) return wallet;
  const updated = { ...wallet, balance: wallet.balance + amount, updatedAt: Date.now() };
  memoryWallets.set(sessionId, updated);
  memoryLedgerReferences.add(ledgerKey);
  return updated;
}
