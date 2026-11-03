CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  product_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount_xof INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_token TEXT,
  checkout_url TEXT,
  provider_transaction_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_token_idx
  ON orders (provider, provider_token);

CREATE INDEX IF NOT EXISTS orders_session_id_idx
  ON orders (session_id);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_token TEXT NOT NULL,
  provider_transaction_id TEXT,
  status TEXT NOT NULL,
  amount_xof INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_token_idx
  ON payments (provider, provider_token);

CREATE INDEX IF NOT EXISTS payments_order_id_idx
  ON payments (order_id);
