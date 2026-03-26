import { useState, useEffect, useRef } from "react";
import { resolveName, detectNameType, type NameType } from "@/utils/nameResolution";

interface UseResolveNameReturn {
  /** Resolved Ethereum address, or null if not yet resolved */
  address: string | null;
  /** The detected input type */
  nameType: NameType;
  /** Whether resolution is in progress */
  isResolving: boolean;
  /** Error message if resolution failed */
  error: string | null;
}

/**
 * React hook that resolves ENS names (alice.eth) and Base Names (alice.base)
 * to Ethereum addresses. Includes debouncing.
 */
export function useResolveName(
  input: string,
  provider: { call: (tx: { to: string; data: string }) => Promise<string> } | null,
  debounceMs = 500
): UseResolveNameReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameType, setNameType] = useState<NameType>("unknown");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = input.trim();

    if (!trimmed) {
      setAddress(null);
      setNameType("unknown");
      setError(null);
      setIsResolving(false);
      return;
    }

    const type = detectNameType(trimmed);
    setNameType(type);

    // If it's already a raw address, return immediately
    if (type === "address") {
      setAddress(trimmed.toLowerCase());
      setError(null);
      setIsResolving(false);
      return;
    }

    if (type === "unknown" || !provider) {
      setAddress(null);
      setError(type === "unknown" ? null : "No provider available");
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;

      try {
        const resolved = await resolveName(trimmed, provider);
        if (controller.signal.aborted) return;
        setAddress(resolved);
        setError(resolved ? null : "Could not resolve name");
      } catch {
        if (!controller.signal.aborted) {
          setAddress(null);
          setError("Resolution failed");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsResolving(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, provider, debounceMs]);

  return { address, nameType, isResolving, error };
}
