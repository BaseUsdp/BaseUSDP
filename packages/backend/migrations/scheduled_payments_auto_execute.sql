-- Auto-execute (Path A) extension for scheduled_payments.
-- When auto_execute=true, the cron does NOT flip is_due=true; instead it
-- calls executeBaseTransfer directly using the pre-signed EIP-712 auth.
-- After 2 consecutive failures, the row falls back to notify-only.

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS auth_signature TEXT;

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS auth_max_per_tx NUMERIC(20, 8);

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS auth_expires_at TIMESTAMPTZ;

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS auth_revoked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE scheduled_payments
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Enforce: if auto_execute is on, the auth fields must be populated.
ALTER TABLE scheduled_payments
  ADD CONSTRAINT scheduled_payments_auto_execute_requires_auth CHECK (
    (auto_execute = FALSE) OR (
      auth_signature IS NOT NULL
      AND auth_max_per_tx IS NOT NULL
      AND auth_expires_at IS NOT NULL
    )
  );

-- Index used by the cron when picking up due auto-execute rows.
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_auto_execute_due
  ON scheduled_payments(status, auto_execute, scheduled_for)
  WHERE auto_execute = TRUE AND auth_revoked = FALSE;
