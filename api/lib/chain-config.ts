/**
 * Chain Configuration for Void402
 * Routes between Solana and Base chain logic based on ACTIVE_CHAIN env var
 */

export type ActiveChain = 'solana' | 'base';

/**
 * Get the active chain from environment (defaults to "base")
 */
export function getActiveChain(): ActiveChain {
  const chain = (process.env.ACTIVE_CHAIN || 'base').toLowerCase();
  if (chain === 'solana') return 'solana';
  return 'base';
}

/**
 * Check if current chain is Base
 */
export function isBaseChain(): boolean {
  return getActiveChain() === 'base';
}

/**
 * Check if current chain is Solana
 */
export function isSolanaChain(): boolean {
  return getActiveChain() === 'solana';
}

/**
 * ChangeNow currency codes per chain
 */
export function getChangeNowCurrencies(chain?: ActiveChain) {
  const activeChain = chain || getActiveChain();

  if (activeChain === 'base') {
    return {
      'USDC': 'usdcbase',
      'USDT': 'usdtbase',
    } as const;
  }

  return {
    'USDC': 'usdcsol',
    'USDT': 'usdtsol',
  } as const;
}

/**
 * Token addresses per chain
 */
export function getTokenAddresses(chain?: ActiveChain) {
  const activeChain = chain || getActiveChain();

  if (activeChain === 'base') {
    const isMainnet = process.env.NETWORK === 'mainnet' || process.env.NODE_ENV === 'production';
    return {
      USDC: isMainnet
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      USDT: isMainnet
        ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base uses USDC primarily
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    };
  }

  return {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  };
}

/**
 * Block explorer URL per chain
 */
export function getExplorerUrl(chain?: ActiveChain) {
  const activeChain = chain || getActiveChain();

  if (activeChain === 'base') {
    const isMainnet = process.env.NETWORK === 'mainnet' || process.env.NODE_ENV === 'production';
    return isMainnet ? 'https://basescan.org' : 'https://sepolia.basescan.org';
  }

  return 'https://solscan.io';
}

/**
 * Get explorer transaction URL
 */
export function getExplorerTxUrl(txHash: string, chain?: ActiveChain): string {
  const baseUrl = getExplorerUrl(chain);
  const activeChain = chain || getActiveChain();

  if (activeChain === 'base') {
    return `${baseUrl}/tx/${txHash}`;
  }

  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Minimum ChangeNow exchange amounts per chain (in smallest units, 6 decimals)
 */
export function getMinimumExchangeAmount(): bigint {
  return 3_000_000n; // 3 USDC — same for both chains
}
