-- Telegram bot links (#20).
-- One row per linked wallet. Linking flow:
--   1. User clicks "Link Telegram" in Settings → server generates a fresh
--      6-char code, stores it on the (new or existing) row with a 10-min
--      expiry, returns it to the client.
--   2. User opens t.me/baseusdp_bot?start=<code> in Telegram.
--   3. Bot receives /start <code> → webhook resolves the wallet and
--      stamps chat_id + linked_at. Code is cleared.

CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL UNIQUE,
  chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  linking_code TEXT,
  linking_code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_incoming BOOLEAN NOT NULL DEFAULT TRUE,
  notify_outgoing BOOLEAN NOT NULL DEFAULT FALSE,
  notify_x402 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON telegram_links(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_linking_code ON telegram_links(linking_code) WHERE linking_code IS NOT NULL;

CREATE TRIGGER trg_telegram_links_updated_at
  BEFORE UPDATE ON telegram_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
