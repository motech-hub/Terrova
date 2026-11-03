CREATE TABLE IF NOT EXISTS credit_wallets (
  session_id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL,
  balance INTEGER NOT NULL,
  reserved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  entry_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_reference_idx
  ON credit_ledger (entry_type, reference_id);

CREATE INDEX IF NOT EXISTS credit_ledger_session_id_idx
  ON credit_ledger (session_id);

ALTER TABLE generation_jobs ADD COLUMN credit_cost INTEGER;
ALTER TABLE generation_jobs ADD COLUMN credit_reservation_id TEXT;
