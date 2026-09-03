PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL UNIQUE,
  founding_post_number INTEGER,
  valid_post_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('verify','recovery')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  external_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','removed')),
  expires_at TEXT,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, external_id)
);
CREATE INDEX IF NOT EXISTS contents_published_idx ON contents(status, published_at);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_content_idx ON comments(content_id, created_at);
CREATE TABLE IF NOT EXISTS daily_usage (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(account_id, usage_date)
);
CREATE TABLE IF NOT EXISTS recharges (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  onepay_order_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed')),
  callback_token_hash TEXT NOT NULL,
  payment_url TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS balance_ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_cents INTEGER NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(reference_type, reference_id)
);
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  content_id TEXT NOT NULL REFERENCES contents(id),
  daily_budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  updated_at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS contents_fts USING fts5(
  content_id UNINDEXED, title, content, tokenize='trigram'
);
