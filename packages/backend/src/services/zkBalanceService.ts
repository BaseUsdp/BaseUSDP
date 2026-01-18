/**
 * ZK Balance Service
 * Tracks and retrieves user private balances from on-chain PDAs
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { getSolanaConnection, deriveUserBalancePDA } from '../lib/nolvi-solana.js';
import { getIntermediateWalletPool } from '../lib/intermediate-wallet-pool.js';

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface UserBalance {
  sol: number;
  usdc: number;
  usdt: number;
}

export class ZKBalanceService {
  private connection: Connection;

  constructor() {
    this.connection = getSolanaConnection();
  }

  /**
   * Get user's private balance
   * Reads from on-chain PDAs (user balance accounts)
   */
  async getUserBalance(userWallet: string): Promise<UserBalance> {
    return this.getUserBalanceInternal(userWallet);
  }

  /**
   * Get balance with success/error wrapper
   */
  async getBalance(userWallet: string): Promise<{ success: boolean; balances?: UserBalance; error?: string }> {
    try {
      const balances = await this.getUserBalanceInternal(userWallet);
      return { success: true, balances };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Internal method to get user balance
   */
  private async getUserBalanceInternal(userWallet: string): Promise<UserBalance> {
    try {
      // Try database first to get user's intermediate wallet
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      
      let intermediatePubkey: PublicKey | null = null;
      
      // Check database for user's intermediate wallets (one per token)
      if (dbService.isAvailable()) {
        // Try each token to find intermediate wallet
        for (const token of ['SOL', 'USDC', 'USDT'] as const) {
          const intermediateWalletPubkey = await dbService.getUserIntermediateWallet(userWallet, token);
          if (intermediateWalletPubkey) {
            intermediatePubkey = new PublicKey(intermediateWalletPubkey);
            break; // Use first found wallet
          }
        }
      }
      
      // Fallback: check all intermediate wallets (if database not available or no mapping found)
      if (!intermediatePubkey) {
        const allWallets = walletPool.getAllWallets();
        // Just use first wallet as fallback (not ideal, but better than nothing)
        if (allWallets.length > 0) {
          intermediatePubkey = new PublicKey(allWallets[0].publicKey);
        }
      }

      if (!intermediatePubkey) {
        // User hasn't deposited yet
        return { sol: 0, usdc: 0, usdt: 0 };
      }

      // Get balances for each token
      const balances: UserBalance = {
        sol: 0,
        usdc: 0,
        usdt: 0,
      };

      // Check SOL balance (native)
      const solBalance = await this.connection.getBalance(intermediatePubkey);
      balances.sol = solBalance / 1e9;

      // Check USDC balance - check token account directly (funds are here after deposit)
      try {
        const intermediateTokenAccount = await getAssociatedTokenAddress(USDC_MINT, intermediatePubkey);
        const tokenAccount = await getAccount(this.connection, intermediateTokenAccount);
        balances.usdc = Number(tokenAccount.amount) / 1e6; // USDC has 6 decimals
      } catch {
        // Token account doesn't exist or error reading it
        balances.usdc = 0;
      }
      
      // Also check ZK balance PDA if it exists (for future-proofing)
      try {
        const usdcBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), USDC_MINT.toBase58());
        const balanceAccount = await this.connection.getAccountInfo(usdcBalancePDA);
        
        if (balanceAccount && balanceAccount.data.length >= 56) {
          // Read balance from account data (bytes 48-56, after sender + nonce)
          const amountBuffer = balanceAccount.data.slice(48, 56);
          const amount = Number(amountBuffer.readBigUInt64LE(0));
          const pdaBalance = amount / 1e6; // USDC has 6 decimals
          // Use the higher of the two balances (token account or PDA)
          balances.usdc = Math.max(balances.usdc, pdaBalance);
        }
      } catch {
        // PDA doesn't exist yet, that's okay
      }

      // Check USDT balance - check token account directly (funds might be here after Jupiter swaps)
      try {
        const intermediateTokenAccount = await getAssociatedTokenAddress(USDT_MINT, intermediatePubkey);
        const tokenAccount = await getAccount(this.connection, intermediateTokenAccount);
        balances.usdt = Number(tokenAccount.amount) / 1e6; // USDT has 6 decimals
      } catch {
        // Token account doesn't exist or error reading it
        balances.usdt = 0;
      }
      
      // Also check ZK balance PDA if it exists
      try {
        const usdtBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), USDT_MINT.toBase58());
        const balanceAccount = await this.connection.getAccountInfo(usdtBalancePDA);
        
        if (balanceAccount && balanceAccount.data.length >= 56) {
          const amountBuffer = balanceAccount.data.slice(48, 56);
          const amount = Number(amountBuffer.readBigUInt64LE(0));
          const pdaBalance = amount / 1e6; // USDT has 6 decimals
          // Use the higher of the two balances
          balances.usdt = Math.max(balances.usdt, pdaBalance);
        }
      } catch {
        // PDA doesn't exist yet, that's okay
      }

      return balances;
    } catch (error) {
      console.error('Error getting user balance:', error);
      return { sol: 0, usdc: 0, usdt: 0 };
    }
  }

  /**
   * Get balance for specific token
   */
  async getTokenBalance(userWallet: string, token: 'SOL' | 'USDC' | 'USDT'): Promise<number> {
    const balances = await this.getUserBalance(userWallet);
    
    switch (token) {
      case 'SOL':
        return balances.sol;
      case 'USDC':
        return balances.usdc;
      case 'USDT':
        return balances.usdt;
      default:
        return 0;
    }
  }
}

// Singleton instance
let zkBalanceServiceInstance: ZKBalanceService | null = null;

export function getZKBalanceService(): ZKBalanceService {
  if (!zkBalanceServiceInstance) {
    zkBalanceServiceInstance = new ZKBalanceService();
  }
  return zkBalanceServiceInstance;
}
