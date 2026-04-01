/**
 * Chain configuration constants for BaseUSDP
 * Defines supported networks and their parameters
 */

export const CHAIN_IDS = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

export const CHAIN_CONFIG = {
  [CHAIN_IDS.BASE_MAINNET]: {
    name: 'Base',
    shortName: 'base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
    averageBlockTime: 2000, // 2 seconds in ms
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    name: 'Base Sepolia',
    shortName: 'base-sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
    averageBlockTime: 2000,
  },
} as const;

export const DEFAULT_CHAIN_ID = CHAIN_IDS.BASE_MAINNET;
