/**
 * Frontend API client for the Veil integration.
 *
 * All calls go through our own /api/veil/* endpoints; the Veil SDK is
 * never imported into the client bundle in Phase 1.
 */

export interface VeilStatus {
  relay: {
    ok: boolean;
    status?: string;
    network?: string;
    timestamp?: string;
    rateLimit?: { limit: number; windowMs: number };
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

export interface VeilQueueBalance {
  wallet: string;
  usdc: { queueAmount: string; pendingCount: number; error?: string };
  eth: { queueAmount: string; pendingCount: number; error?: string };
}

const BASE_PATH = "/api/veil";

export async function fetchVeilStatus(
  wallet?: string,
  signal?: AbortSignal
): Promise<VeilStatus> {
  const url = wallet
    ? `${BASE_PATH}/status?wallet=${encodeURIComponent(wallet)}`
    : `${BASE_PATH}/status`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Veil status request failed (${res.status})`);
  }
  return (await res.json()) as VeilStatus;
}

export async function fetchVeilQueueBalance(
  wallet: string,
  signal?: AbortSignal
): Promise<VeilQueueBalance> {
  const url = `${BASE_PATH}/balance/${encodeURIComponent(wallet)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Veil balance request failed (${res.status})`);
  }
  return (await res.json()) as VeilQueueBalance;
}
