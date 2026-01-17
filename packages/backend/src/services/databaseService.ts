/**
 * Database Service
 * Handles all database operations for security and persistence
 * Uses Supabase (PostgreSQL) for production-grade security
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database schema types
export interface UserWallet {
  user_wallet: string;
  intermediate_wallet: string;
  token: 'SOL' | 'USDC' | 'USDT';
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

export interface PaymentRequest {
  payment_id: string;
  user_wallet: string;
  recipient: string;
  amount: number;
  token: 'SOL' | 'USDC' | 'USDT';
  nonce: number;
  payment_hash: string;
  status: 'pending' | 'settled' | 'failed';
  proof_pda?: string;
  created_at: string;
  settled_at?: string;
}

export interface UsedProof {
  nonce: number;
  user_wallet: string;
  intermediate_wallet: string;
  proof_pda: string;
  transaction_signature?: string;
  used_at: string;
}

export interface Transaction {
  user_wallet: string;
  intermediate_wallet?: string;
  type: 'deposit' | 'transfer' | 'payment' | 'withdraw';
  amount: number;
  token: 'SOL' | 'USDC' | 'USDT';
  recipient?: string;
  transaction_signature?: string;
  nonce?: number;
  created_at: string;
}

export interface AuditLog {
  user_wallet?: string;
  action: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  created_at: string;
}

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Supabase client
   */
  private initialize(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase not configured - database features disabled');
      console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.isInitialized = true;
      console.log('✅ Database service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
    }
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.supabase !== null;
  }

  // ============================================================================
  // User Wallet Mappings
  // ============================================================================

  /**
   * Get intermediate wallet for user and token
   */
  async getUserIntermediateWallet(
    userWallet: string,
    token: 'SOL' | 'USDC' | 'USDT'
  ): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      const { data, error } = await this.supabase!
        .from('user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', userWallet)
        .eq('token', token)
        .single();

      if (error || !data) return null;
      return data.intermediate_wallet;
    } catch {
      return null;
    }
  }

  /**
   * Create or update user wallet mapping (one per token)
   */
  async setUserIntermediateWallet(
    userWallet: string,
    intermediateWallet: string,
    token: 'SOL' | 'USDC' | 'USDT'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.supabase!
        .from('user_wallets')
        .upsert({
          user_wallet: userWallet,
          intermediate_wallet: intermediateWallet,
          token,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'user_wallet,token',
        });

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Verify user owns intermediate wallet (for specific token)
   */
  async verifyUserOwnsIntermediateWallet(
    userWallet: string,
    intermediateWallet: string,
    token: 'SOL' | 'USDC' | 'USDT'
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { data, error } = await this.supabase!
        .from('user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', userWallet)
        .eq('intermediate_wallet', intermediateWallet)
        .eq('token', token)
        .single();

      return !error && data !== null;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Payment Requests
  // ============================================================================

  /**
   * Create payment request
   */
  async createPaymentRequest(request: Omit<PaymentRequest, 'created_at' | 'settled_at'>): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.supabase!
        .from('payment_requests')
        .insert({
          payment_id: request.payment_id,
          user_wallet: request.user_wallet,
          recipient: request.recipient,
          amount: request.amount,
          token: request.token,
          nonce: request.nonce,
          payment_hash: request.payment_hash,
          status: request.status,
          proof_pda: request.proof_pda,
        });

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get payment request
   */
  async getPaymentRequest(paymentId: string): Promise<PaymentRequest | null> {
    if (!this.isAvailable()) return null;

    try {
      const { data, error } = await this.supabase!
        .from('payment_requests')
        .select('*')
        .eq('payment_id', paymentId)
        .single();

      if (error || !data) return null;
      return data as PaymentRequest;
    } catch {
      return null;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: 'pending' | 'settled' | 'failed',
    proofPda?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const updateData: any = { status };
      if (status === 'settled') {
        updateData.settled_at = new Date().toISOString();
      }
      if (proofPda) {
        updateData.proof_pda = proofPda;
      }

      const { error } = await this.supabase!
        .from('payment_requests')
        .update(updateData)
        .eq('payment_id', paymentId);

      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Used Proofs (Replay Attack Prevention)
  // ============================================================================

  /**
   * Check if proof nonce is already used
   */
  async isProofUsed(nonce: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { data, error } = await this.supabase!
        .from('used_proofs')
        .select('nonce')
        .eq('nonce', nonce)
        .single();

      return !error && data !== null;
    } catch {
      return false;
    }
  }

  /**
   * Mark proof as used (prevent replay)
   */
  async markProofUsed(
    nonce: number,
    userWallet: string,
    intermediateWallet: string,
    proofPda: string,
    transactionSignature?: string
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.supabase!
        .from('used_proofs')
        .insert({
          nonce,
          user_wallet: userWallet,
          intermediate_wallet: intermediateWallet,
          proof_pda: proofPda,
          transaction_signature: transactionSignature,
        });

      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Transactions (Audit Trail)
  // ============================================================================

  /**
   * Log transaction
   */
  async logTransaction(transaction: Omit<Transaction, 'created_at'>): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.supabase!
        .from('transactions')
        .insert({
          user_wallet: transaction.user_wallet,
          intermediate_wallet: transaction.intermediate_wallet,
          type: transaction.type,
          amount: transaction.amount,
          token: transaction.token,
          recipient: transaction.recipient,
          transaction_signature: transaction.transaction_signature,
          nonce: transaction.nonce,
        });

      return !error;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Audit Logs (Security Events)
  // ============================================================================

  /**
   * Log security event
   */
  async logAuditEvent(
    action: string,
    userWallet?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const { error } = await this.supabase!
        .from('audit_logs')
        .insert({
          user_wallet: userWallet,
          action,
          ip_address: ipAddress,
          user_agent: userAgent,
          details,
        });

      return !error;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let databaseServiceInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}
