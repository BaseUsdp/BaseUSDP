-- Migration: Add user_balance_pda column to user_wallets table
-- Run this in Supabase SQL Editor

-- Add user_balance_pda column (nullable for backwards compatibility)
ALTER TABLE user_wallets 
ADD COLUMN IF NOT EXISTS user_balance_pda TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_balance_pda ON user_wallets(user_balance_pda);

-- Migrate existing data: if intermediate_wallet looks like a PDA (starts with specific pattern or length)
-- For now, we'll leave it as-is and let new deposits populate the new column
-- Old deposits will continue to work via the intermediate_wallet fallback

COMMENT ON COLUMN user_wallets.user_balance_pda IS 'User Balance PDA address for ZK pool balance tracking (true pooling)';
COMMENT ON COLUMN user_wallets.intermediate_wallet IS 'Intermediate wallet address used for deposits (for proof uploads)';
