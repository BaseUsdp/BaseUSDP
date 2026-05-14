/**
 * Farcaster Mini App Context Hook
 * Wraps sdk.context to parse user info, client state, and launch location
 * Fully safe — catches all SDK errors including postMessage failures
 */

import { useState, useEffect } from "react";

export interface MiniAppContextData {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  isClientAdded: boolean;
  location: "cast_embed" | "notification" | "launcher" | "direct_cast" | null;
  castEmbedUrl: string | null;
  isLoaded: boolean;
  sdkAvailable: boolean;
}

export function useMiniAppContext(): MiniAppContextData {
  const [contextData, setContextData] = useState<MiniAppContextData>({
    fid: null,
    username: null,
    displayName: null,
    pfpUrl: null,
    isClientAdded: false,
    location: null,
    castEmbedUrl: null,
    isLoaded: false,
    sdkAvailable: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const sdkModule = await import("@farcaster/miniapp-sdk");
        const sdk = sdkModule.default;

        // Race sdk.context against a timeout — if the host isn't there,
        // postMessage will never resolve
        const context = await Promise.race([
          sdk.context,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        if (cancelled) return;

        if (!context) {
          // SDK loaded but no host responded — not in Warpcast Mini App viewer
          setContextData((prev) => ({ ...prev, isLoaded: true, sdkAvailable: false }));
          return;
        }

        const user = context.user;
        const client = context.client;
        const location = context.location;

        let locationType: MiniAppContextData["location"] = null;
        let embedUrl: string | null = null;

        if (location?.type === "cast_embed") {
          locationType = "cast_embed";
          embedUrl = (location as any)?.cast?.embeds?.[0]?.url || null;
        } else if (location?.type === "notification") {
          locationType = "notification";
        } else if (location?.type === "launcher") {
          locationType = "launcher";
        } else if ((location?.type as string) === "direct_cast") {
          locationType = "direct_cast";
        }

        if (cancelled) return;

        setContextData({
          fid: user?.fid || null,
          username: user?.username || null,
          displayName: user?.displayName || null,
          pfpUrl: user?.pfpUrl || null,
          isClientAdded: client?.added || false,
          location: locationType,
          castEmbedUrl: embedUrl,
          isLoaded: true,
          sdkAvailable: true,
        });
      } catch (error) {
        console.warn("[MiniApp] SDK context unavailable:", error);
        if (!cancelled) {
          setContextData((prev) => ({ ...prev, isLoaded: true, sdkAvailable: false }));
        }
      }
    }

    loadContext();
    return () => { cancelled = true; };
  }, []);

  return contextData;
}
