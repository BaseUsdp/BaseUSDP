import { useEffect, useState } from "react";
import { resolveEnsName } from "@/lib/ens";

interface ResolvedName {
  name: string | null;
  isLoading: boolean;
}

/**
 * Resolves a full 0x… address to its ENS / Basenames primary name. Returns
 * null when the address is invalid, empty, or has no name set. Caches in
 * memory + localStorage so the same address only queries the network once
 * per 24 hours per device.
 */
export function useEnsName(address: string | undefined | null): ResolvedName {
  const [state, setState] = useState<ResolvedName>({
    name: null,
    isLoading: !!address,
  });

  useEffect(() => {
    if (!address) {
      setState({ name: null, isLoading: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ name: prev.name, isLoading: true }));

    resolveEnsName(address)
      .then((name) => {
        if (cancelled) return;
        setState({ name, isLoading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ name: null, isLoading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}
