-- Scheduled payments (#13 recurring + #14 one-shot).
-- One table, is_recurring flag distinguishes the two.
-- Notify-only v1: cron flips is_due=true; the dashboard banner shows it; the
-- user manually fires the tx through the regular Send flow, which calls
-- /api/scheduled/mark-sent to clear is_due and (for recurring) bump
-- scheduled_for to the next cycle.

CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('address', 'username')),
  recipient_value TEXT NOT NULL,
  token TEXT NOT NULL CHECK (token IN ('USDC', 'USDT')),
  amount NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
  memo TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  is_due BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  last_sent_at TIMESTAMPTZ,
  last_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_payments_frequency_matches_recurring CHECK (
    (is_recurring = TRUE AND frequency IS NOT NULL) OR
    (is_recurring = FALSE AND frequency IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user
  ON scheduled_payments(user_wallet);

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_check
  ON scheduled_payments(status, is_due, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user_due
  ON scheduled_payments(user_wallet, status, is_due);

CREATE TRIGGER trg_scheduled_payments_updated_at
  BEFORE UPDATE ON scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
