/**
 * Application route constants for BaseUSDP
 * Centralized route definitions to avoid hardcoded paths
 */

export const ROUTES = {
  HOME: '/',
  DEPOSIT: '/deposit',
  TRANSFER: '/transfer',
  SWAP: '/swap',
  PRIVATE_SWAP: '/private-swap',
  SUPPORT: '/support',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS: '/terms-and-conditions',
  RETRY_DEPOSIT: '/retry-deposit',
} as const;

export const EXTERNAL_ROUTES = {
  GITHUB: 'https://github.com/BaseUsdp/BaseUSDP',
  BASE_BRIDGE: 'https://bridge.base.org',
  BASESCAN: 'https://basescan.org',
  BASESCAN_TX: (hash: string) => `https://basescan.org/tx/${hash}`,
  BASESCAN_ADDRESS: (address: string) => `https://basescan.org/address/${address}`,
  COINBASE_FAUCET: 'https://www.coinbase.com/faucets/base-ethereum-sepolia',
  DOCS: '/docs',
} as const;

export const API_ROUTES = {
  AUTH_NONCE: '/api/auth/generate-nonce',
  AUTH_VERIFY: '/api/auth/verify-signature',
  DEPOSIT: '/api/privacy-usd/deposit',
  TRANSFER: '/api/privacy-usd/transfer',
  WITHDRAW: '/api/privacy-usd/withdraw',
  BALANCE: '/api/privacy-usd/balance',
  HISTORY: '/api/privacy-usd/history',
  USERNAME_REGISTER: '/api/privacy-usd/username/register',
  USERNAME_LOOKUP: '/api/privacy-usd/username',
  PAYMENT_CREATE: '/api/zk-pay/create',
  PAYMENT_SETTLE: '/api/zk-pay/settle',
  PAYMENT_LIST: '/api/zk-pay/list',
} as const;
