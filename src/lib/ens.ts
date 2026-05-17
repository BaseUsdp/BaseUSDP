/**
 * ENS + Basenames reverse resolution.
 *
 * resolveEnsName(address) returns a human name like `vitalik.eth` or
 * `jesse.base.eth` for a wallet, or null if the wallet has no primary
 * name set on either mainnet ENS or Base's Basenames.
 *
 * Two-tier lookup: mainnet ENS first (most common), then Basenames on
 * Base. Results are cached in memory + localStorage with a 24h TTL so
 * we don't re-query on every render.
 */

import { createPublicClient, http, isAddress } from "viem";
import { base, mainnet } from "viem/chains";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "ens_resolve_v1_";

// Coinbase's Universal Resolver on Base for Basenames reverse lookups.
// Viem may or may not have this baked into its `base` chain definition
// depending on version, so we pass it explicitly.
const BASE_UNIVERSAL_RESOLVER =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as const;

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

interface CacheEntry {
  name: string | null;
  ts: number;
}

const memCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();

function readLocal(addrLower: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + addrLower);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(addrLower: string, entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + addrLower, JSON.stringify(entry));
  } catch {
    // localStorage may be unavailable or full — fine to ignore.
  }
}

async function lookup(address: `0x${string}`): Promise<string | null> {
  // Try mainnet ENS first. CCIP-Read on the mainnet Universal Resolver
  // already covers a lot of L2 names, so this often resolves Basenames too.
  try {
    const mainnetName = await mainnetClient.getEnsName({ address });
    if (mainnetName) return mainnetName;
  } catch {
    // Network error / no primary set — fall through.
  }

  // Then try Basenames directly on Base.
  try {
    const baseName = await baseClient.getEnsName({
      address,
      universalResolverAddress: BASE_UNIVERSAL_RESOLVER,
    });
    if (baseName) return baseName;
  } catch {
    // Same idea — silently fall through.
  }

  return null;
}

export async function resolveEnsName(address: string): Promise<string | null> {
  if (!address || !isAddress(address)) return null;
  const addrLower = address.toLowerCase();

  const mem = memCache.get(addrLower);
  if (mem && Date.now() - mem.ts <= CACHE_TTL_MS) return mem.name;

  const local = readLocal(addrLower);
  if (local) {
    memCache.set(addrLower, local);
    return local.name;
  }

  const inflight = pending.get(addrLower);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const name = await lookup(address as `0x${string}`);
      const entry: CacheEntry = { name, ts: Date.now() };
      memCache.set(addrLower, entry);
      writeLocal(addrLower, entry);
      return name;
    } finally {
      pending.delete(addrLower);
    }
  })();

  pending.set(addrLower, promise);
  return promise;
}
