-- Web Push subscriptions + cron state for the BASEUSDP tip-notification
-- pipeline. Apply in the Supabase SQL editor.

-- One row per (user, browser/device). The endpoint is unique because the
-- browser-provided URL identifies the subscription; if the user re-enables
-- notifications on the same device the endpoint stays the same and we
-- upsert.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_wallet_idx
  ON push_subscriptions (LOWER(user_wallet));

COMMENT ON TABLE push_subscriptions IS
  'Web Push subscriptions per wallet. The cron at /api/cron/push-tips uses these to notify recipients when a new tip lands.';

-- Tiny key-value table the cron uses to remember which zk_transactions
-- row it last processed. A single row keyed by name="push_last_tip_ts"
-- holds an ISO timestamp; the cron only fires pushes for tips newer than
-- this and advances the cursor.
CREATE TABLE IF NOT EXISTS push_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE push_state IS
  'Cron cursor state for the push-tips job (and any future push triggers).';
