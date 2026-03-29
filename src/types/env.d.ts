/**
 * Environment Variable Type Definitions
 *
 * Provides IntelliSense for all VITE_ environment variables
 * used in the BASEUSDP frontend.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API URL override (leave unset in production for same-origin) */
  readonly VITE_API_URL?: string;

  /** WebSocket URL for real-time updates */
  readonly VITE_WS_URL?: string;

  /** Supabase project URL */
  readonly VITE_SUPABASE_URL?: string;

  /** Supabase anonymous/public key */
  readonly VITE_SUPABASE_ANON_KEY?: string;

  /** Base RPC URL override */
  readonly VITE_BASE_RPC_URL?: string;

  /** Base chain ID (8453 for mainnet, 84532 for sepolia) */
  readonly VITE_BASE_CHAIN_ID?: string;

  /** Enable debug logging */
  readonly VITE_DEBUG?: string;

  /** Analytics tracking ID */
  readonly VITE_ANALYTICS_ID?: string;

  /** Sentry DSN for error reporting */
  readonly VITE_SENTRY_DSN?: string;

  /** XMTP environment (production or dev) */
  readonly VITE_XMTP_ENV?: "production" | "dev";

  /** WalletConnect project ID */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;

  /** Codecov token (CI only) */
  readonly VITE_CODECOV_TOKEN?: string;

  /** Feature flags */
  readonly VITE_FEATURE_ZK_TRANSFERS?: string;
  readonly VITE_FEATURE_XMTP_MESSAGING?: string;
  readonly VITE_FEATURE_X402_PAYMENTS?: string;
  readonly VITE_FEATURE_SWAP?: string;

  /** Standard Vite env vars */
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
