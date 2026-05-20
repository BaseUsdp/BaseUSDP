-- WebAuthn / biometric unlock (passkey-style).
-- Lets users register Touch ID / Face ID / Windows Hello / security keys on
-- a per-device basis, then re-open the dashboard without re-signing the
-- wallet auth message. Wallet still signs every on-chain tx; this only
-- refreshes the SIWE-style session token via biometric.
--
-- Two tables:
--   1. webauthn_credentials — one row per registered (wallet, device).
--      Stores the credential_id + public_key + transport hints + use counter.
--   2. webauthn_challenges  — short-TTL nonce store. Init endpoints insert
--      a fresh row; verify endpoints consume it. Stateless verification
--      isn't an option because @simplewebauthn/server needs to match the
--      exact challenge it generated.
--
-- Apply in Supabase SQL editor. Depends on update_updated_at_column().

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],
  device_label TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_wallet ON webauthn_credentials(user_wallet);

CREATE TRIGGER trg_webauthn_credentials_updated_at
  BEFORE UPDATE ON webauthn_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_wallet ON webauthn_challenges(user_wallet);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
