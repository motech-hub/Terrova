import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const generationJobs = sqliteTable("generation_jobs", {
  jobId: text("job_id").primaryKey(),
  sessionId: text("session_id").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputKey: text("output_key"),
  providerJobId: text("provider_job_id"),
  providerStatusUrl: text("provider_status_url"),
  creditCost: integer("credit_cost"),
  creditReservationId: text("credit_reservation_id"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const creditWallets = sqliteTable("credit_wallets", {
  sessionId: text("session_id").primaryKey(),
  planId: text("plan_id").notNull(),
  balance: integer("balance").notNull(),
  reserved: integer("reserved").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const creditLedger = sqliteTable("credit_ledger", {
  entryId: text("entry_id").primaryKey(),
  sessionId: text("session_id").notNull(),
  entryType: text("entry_type").notNull(),
  amount: integer("amount").notNull(),
  referenceId: text("reference_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const orders = sqliteTable("orders", {
  orderId: text("order_id").primaryKey(),
  sessionId: text("session_id").notNull(),
  productType: text("product_type").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  credits: integer("credits").notNull(),
  amountXof: integer("amount_xof").notNull(),
  currency: text("currency").notNull().default("XOF"),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  providerToken: text("provider_token"),
  checkoutUrl: text("checkout_url"),
  providerTransactionId: text("provider_transaction_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
});

export const payments = sqliteTable("payments", {
  paymentId: text("payment_id").primaryKey(),
  orderId: text("order_id").notNull(),
  provider: text("provider").notNull(),
  providerToken: text("provider_token").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  status: text("status").notNull(),
  amountXof: integer("amount_xof").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
