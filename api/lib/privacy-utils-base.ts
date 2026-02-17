/**
 * Privacy Utilities for Void402 on Base
 * Amount obfuscation, nonce generation, split calculation, and mock ZK proofs
 */

import { ethers } from 'ethers';

// Fixed denominations to prevent amount correlation attacks
export const FIXED_DENOMINATIONS = [
  10n,    // $10
  25n,    // $25
  50n,    // $50
  100n,   // $100
  250n,   // $250
  500n,   // $500
  1000n,  // $1000
];

// Minimum split amount ($3 USDC in 6-decimal units)
export const PRIVACY_EXCHANGE_MIN = 3_000_000n;

/**
 * Multi-layer amount obfuscation for privacy protection
 */
export function obfuscateAmountForPrivacy(
  amount: number,
  minAmount: number = 0
): { obfuscatedAmount: number; difference: number; method: 'noise' | 'rounding' } {
  // Layer 1: Base random noise (1-3%)
  const baseNoisePercent = 0.01 + (Math.random() * 0.02);
  const baseNoiseAmount = amount * baseNoisePercent;

  // Layer 2: Dust component (0.1-0.5%)
  const dustPercent = 0.001 + (Math.random() * 0.004);
  const dustAmount = amount * dustPercent;

  // Layer 3: Round to dust increments (1 cent for USDC)
  const dustIncrement = 0.01;

  let combinedAmount = amount + baseNoiseAmount + dustAmount;
  combinedAmount = Math.ceil(combinedAmount / dustIncrement) * dustIncrement;

  if (combinedAmount < minAmount) {
    combinedAmount = Math.ceil(minAmount / dustIncrement) * dustIncrement;
  }

  const difference = combinedAmount - amount;
  const differencePercent = Math.abs((difference / amount) * 100);

  // Fallback to fixed denomination if noise is too large
  if (differencePercent > 10) {
    return roundToFixedDenomination(amount);
  }

  return { obfuscatedAmount: combinedAmount, difference, method: 'noise' };
}

/**
 * Round to nearest fixed denomination (fallback method)
 */
function roundToFixedDenomination(
  amount: number
): { obfuscatedAmount: number; difference: number; method: 'rounding' } {
  const denominations = FIXED_DENOMINATIONS.map(d => Number(d));

  let nearest = denominations[0];
  let minDiff = Math.abs(amount - nearest);

  for (const denom of denominations) {
    const diff = Math.abs(amount - denom);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = denom;
    }
  }

  if (amount < denominations[0]) {
    nearest = denominations[0];
  }

  return { obfuscatedAmount: nearest, difference: nearest - amount, method: 'rounding' };
}

/**
 * Generate a privacy nonce that doesn't correlate with transaction timing
 */
export function generatePrivacyNonce(userWallet?: string): bigint {
  const timestamp = BigInt(Date.now());
  const randomComponent = BigInt(Math.floor(Math.random() * 1000000));

  let walletHash = 0n;
  if (userWallet) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(userWallet));
    walletHash = BigInt(hash.slice(0, 18)) % 100000n;
  }

  return timestamp * 1000000n + randomComponent + walletHash;
}

/**
 * Generate proof ID from nonce (matches X402PrivacyPool.getProofId)
 */
export function getProofId(nonce: bigint): string {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [nonce]));
}

/**
 * Calculate random delay for relayer submission (15-45 seconds)
 */
export function calculateRelayerDelay(): number {
  const meanDelayMs = 30 * 1000;
  const uniformRandom = Math.random();
  const exponentialDelay = -Math.log(uniformRandom) * meanDelayMs;

  const minDelay = 15 * 1000;
  const maxDelay = 45 * 1000;

  return Math.max(minDelay, Math.min(maxDelay, exponentialDelay));
}

/**
 * Calculate split amounts for privacy mixing
 * @param amount Total amount in smallest units (6 decimals for USDC)
 * @returns Array of split amounts
 */
export function calculateSplits(amount: bigint): bigint[] {
  const maxPossibleSplits = Number(amount / PRIVACY_EXCHANGE_MIN);

  let numSplits: number;
  if (maxPossibleSplits < 2) {
    if (amount >= PRIVACY_EXCHANGE_MIN) {
      return [amount];
    } else {
      return [];
    }
  } else if (maxPossibleSplits >= 4) {
    numSplits = 2 + Math.floor(Math.random() * 3); // 2-4 splits
  } else {
    numSplits = 2;
  }

  numSplits = Math.min(numSplits, maxPossibleSplits);

  const splits: bigint[] = [];
  let remainingAmount = amount;

  for (let i = 0; i < numSplits - 1; i++) {
    const remainingSplits = numSplits - i;
    const minRequiredForRemaining = PRIVACY_EXCHANGE_MIN * BigInt(remainingSplits);
    const maxAllowedForThisSplit = remainingAmount - minRequiredForRemaining + PRIVACY_EXCHANGE_MIN;

    const minForThisSplit = Number(PRIVACY_EXCHANGE_MIN);
    const maxForThisSplit = Number(maxAllowedForThisSplit);
    const randomAmount = BigInt(Math.floor(minForThisSplit + (Math.random() * (maxForThisSplit - minForThisSplit))));

    splits.push(randomAmount);
    remainingAmount -= randomAmount;
  }
  splits.push(remainingAmount);

  // Shuffle splits for extra privacy
  for (let i = splits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [splits[i], splits[j]] = [splits[j], splits[i]];
  }

  return splits;
}

/**
 * Calculate staggered send times for splits (1-3 minutes apart)
 */
export function calculateSplitSchedule(numSplits: number): Date[] {
  const now = new Date();
  const schedule: Date[] = [];

  for (let i = 0; i < numSplits; i++) {
    if (i === 0) {
      schedule.push(now);
    } else {
      const delayMs = 60000 + Math.floor(Math.random() * 120000); // 60-180s
      const previousTime = schedule[i - 1].getTime();
      schedule.push(new Date(previousTime + delayMs));
    }
  }

  return schedule;
}

/**
 * Generate a mock ZK proof (for development/testing)
 * In production, this would use a real ZK proving system (e.g., Circom/snarkjs)
 */
export function generateMockProof(
  sender: string,
  amount: bigint,
  nonce: bigint
): { proofBytes: string; commitmentBytes: string; blindingFactorBytes: string } {
  const proofSeed = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint256', 'string'],
      [sender, amount, nonce, 'proof']
    )
  );

  const commitmentSeed = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint256', 'string'],
      [sender, amount, nonce, 'commitment']
    )
  );

  const blindingSeed = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint256', 'string'],
      [sender, amount, nonce, 'blinding']
    )
  );

  return {
    proofBytes: proofSeed,
    commitmentBytes: commitmentSeed,
    blindingFactorBytes: blindingSeed,
  };
}
