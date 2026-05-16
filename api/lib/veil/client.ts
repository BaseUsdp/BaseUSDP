/**
 * Thin server-side wrapper around @veil-cash/sdk.
 *
 * Phase 1: read-only.  No keypair, no proof generation, no private values.
 * Everything here is a wrapper around public on-chain reads or a public
 * health check against Veil's relay.
 *
 * This file intentionally has no dependency on any BASEUSDP pool code.
 */

import {
  ADDRESSES,
  ENTRY_ABI,
  checkRelayHealth,
  checkRecipientRegistration,
  getQueueBalance,
  getRelayInfo,
} from '@veil-cash/sdk';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export const VEIL_RPC_URL =
  process.env.BASE_RPC_URL || 'https://mainnet.base.org';

export const VEIL_RELAY_URL = ADDRESSES.relayUrl;

export const VEIL_ADDRESSES = {
  entry: ADDRESSES.entry,
  ethPool: ADDRESSES.ethPool,
  ethQueue: ADDRESSES.ethQueue,
  usdcPool: ADDRESSES.usdcPool,
  usdcQueue: ADDRESSES.usdcQueue,
  usdcToken: ADDRESSES.usdcToken,
  forwarderFactory: ADDRESSES.forwarderFactory,
  chainId: ADDRESSES.chainId,
  relayUrl: ADDRESSES.relayUrl,
};

export async function getRelayHealthSafe() {
  try {
    const health = await checkRelayHealth(VEIL_RELAY_URL);
    let rateLimit: { limit: number; windowMs: number } | undefined;
    try {
      const info = await getRelayInfo(VEIL_RELAY_URL);
      rateLimit = {
        limit: info.rateLimit.limit,
        windowMs: info.rateLimit.windowMs,
      };
    } catch {
      // Rate limit info is best-effort.
    }
    return {
      ok: health.status === 'ok',
      status: health.status,
      network: health.network,
      timestamp: health.timestamp,
      rateLimit,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getRegistrationSafe(address: `0x${string}`) {
  try {
    return await checkRecipientRegistration(address, VEIL_RPC_URL);
  } catch (err) {
    return {
      isRegistered: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getEligibilitySafe(address: `0x${string}`) {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(VEIL_RPC_URL),
    });
    const isAllowed = (await client.readContract({
      address: ADDRESSES.entry,
      abi: ENTRY_ABI,
      functionName: 'isAllowedDepositor',
      args: [address],
    })) as boolean;
    return { isAllowed };
  } catch (err) {
    return {
      isAllowed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getQueueBalanceSafe(
  address: `0x${string}`,
  pool: 'eth' | 'usdc'
) {
  try {
    const result = await getQueueBalance({
      address,
      pool,
      rpcUrl: VEIL_RPC_URL,
    });
    return {
      queueAmount: String(result.queueBalance ?? '0'),
      pendingCount: Number(result.pendingCount ?? 0),
    };
  } catch (err) {
    return {
      queueAmount: '0',
      pendingCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
