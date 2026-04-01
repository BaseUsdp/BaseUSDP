/**
 * Token constants for BaseUSDP
 * Defines supported token addresses and metadata
 */

import { CHAIN_IDS } from './chains';

export interface TokenConfig {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
}

export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [CHAIN_IDS.BASE_MAINNET]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [CHAIN_IDS.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    address: USDC_ADDRESSES[CHAIN_IDS.BASE_MAINNET],
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl: '/assets/icons/usdc.svg',
  },
};

export const TOKEN_DISPLAY_DECIMALS = 2;
export const TOKEN_INPUT_DECIMALS = 6;
export const MIN_DEPOSIT_AMOUNT = '1.00';
export const MAX_DEPOSIT_AMOUNT = '1000.00';
