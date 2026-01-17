/**
 * ZK Privacy Protection Utilities
 * Implements fixes for amount correlation and timing correlation attacks
 */

// Fixed denominations (like Tornado Cash) to prevent amount correlation attacks
export const FIXED_DENOMINATIONS = {
  SOL: [
    0.1,   // 0.1 SOL
    0.5,   // 0.5 SOL
    1,     // 1 SOL
    5,     // 5 SOL
    10,    // 10 SOL
    50,    // 50 SOL
    100,   // 100 SOL
  ],
  USDC: [
    10,    // $10
    25,    // $25
    50,    // $50
    100,   // $100
    250,   // $250
    500,   // $500
    1000,  // $1000
  ],
  USDT: [
    10,    // $10
    25,    // $25
    50,    // $50
    100,   // $100
    250,   // $250
    500,   // $500
    1000,  // $1000
  ],
};

/**
 * Advanced amount obfuscation with multi-layer privacy protection
 */
export function obfuscateAmountForPrivacy(
  amount: number,
  currency: 'SOL' | 'USDC' | 'USDT',
  minAmount: number = 0
): { obfuscatedAmount: number; difference: number; method: 'noise' | 'rounding' } {
  // Layer 1: Base random noise (1-3%)
  const baseNoisePercent = 0.01 + (Math.random() * 0.02);
  const baseNoiseAmount = amount * baseNoisePercent;
  
  // Layer 2: Add "dust" component (0.1-0.5% of amount)
  const dustPercent = 0.001 + (Math.random() * 0.004);
  const dustAmount = amount * dustPercent;
  
  // Layer 3: Round to "dust increments"
  let dustIncrement: number;
  if (currency === 'SOL') {
    dustIncrement = 0.0001; // 100,000 lamports
  } else {
    dustIncrement = 0.01; // 1 cent
  }
  
  // Combine base amount + noise + dust
  let combinedAmount = amount + baseNoiseAmount + dustAmount;
  
  // Round to dust increment
  combinedAmount = Math.ceil(combinedAmount / dustIncrement) * dustIncrement;
  
  // Ensure we don't go below minimum amount
  if (combinedAmount < minAmount) {
    combinedAmount = Math.ceil(minAmount / dustIncrement) * dustIncrement;
  }
  
  const difference = combinedAmount - amount;
  const differencePercent = Math.abs((difference / amount) * 100);
  
  // If difference is >10%, fall back to fixed denomination rounding
  if (differencePercent > 10) {
    return roundToFixedDenomination(amount, currency);
  }
  
  return {
    obfuscatedAmount: combinedAmount,
    difference,
    method: 'noise',
  };
}

/**
 * Round amount to nearest fixed denomination (fallback method)
 */
function roundToFixedDenomination(
  amount: number,
  currency: 'SOL' | 'USDC' | 'USDT'
): { obfuscatedAmount: number; difference: number; method: 'rounding' } {
  const denominations = FIXED_DENOMINATIONS[currency];
  if (!denominations || denominations.length === 0) {
    return { obfuscatedAmount: amount, difference: 0, method: 'rounding' };
  }

  // Find nearest denomination
  let nearest = denominations[0];
  let minDiff = Math.abs(amount - nearest);

  for (const denom of denominations) {
    const diff = Math.abs(amount - denom);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = denom;
    }
  }

  // If amount is less than smallest denomination, round up
  if (amount < denominations[0]) {
    nearest = denominations[0];
  }

  const difference = nearest - amount;
  return {
    obfuscatedAmount: nearest,
    difference,
    method: 'rounding',
  };
}

/**
 * Generate a nonce that doesn't directly correlate with transaction timing
 */
export function generatePrivacyNonce(userWallet?: string): number {
  const timestamp = Date.now();
  const randomComponent = Math.floor(Math.random() * 1000000);
  
  let walletHash = 0;
  if (userWallet) {
    for (let i = 0; i < userWallet.length; i++) {
      walletHash = ((walletHash << 5) - walletHash) + userWallet.charCodeAt(i);
      walletHash = walletHash & walletHash;
    }
  }
  
  return timestamp + randomComponent + (userWallet ? (Math.abs(walletHash) % 100000) : 0);
}

/**
 * Calculate random delay for relayer submission
 */
export function calculateRelayerDelay(): number {
  const meanDelayMs = 30 * 1000; // 30 seconds
  const uniformRandom = Math.random();
  const exponentialDelay = -Math.log(uniformRandom) * meanDelayMs;
  
  const minDelay = 15 * 1000; // 15 seconds
  const maxDelay = 45 * 1000; // 45 seconds
  
  return Math.max(minDelay, Math.min(maxDelay, exponentialDelay));
}

/**
 * Smart split amount into 2 parts for privacy
 */
export function smartSplit(
  amount: number,
  currency: 'SOL' | 'USDC' | 'USDT'
): { part1: number; part2: number } {
  // Round to fixed denomination first
  const rounded = roundToFixedDenomination(amount, currency);
  
  // Split into 2 parts with random ratio (40-60%)
  const splitRatio = 0.4 + (Math.random() * 0.2); // 40-60%
  const part1 = rounded.obfuscatedAmount * splitRatio;
  const part2 = rounded.obfuscatedAmount - part1;
  
  // Round each part to prevent correlation
  let dustIncrement: number;
  if (currency === 'SOL') {
    dustIncrement = 0.0001;
  } else {
    dustIncrement = 0.01;
  }
  
  const part1Rounded = Math.ceil(part1 / dustIncrement) * dustIncrement;
  const part2Rounded = Math.ceil(part2 / dustIncrement) * dustIncrement;
  
  return {
    part1: part1Rounded,
    part2: part2Rounded,
  };
}
