-- Void402 Database Schema for Supabase (PostgreSQL)
-- Based on privacyusd schema with ZK proof enhancements
-- Run this in Supabase SQL Editor

-- ============================================================================
-- User Wallet Mappings (matches privacyusd structure)
-- ============================================================================
-- Maps user wallets to intermediate wallets for privacy
-- One intermediate wallet per user per token (for better privacy)
CREATE TABLE IF NOT EXISTS user_wallets (
  id BIGSERIAL PRIMARY KEY,
  user_wallet TEXT NOT NULL, -- User's actual wallet address
  intermediate_wallet TEXT NOT NULL, -- Intermediate wallet assigned to this user (for privacy)
  token TEXT NOT NULL CHECK (token IN ('SOL', 'USDC', 'USDT')), -- Token type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_wallet, token) -- One intermediate wallet per user per token
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_wallet ON user_wallets(user_wallet);
CREATE INDEX IF NOT EXISTS idx_intermediate_wallet ON user_wallets(intermediate_wallet);
CREATE INDEX IF NOT EXISTS idx_user_token ON user_wallets(user_wallet, token);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_wallets_updated_at 
  BEFORE UPDATE ON user_wallets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Transactions (matches privacyusd structure with enhancements)
-- ============================================================================
-- Tracks all deposits, transfers, payments, and swaps
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  intermediate_wallet TEXT, -- Intermediate wallet used for this transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'transfer', 'payment', 'swap', 'withdraw')),
  token TEXT NOT NULL CHECK (token IN ('SOL', 'USDC', 'USDT')),
  amount NUMERIC(20, 8) NOT NULL,
  amount_received NUMERIC(20, 8), -- Amount after fees (for deposits/transfers)
  fee_amount NUMERIC(20, 8), -- Fee amount deducted
  fee_percentage NUMERIC(5, 2), -- Fee percentage (e.g., 5.00 for 5%)
  
  -- For transfers/payments
  recipient_address TEXT,
  
  -- For swaps
  from_token TEXT,
  to_token TEXT,
  from_amount NUMERIC(20, 8),
  to_amount NUMERIC(20, 8),
  
  -- ZK Proof fields (Void402 specific)
  nonce BIGINT, -- ZK proof nonce
  proof_pda TEXT, -- Proof PDA address
  
  -- Transaction metadata
  transaction_signature TEXT, -- Solana transaction signature
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT fk_user_wallet FOREIGN KEY (user_wallet, token) REFERENCES user_wallets(user_wallet, token) ON DELETE CASCADE
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_wallet ON transactions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_transactions_nonce ON transactions(nonce);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transactions_updated_at();

-- ============================================================================
-- Payment Requests (x402 payments - matches privacyusd structure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_requests (
  id BIGSERIAL PRIMARY KEY,
  payment_id TEXT UNIQUE NOT NULL,
  user_wallet TEXT NOT NULL, -- Merchant/creator wallet
  recipient TEXT NOT NULL, -- Payer wallet (for x402)
  amount DECIMAL(20, 8) NOT NULL,
  token TEXT NOT NULL CHECK (token IN ('SOL', 'USDC', 'USDT')),
  description TEXT,
  service_id TEXT, -- Service identifier
  nonce BIGINT NOT NULL, -- ZK proof nonce
  payment_hash TEXT NOT NULL, -- Payment hash for verification
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
  proof_pda TEXT, -- ZK proof PDA
  transaction_hash TEXT, -- Final transaction signature
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_request_id ON payment_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_user_wallet ON payment_requests(user_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_nonce ON payment_requests(nonce);

CREATE TRIGGER update_payment_requests_updated_at 
  BEFORE UPDATE ON payment_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Holding Wallets (matches privacyusd - for deposit tracking)
-- ============================================================================
-- Tracks holding wallets used in auto-split deposit flow
-- Holding wallets are deterministic wallets where users send their full deposit
CREATE TABLE IF NOT EXISTS holding_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id VARCHAR(255) UNIQUE NOT NULL,
  user_wallet VARCHAR(255) NOT NULL,
  holding_wallet_address VARCHAR(255) NOT NULL,
  amount VARCHAR(255) NOT NULL,
  token VARCHAR(50) NOT NULL CHECK (token IN ('SOL', 'USDC', 'USDT')),
  token_mint VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  num_splits INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_holding_wallets_deposit_id ON holding_wallets(deposit_id);
CREATE INDEX IF NOT EXISTS idx_holding_wallets_user_wallet ON holding_wallets(user_wallet);
CREATE INDEX IF NOT EXISTS idx_holding_wallets_status ON holding_wallets(status);
CREATE INDEX IF NOT EXISTS idx_holding_wallets_holding_wallet_address ON holding_wallets(holding_wallet_address);

-- Add comments
COMMENT ON TABLE holding_wallets IS 'Tracks holding wallets for auto-split deposit flow';
COMMENT ON COLUMN holding_wallets.deposit_id IS 'Unique deposit identifier (e.g., wallet_timestamp_token)';
COMMENT ON COLUMN holding_wallets.holding_wallet_address IS 'Deterministic holding wallet address where user sends funds';
COMMENT ON COLUMN holding_wallets.status IS 'Status: pending (waiting for funds), processing (splitting), completed (all splits processed), failed (error occurred)';
COMMENT ON COLUMN holding_wallets.num_splits IS 'Number of splits created for this deposit';

CREATE TRIGGER update_holding_wallets_updated_at 
  BEFORE UPDATE ON holding_wallets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Used Proofs (Void402 specific - prevent replay attacks)
-- ============================================================================
-- Tracks used ZK proof nonces to prevent replay attacks
CREATE TABLE IF NOT EXISTS used_proofs (
  id BIGSERIAL PRIMARY KEY,
  nonce BIGINT NOT NULL UNIQUE,
  user_wallet TEXT NOT NULL,
  intermediate_wallet TEXT NOT NULL,
  proof_pda TEXT NOT NULL,
  transaction_signature TEXT,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_used_proof_nonce ON used_proofs(nonce);
CREATE INDEX IF NOT EXISTS idx_used_proof_user_wallet ON used_proofs(user_wallet);
CREATE INDEX IF NOT EXISTS idx_used_proof_proof_pda ON used_proofs(proof_pda);

COMMENT ON TABLE used_proofs IS 'Tracks used ZK proof nonces to prevent replay attacks';

-- ============================================================================
-- Auth Nonces (matches privacyusd - prevent signature replay attacks)
-- ============================================================================
-- Stores authentication nonces and signed tokens
-- This prevents signature replay attacks from malicious websites
CREATE TABLE IF NOT EXISTS auth_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  signed_signature TEXT, -- NULL until user signs and verifies
  bearer_token TEXT, -- JWT or session token after verification
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  origin_domain TEXT, -- Store origin domain for CORS validation
  used_at TIMESTAMP WITH TIME ZONE -- Track when bearer token was last used
);

-- Index for fast nonce lookups
CREATE INDEX IF NOT EXISTS idx_auth_nonces_nonce ON auth_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_user_wallet ON auth_nonces(user_wallet);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_bearer_token ON auth_nonces(bearer_token);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at ON auth_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_created ON auth_nonces(expires_at, created_at);

COMMENT ON TABLE auth_nonces IS 'Stores authentication nonces and bearer tokens to prevent signature replay attacks';

-- ============================================================================
-- Audit Logs (Void402 specific - security events)
-- ============================================================================
-- Logs all security events for compliance and monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_wallet TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_wallet ON audit_logs(user_wallet);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

COMMENT ON TABLE audit_logs IS 'Logs all security events for compliance and monitoring';

-- ============================================================================
-- Row Level Security (RLS) - Optional but recommended
-- ============================================================================
-- ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE holding_wallets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE used_proofs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured based on your access requirements
-- For now, service role key will bypass RLS
