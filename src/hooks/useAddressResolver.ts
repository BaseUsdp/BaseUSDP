/**
 * Username <-> Wallet Address Resolution Hook
 * Provides cached lookups for mapping between usernames and wallet addresses.
 */

import { useCallback, useRef } from "react";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

const API_BASE = getApiUrl();

// Module-level cache (persists across hook instances within session)
const addressCache = new Map<string, string>(); // username -> address
const usernameCache = new Map<string, string>(); // address -> username

function getSessionCache(key: string): string | null {
  try {
    return sessionStorage.getItem(`xmtp_resolve_${key}`);
  } catch {
    return null;
  }
}

function setSessionCache(key: string, value: string): void {
  try {
    sessionStorage.setItem(`xmtp_resolve_${key}`, value);
  } catch {
    // sessionStorage might be full or unavailable
  }
}

export function useAddressResolver() {
  const pendingRef = useRef<Map<string, Promise<string | null>>>(new Map());

  /**
   * Resolve a username to a wallet address.
   * Uses in-memory + sessionStorage cache.
   */
  const resolveUsername = useCallback(async (username: string): Promise<string | null> => {
    const normalized = username.toLowerCase().replace(/^@/, "");

    // Check in-memory cache
    const cached = addressCache.get(normalized);
    if (cached) return cached;

    // Check sessionStorage
    const sessionCached = getSessionCache(`addr_${normalized}`);
    if (sessionCached) {
      addressCache.set(normalized, sessionCached);
      return sessionCached;
    }

    // Deduplicate in-flight requests
    const pending = pendingRef.current.get(`addr_${normalized}`);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const token = authService.getSessionToken();
        const res = await fetch(
          `${API_BASE}/api/user/resolve-address?username=${encodeURIComponent(normalized)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await res.json();

        if (data.success && data.wallet_address) {
          const addr = data.wallet_address;
          addressCache.set(normalized, addr);
          usernameCache.set(addr.toLowerCase(), normalized);
          setSessionCache(`addr_${normalized}`, addr);
          setSessionCache(`user_${addr.toLowerCase()}`, normalized);
          return addr;
        }
        return null;
      } catch {
        return null;
      } finally {
        pendingRef.current.delete(`addr_${normalized}`);
      }
    })();

    pendingRef.current.set(`addr_${normalized}`, promise);
    return promise;
  }, []);

  /**
   * Resolve a wallet address to a username.
   * Uses in-memory + sessionStorage cache.
   */
  const resolveAddress = useCallback(async (address: string): Promise<string | null> => {
    const normalized = address.toLowerCase();

    // Check in-memory cache
    const cached = usernameCache.get(normalized);
    if (cached) return cached;

    // Check sessionStorage
    const sessionCached = getSessionCache(`user_${normalized}`);
    if (sessionCached) {
      usernameCache.set(normalized, sessionCached);
      return sessionCached;
    }

    // Deduplicate in-flight requests
    const pending = pendingRef.current.get(`user_${normalized}`);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/user/check-username?username=${encodeURIComponent(address)}`
        );
        const data = await res.json();

        if (data.exists && data.username) {
          const username = data.username;
          usernameCache.set(normalized, username);
          addressCache.set(username.toLowerCase(), normalized);
          setSessionCache(`user_${normalized}`, username);
          setSessionCache(`addr_${username.toLowerCase()}`, normalized);
          return username;
        }
        return null;
      } catch {
        return null;
      } finally {
        pendingRef.current.delete(`user_${normalized}`);
      }
    })();

    pendingRef.current.set(`user_${normalized}`, promise);
    return promise;
  }, []);

  return { resolveUsername, resolveAddress };
}
