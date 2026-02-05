/**
 * Validation Utilities
 * Address and input validation for BASEUSDP
 */

/**
 * Validate a Solana address (base58 format)
 *
 * Solana addresses are:
 * - Base58 encoded
 * - 32-44 characters long
 * - No ambiguous characters (0, O, I, l)
 *
 * @param address - Address to validate
 * @returns true if valid Solana address format
 */
export const isValidSolanaAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Base58 character set (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
};

/**
 * Validate a Base/EVM address (hex format)
 *
 * @param address - Address to validate
 * @returns true if valid EVM address format
 */
export const isValidBaseAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Format an address for display (truncated)
 * 
 * @param address - Full address
 * @param startChars - Characters to show at start (default 4)
 * @param endChars - Characters to show at end (default 4)
 * @returns Formatted address like "7xKq...9mPw"
 */
export const formatAddress = (
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars + 3) {
    return address || "";
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Validate an amount is a positive number
 * 
 * @param amount - Amount to validate (string or number)
 * @returns true if valid positive amount
 */
export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && isFinite(num);
};

/**
 * Validate a payment ID format
 * 
 * @param paymentId - Payment ID to validate
 * @returns true if valid payment ID format
 */
export const isValidPaymentId = (paymentId: string): boolean => {
  if (!paymentId || typeof paymentId !== "string") {
    return false;
  }
  // Payment IDs are typically prefixed with x402_ and have alphanumeric content
  return /^x402_[a-zA-Z0-9]{6,}$/.test(paymentId) || paymentId.length >= 8;
};

/**
 * Validate a transaction signature (Solana or EVM format)
 *
 * @param signature - Transaction signature to validate
 * @returns true if valid signature format
 */
export const isValidTransactionSignature = (signature: string): boolean => {
  if (!signature || typeof signature !== "string") {
    return false;
  }
  // EVM transaction hashes are 0x-prefixed hex, 66 characters
  if (signature.startsWith("0x")) {
    return /^0x[a-fA-F0-9]{64}$/.test(signature);
  }
  // Solana transaction signatures are base58 encoded, typically 87-88 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
  return base58Regex.test(signature);
};

/**
 * Get validation error message for an address
 * 
 * @param address - Address to validate
 * @returns Error message or null if valid
 */
export const getAddressError = (address: string, chain: "solana" | "base" = "base"): string | null => {
  if (!address) {
    return "Address is required";
  }

  if (chain === "base") {
    if (!isValidBaseAddress(address)) {
      return "Invalid Base address format. Address should start with 0x and be 42 characters";
    }
    return null;
  }

  if (address.startsWith("0x")) {
    return "Invalid address format. Please enter a valid address";
  }

  if (!isValidSolanaAddress(address)) {
    return "Invalid address format. Address should be 32-44 characters";
  }

  return null;
};

/**
 * Get validation error message for an amount
 * 
 * @param amount - Amount to validate
 * @returns Error message or null if valid
 */
export const getAmountError = (amount: string): string | null => {
  if (!amount) {
    return "Amount is required";
  }
  
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    return "Please enter a valid number";
  }
  
  if (num <= 0) {
    return "Amount must be greater than 0";
  }
  
  if (!isFinite(num)) {
    return "Please enter a valid amount";
  }
  
  return null;
};

export default {
  isValidSolanaAddress,
  isValidBaseAddress,
  formatAddress,
  isValidAmount,
  isValidPaymentId,
  isValidTransactionSignature,
  getAddressError,
  getAmountError,
};

