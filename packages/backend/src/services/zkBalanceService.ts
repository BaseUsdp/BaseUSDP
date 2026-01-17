/**
 * ZK Balance Service
 * Tracks and retrieves user private balances from on-chain PDAs
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
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
    try {
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      
      // Find user's intermediate wallet
      const allWallets = walletPool.getAllWallets();
      const userIntermediateWallet = allWallets.find(w => {
        // In a real system, we'd have a mapping from user wallet to intermediate wallet
        // For now, we'll check all intermediate wallets for balance PDAs
        return true; // Placeholder - will be improved with database mapping
      });

      if (!userIntermediateWallet) {
        // User hasn't deposited yet
        return { sol: 0, usdc: 0, usdt: 0 };
      }

      const intermediatePubkey = new PublicKey(userIntermediateWallet.publicKey);

      // Get balances for each token
      const balances: UserBalance = {
        sol: 0,
        usdc: 0,
        usdt: 0,
      };

      // Check SOL balance (native)
      const solBalance = await this.connection.getBalance(intermediatePubkey);
      balances.sol = solBalance / 1e9;

      // Check USDC balance
      try {
        const usdcBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), USDC_MINT.toBase58());
        const balanceAccount = await this.connection.getAccountInfo(usdcBalancePDA);
        
        if (balanceAccount && balanceAccount.data.length >= 56) {
          // Read balance from account data (bytes 48-56, after sender + nonce)
          const amountBuffer = balanceAccount.data.slice(48, 56);
          const amount = Number(amountBuffer.readBigUInt64LE(0));
          balances.usdc = amount / 1e6; // USDC has 6 decimals
        }
      } catch {
        balances.usdc = 0;
      }

      // Check USDT balance
      try {
        const usdtBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), USDT_MINT.toBase58());
        const balanceAccount = await this.connection.getAccountInfo(usdtBalancePDA);
        
        if (balanceAccount && balanceAccount.data.length >= 56) {
          const amountBuffer = balanceAccount.data.slice(48, 56);
          const amount = Number(amountBuffer.readBigUInt64LE(0));
          balances.usdt = amount / 1e6; // USDT has 6 decimals
        }
      } catch {
        balances.usdt = 0;
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
