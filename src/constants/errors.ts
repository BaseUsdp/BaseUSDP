/**
 * Error message constants for BaseUSDP
 * Centralized, user-friendly error messages
 */

export const ERROR_MESSAGES = {
  // Wallet errors
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue.',
  WALLET_WRONG_NETWORK: 'Please switch to the Base network in your wallet.',
  WALLET_REJECTED: 'Transaction was rejected in your wallet.',
  WALLET_INSUFFICIENT_ETH: 'Insufficient ETH for gas fees. You need a small amount of ETH on Base.',
  WALLET_INSUFFICIENT_USDC: 'Insufficient USDC balance for this transaction.',

  // Deposit errors
  DEPOSIT_AMOUNT_INVALID: 'Please enter a valid deposit amount matching a supported tier.',
  DEPOSIT_APPROVAL_FAILED: 'USDC approval failed. Please try again.',
  DEPOSIT_TRANSACTION_FAILED: 'Deposit transaction failed. Please check your balance and try again.',
  DEPOSIT_NOTE_SAVE_FAILED: 'Failed to save deposit note. Please copy it manually before closing.',

  // Transfer errors
  TRANSFER_PROOF_FAILED: 'Failed to generate zero-knowledge proof. Please try again.',
  TRANSFER_PROOF_TIMEOUT: 'Proof generation timed out. Please refresh and try again.',
  TRANSFER_INVALID_RECIPIENT: 'Invalid recipient address or username.',
  TRANSFER_AMOUNT_EXCEEDS_BALANCE: 'Transfer amount exceeds your available balance.',
  TRANSFER_SUBMISSION_FAILED: 'Failed to submit transfer. The relayer may be temporarily unavailable.',

  // Username errors
  USERNAME_TAKEN: 'This username is already taken. Please choose a different one.',
  USERNAME_INVALID: 'Username must be 3-20 characters, using only letters, numbers, and hyphens.',
  USERNAME_NOT_FOUND: 'Username not found. Please check the spelling.',

  // General errors
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  SERVER_ERROR: 'An unexpected server error occurred. Please try again later.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  SESSION_EXPIRED: 'Your session has expired. Please reconnect your wallet.',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
