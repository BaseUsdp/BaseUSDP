/**
 * Internal types for the Veil integration.
 * Intentionally isolated from any BASEUSDP pool types.
 */

export type VeilPool = 'eth' | 'usdc';

export interface VeilStatusResponse {
  relay: {
    ok: boolean;
    status?: string;
    network?: string;
    timestamp?: string;
    rateLimit?: {
      limit: number;
      windowMs: number;
    };
    error?: string;
  };
  addresses: {
    entry: string;
    ethPool: string;
    ethQueue: string;
    usdcPool: string;
    usdcQueue: string;
    usdcToken: string;
    forwarderFactory: string;
    chainId: number;
    relayUrl: string;
  };
  registration?: {
    isRegistered: boolean;
    depositKey?: string;
  };
  eligibility?: {
    isAllowed: boolean;
    error?: string;
  };
}

export interface VeilQueueBalanceResponse {
  wallet: string;
  usdc: {
    queueAmount: string;
    pendingCount: number;
    error?: string;
  };
  eth: {
    queueAmount: string;
    pendingCount: number;
    error?: string;
  };
}
