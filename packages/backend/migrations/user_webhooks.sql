-- User-configurable outgoing webhooks.
-- One row per (wallet, url). User registers an HTTPS URL in Settings →
-- on each event we POST a JSON payload with an HMAC SHA-256 signature so
-- the receiver can verify the call came from BASEUSDP.
--
-- Apply in Supabase SQL editor. Depends on update_updated_at_column()
-- already defined in the base schema.

CREATE TABLE IF NOT EXISTS user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_incoming BOOLEAN NOT NULL DEFAULT TRUE,
  notify_outgoing BOOLEAN NOT NULL DEFAULT FALSE,
  notify_x402 BOOLEAN NOT NULL DEFAULT TRUE,
  notify_deposit BOOLEAN NOT NULL DEFAULT TRUE,
  notify_withdraw BOOLEAN NOT NULL DEFAULT TRUE,
  notify_scheduled BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  last_status INTEGER,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_webhooks_user_wallet ON user_webhooks(user_wallet);

CREATE TRIGGER trg_user_webhooks_updated_at
  BEFORE UPDATE ON user_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
