/**
 * Smart contract address constants for BaseUSDP
 * Addresses for deployed protocol contracts on each supported chain
 */

import { CHAIN_IDS } from './chains';

export interface ContractAddresses {
  privacyPool: `0x${string}`;
  relayer: `0x${string}`;
  verifier: `0x${string}`;
  usernameRegistry: `0x${string}`;
}

export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  [CHAIN_IDS.BASE_MAINNET]: {
    privacyPool: '0x0000000000000000000000000000000000000001', // Placeholder — deploy address TBD
    relayer: '0x0000000000000000000000000000000000000002',
    verifier: '0x0000000000000000000000000000000000000003',
    usernameRegistry: '0x0000000000000000000000000000000000000004',
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    privacyPool: '0x0000000000000000000000000000000000000001', // Placeholder — deploy address TBD
    relayer: '0x0000000000000000000000000000000000000002',
    verifier: '0x0000000000000000000000000000000000000003',
    usernameRegistry: '0x0000000000000000000000000000000000000004',
  },
};

export const MERKLE_TREE_HEIGHT = 20;
export const MAX_DEPOSIT_COUNT = 2 ** MERKLE_TREE_HEIGHT; // ~1 million deposits
