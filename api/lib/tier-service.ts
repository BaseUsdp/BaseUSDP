/**
 * Token Holder Tier Service
 * 1:1 with Nolvipay's usdpHolderTierService.ts
 * Checks if a wallet holds VOID tokens and determines their tier level for fee discounts
 */

import { PublicKey, Connection } from '@solana/web3.js';
import { getAccount, getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { getSolanaConnection } from './void402-solana.js';

// VOID token mint address (or use env variable)
export const VOID_MINT = new PublicKey(
  process.env.VOID_TOKEN_MINT || process.env.USDP_MINT || '7HcZz4segTW8rLM6m5bR7ZQ8KamTm1MJ3jhdDNirpump'
);

// Tier thresholds (as percentage of total supply)
export const TIER_1_THRESHOLD = 0.001; // 0.1%
export const TIER_2_THRESHOLD = 0.005; // 0.5%
export const TIER_3_THRESHOLD = 0.01; // 1.0%

export type HolderTier = 0 | 1 | 2 | 3; // 0 = no tier, 1-3 = tier levels

export interface TierInfo {
  tier: HolderTier;
  percentageOfSupply: number;
  balance: number;
  totalSupply: number;
}

/**
 * Get Solana connection
 */
function getConnection(): Connection {
  return getSolanaConnection();
}

/**
 * Check token holder tier for a wallet
 * @param walletAddress - The wallet public key (base58 string)
 * @returns Promise<TierInfo> - Tier information including tier level and percentage of supply
 */
export async function getUSDPHolderTier(walletAddress: string): Promise<TierInfo> {
  try {
    // Validate wallet address
    if (!walletAddress || walletAddress.toLowerCase() === 'unknown' || walletAddress.length < 32 || walletAddress.length > 44) {
      return {
        tier: 0,
        percentageOfSupply: 0,
        balance: 0,
        totalSupply: 0,
      };
    }
    
    // Validate it's a valid Solana address
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return {
        tier: 0,
        percentageOfSupply: 0,
        balance: 0,
        totalSupply: 0,
      };
    }
    
    const connection = getConnection();
    
    // Check which token program VOID uses (Token or Token-2022)
    let tokenProgram = TOKEN_PROGRAM_ID;
    try {
      const mintAccountInfo = await connection.getAccountInfo(VOID_MINT);
      if (mintAccountInfo) {
        const TOKEN_2022_PROGRAM_ID_PUBKEY = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
        if (mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID_PUBKEY)) {
          tokenProgram = TOKEN_2022_PROGRAM_ID_PUBKEY;
        }
      }
    } catch (error) {
      // Default to standard Token program
    }

    // Get token mint info to find total supply
    let mintInfo;
    try {
      mintInfo = await getMint(connection, VOID_MINT, 'confirmed', tokenProgram);
    } catch (error: any) {
      // If it fails with detected program, try with standard Token program
      if (tokenProgram !== TOKEN_PROGRAM_ID) {
        try {
          mintInfo = await getMint(connection, VOID_MINT);
          tokenProgram = TOKEN_PROGRAM_ID;
        } catch (fallbackError: any) {
          return {
            tier: 0,
            percentageOfSupply: 0,
            balance: 0,
            totalSupply: 0,
          };
        }
      } else {
        return {
          tier: 0,
          percentageOfSupply: 0,
          balance: 0,
          totalSupply: 0,
        };
      }
    }

    const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
    
    if (totalSupply === 0) {
      return {
        tier: 0,
        percentageOfSupply: 0,
        balance: 0,
        totalSupply: 0,
      };
    }
    
    // Get associated token account for this wallet
    const associatedTokenAddress = await getAssociatedTokenAddress(
      VOID_MINT,
      walletPubkey,
      false,
      tokenProgram
    );

    // Check if the token account exists and get balance
    let tokenAccount;
    try {
      tokenAccount = await getAccount(connection, associatedTokenAddress, 'confirmed', tokenProgram);
    } catch (error: any) {
      // Token account doesn't exist, user doesn't hold tokens
      return {
        tier: 0,
        percentageOfSupply: 0,
        balance: 0,
        totalSupply,
      };
    }

    // Get balance (accounting for decimals)
    const balance = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);
    
    // Calculate percentage of total supply
    const percentageOfSupply = balance / totalSupply;
    
    // Determine tier
    let tier: HolderTier = 0;
    if (percentageOfSupply >= TIER_3_THRESHOLD) {
      tier = 3;
    } else if (percentageOfSupply >= TIER_2_THRESHOLD) {
      tier = 2;
    } else if (percentageOfSupply >= TIER_1_THRESHOLD) {
      tier = 1;
    }

    return {
      tier,
      percentageOfSupply,
      balance,
      totalSupply,
    };
  } catch (error) {
    console.error('Error checking holder tier:', error);
    // Return tier 0 on error to be safe (user pays standard fee)
    return {
      tier: 0,
      percentageOfSupply: 0,
      balance: 0,
      totalSupply: 0,
    };
  }
}

// Verified user discount (applied on top of tier discounts)
export const VERIFIED_USER_DISCOUNT = 0.5; // 0.5% discount for verified accounts

/**
 * Calculate fee percentage based on tier and verification status
 * @param baseFee - Base fee percentage (e.g., 10 for 10%)
 * @param tier - Holder tier (0-3)
 * @param transactionType - 'deposit' | 'swap' | 'transfer' | 'withdraw'
 * @param isVerified - Whether user has 2FA + email verified
 * @returns Fee percentage
 */
export function calculateFeePercentage(
  baseFee: number, 
  tier: HolderTier, 
  transactionType: 'deposit' | 'swap' | 'transfer' | 'withdraw',
  isVerified: boolean = false
): number {
  // Fee structure based on tier
  const feeStructure = {
    deposit: {
      0: 10.0,  // Regular: 10%
      1: 7.5,   // Tier 1: 7.5%
      2: 5.0,   // Tier 2: 5%
      3: 2.5,   // Tier 3: 2.5%
    },
    swap: {
      0: 1.0,   // Regular: 1.0%
      1: 0.85,  // Tier 1: 0.85%
      2: 0.7,   // Tier 2: 0.7%
      3: 0.6,   // Tier 3: 0.6% (above 0.5% minimum)
    },
    transfer: {
      0: 5.0,   // Regular: 5.0%
      1: 4.25,  // Tier 1: 4.25%
      2: 3.75,  // Tier 2: 3.75%
      3: 3.5,   // Tier 3: 3.5% (above 3.0% minimum)
    },
    withdraw: {
      0: 5.0,   // Regular: 5.0% (same as transfer)
      1: 4.25,  // Tier 1: 4.25%
      2: 3.75,  // Tier 2: 3.75%
      3: 3.5,   // Tier 3: 3.5% (above 3.0% minimum)
    },
  };

  let fee = feeStructure[transactionType][tier];
  
  // Apply verified user discount
  if (isVerified) {
    fee -= VERIFIED_USER_DISCOUNT;
  }
  
  // Ensure minimum fees are respected
  const minimums = {
    deposit: 2.0,  // Lowered minimum for verified users
    swap: 0.5,
    transfer: 2.5, // Lowered minimum for verified users
    withdraw: 2.5, // Same as transfer
  };
  
  return Math.max(fee, minimums[transactionType]);
}
