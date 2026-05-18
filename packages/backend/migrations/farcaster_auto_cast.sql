-- Farcaster auto-cast settings (#11).
-- When auto_cast_enabled is true, BASEUSDP auto-publishes a cast from the
-- @baseusdp bot account mentioning the user after a successful deposit or
-- withdrawal. Privacy default: amount is NOT included unless the user
-- explicitly opts in via auto_cast_include_amount.

ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS auto_cast_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS auto_cast_on_deposit BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS auto_cast_on_withdraw BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS auto_cast_include_amount BOOLEAN NOT NULL DEFAULT FALSE;

-- Rate-limit tracking: last cast timestamp per wallet+event-type.
-- One column per event type is simpler than a separate table for v1.
ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS last_auto_cast_deposit_at TIMESTAMPTZ;

ALTER TABLE farcaster_users
  ADD COLUMN IF NOT EXISTS last_auto_cast_withdraw_at TIMESTAMPTZ;
