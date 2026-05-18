/**
 * Onchain badges client (#12).
 *
 * Fetches the server-aggregated badge data for a wallet (Coinbase EAS
 * attestations) and merges in a client-side Basenames check via the
 * existing ENS resolver. Cached in-memory with a 30-min TTL because
 * attestations are slow-moving.
 */

import { getApiUrl } from "@/utils/apiConfig";
import { resolveEnsName } from "@/lib/ens";

export interface BadgeData {
  coinbase_verified_account: boolean;
  coinbase_verified_country: string | null;
  basename: string | null;
}

interface CacheEntry {
  data: BadgeData;
  ts: number;
}

const TTL_MS = 30 * 60 * 1000;
const memCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<BadgeData>>();

const EMPTY: BadgeData = {
  coinbase_verified_account: false,
  coinbase_verified_country: null,
  basename: null,
};

async function fetchFromServer(address: string): Promise<BadgeData> {
  const apiUrl = getApiUrl();
  const [serverRes, nameRes] = await Promise.allSettled([
    fetch(`${apiUrl}/api/badges/${address}`),
    resolveEnsName(address),
  ]);

  let coinbaseAccount = false;
  let coinbaseCountry: string | null = null;
  if (serverRes.status === "fulfilled" && serverRes.value.ok) {
    try {
      const json = await serverRes.value.json();
      if (json?.success && json.badges) {
        coinbaseAccount = !!json.badges.coinbase_verified_account;
        coinbaseCountry = json.badges.coinbase_verified_country ?? null;
      }
    } catch {
      /* ignore */
    }
  }

  const name = nameRes.status === "fulfilled" ? nameRes.value : null;
  const basename = name && name.toLowerCase().endsWith(".base.eth") ? name : null;

  return {
    coinbase_verified_account: coinbaseAccount,
    coinbase_verified_country: coinbaseCountry,
    basename,
  };
}

export async function getBadges(address: string): Promise<BadgeData> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return EMPTY;
  const key = address.toLowerCase();

  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = fetchFromServer(key)
    .then((data) => {
      memCache.set(key, { data, ts: Date.now() });
      return data;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}
