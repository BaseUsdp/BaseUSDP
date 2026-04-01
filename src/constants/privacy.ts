/**
 * Privacy tier constants for BaseUSDP
 * Defines deposit tiers and their parameters
 */

export interface PrivacyTier {
  id: number;
  name: string;
  amount: string;
  amountRaw: bigint;
  description: string;
  minAnonymitySet: number;
}

export const PRIVACY_TIERS: PrivacyTier[] = [
  {
    id: 1,
    name: 'Micro',
    amount: '1.00',
    amountRaw: 1_000_000n, // 1 USDC with 6 decimals
    description: 'Basic privacy for testing and micro-payments',
    minAnonymitySet: 10,
  },
  {
    id: 2,
    name: 'Standard',
    amount: '10.00',
    amountRaw: 10_000_000n,
    description: 'Standard privacy for everyday payments',
    minAnonymitySet: 50,
  },
  {
    id: 3,
    name: 'Enhanced',
    amount: '100.00',
    amountRaw: 100_000_000n,
    description: 'Enhanced privacy for business payments',
    minAnonymitySet: 100,
  },
  {
    id: 4,
    name: 'Maximum',
    amount: '1000.00',
    amountRaw: 1_000_000_000n,
    description: 'Maximum privacy for high-value transfers',
    minAnonymitySet: 200,
  },
];

export const PROTOCOL_FEE_BPS = 30; // 0.3% = 30 basis points
export const RELAYER_FEE_BPS = 10; // 0.1% relayer fee
export const TOTAL_FEE_BPS = PROTOCOL_FEE_BPS + RELAYER_FEE_BPS;

export const PROOF_GENERATION_TIMEOUT_MS = 120_000; // 2 minutes
export const PROOF_GENERATION_EXPECTED_MS = 10_000; // 10 seconds average

export const DEPOSIT_NOTE_VERSION = 'baseusdp-v1';
