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
   * Internal method to get user balance from ZK pool (User Balance PDA)
   * With true pooling, balances are tracked via User Balance PDA stored in database
   */
  private async getUserBalanceInternal(userWallet: string): Promise<UserBalance> {
    try {
      // Import rate limiter
      const { getRPCRateLimiter } = await import('../lib/rpcRateLimiter.js');
      const rateLimiter = getRPCRateLimiter();
      
      // Get User Balance PDA from database (stored during deposit)
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      const balances: UserBalance = {
        sol: 0,
        usdc: 0,
        usdt: 0,
      };

      // Check USDC balance from User Balance PDA
      try {
        console.log(`[ZKBalanceService] Checking USDC balance for wallet: ${userWallet}`);
        const userBalancePDA = dbService.isAvailable() 
          ? await dbService.getUserBalancePDA(userWallet, 'USDC')
          : null;
        
        console.log(`[ZKBalanceService] User Balance PDA from database: ${userBalancePDA || 'NOT FOUND'}`);
        
        if (userBalancePDA) {
          const pdaPubkey = new PublicKey(userBalancePDA);
          await rateLimiter.waitIfNeeded('getAccountInfo');
          const balanceAccount = await this.connection.getAccountInfo(pdaPubkey);
          
          console.log(`[ZKBalanceService] Account info for PDA ${userBalancePDA}: exists=${!!balanceAccount}, dataLength=${balanceAccount?.data.length || 0}`);
          
          if (balanceAccount && balanceAccount.data.length >= 80) {
            // Read available balance (bytes 72-80, after discriminator + wallet + token_mint)
            const amountBuffer = balanceAccount.data.slice(72, 80);
            const amount = Number(amountBuffer.readBigUInt64LE(0));
            balances.usdc = amount / 1e6; // USDC has 6 decimals
            console.log(`[ZKBalanceService] ✅ USDC balance from PDA: ${balances.usdc} USDC (raw: ${amount} lamports)`);
          } else {
            console.warn(`[ZKBalanceService] ⚠️ User Balance PDA account exists but data length is insufficient: ${balanceAccount?.data.length || 0} bytes (need at least 80)`);
          }
        } else {
          console.log(`[ZKBalanceService] ⚠️ No User Balance PDA found in database for ${userWallet} / USDC`);
        }
      } catch (error: any) {
        // PDA doesn't exist yet (user hasn't deposited), that's okay
        console.error(`[ZKBalanceService] ❌ Error reading USDC balance PDA:`, error.message);
        if (!error.message?.includes('InvalidAccountData') && !error.message?.includes('AccountNotFound')) {
          console.warn('[ZKBalanceService] Error reading USDC balance PDA:', error.message);
        }
      }

      // Check USDT balance from User Balance PDA
      try {
        const userBalancePDA = dbService.isAvailable() 
          ? await dbService.getUserBalancePDA(userWallet, 'USDT')
          : null;
        
        if (userBalancePDA) {
          const pdaPubkey = new PublicKey(userBalancePDA);
          await rateLimiter.waitIfNeeded('getAccountInfo');
          const balanceAccount = await this.connection.getAccountInfo(pdaPubkey);
          
          if (balanceAccount && balanceAccount.data.length >= 80) {
            // Read available balance (bytes 72-80)
            const amountBuffer = balanceAccount.data.slice(72, 80);
            const amount = Number(amountBuffer.readBigUInt64LE(0));
            balances.usdt = amount / 1e6; // USDT has 6 decimals
            console.log(`[ZKBalanceService] USDT balance from PDA: ${balances.usdt}`);
          }
        }
      } catch (error: any) {
        // PDA doesn't exist yet, that's okay
        if (!error.message?.includes('InvalidAccountData') && !error.message?.includes('AccountNotFound')) {
          console.warn('[ZKBalanceService] Error reading USDT balance PDA:', error.message);
        }
      }

      // Check SOL balance from User Balance PDA
      // Note: SOL uses WSOL mint for the pool
      try {
        const userBalancePDA = dbService.isAvailable() 
          ? await dbService.getUserBalancePDA(userWallet, 'SOL')
          : null;
        
        if (userBalancePDA) {
          const pdaPubkey = new PublicKey(userBalancePDA);
          await rateLimiter.waitIfNeeded('getAccountInfo');
          const balanceAccount = await this.connection.getAccountInfo(pdaPubkey);
          
          if (balanceAccount && balanceAccount.data.length >= 80) {
            // Read available balance (bytes 72-80)
            const amountBuffer = balanceAccount.data.slice(72, 80);
            const amount = Number(amountBuffer.readBigUInt64LE(0));
            balances.sol = amount / 1e9; // SOL has 9 decimals
            console.log(`[ZKBalanceService] SOL balance from PDA: ${balances.sol}`);
          }
        }
      } catch (error: any) {
        // PDA doesn't exist yet, that's okay
        if (!error.message?.includes('InvalidAccountData') && !error.message?.includes('AccountNotFound')) {
          console.warn('[ZKBalanceService] Error reading SOL balance PDA:', error.message);
        }
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
