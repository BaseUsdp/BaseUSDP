/**
 * Farcaster Mini App Context Hook
 * Wraps sdk.context to parse user info, client state, and launch location
 * Uses dynamic import to avoid crashes outside Farcaster iframe
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
  });

  useEffect(() => {
    async function loadContext() {
      try {
        const { default: sdk } = await import("@farcaster/miniapp-sdk");
        const context = await sdk.context;

        const user = context?.user;
        const client = context?.client;
        const location = context?.location;

        let locationType: MiniAppContextData["location"] = null;
        let embedUrl: string | null = null;

        if (location?.type === "cast_embed") {
          locationType = "cast_embed";
          embedUrl = (location as any)?.cast?.embeds?.[0]?.url || null;
        } else if (location?.type === "notification") {
          locationType = "notification";
        } else if (location?.type === "launcher") {
          locationType = "launcher";
        } else if (location?.type === "direct_cast") {
          locationType = "direct_cast";
        }

        setContextData({
          fid: user?.fid || null,
          username: user?.username || null,
          displayName: user?.displayName || null,
          pfpUrl: user?.pfpUrl || null,
          isClientAdded: client?.added || false,
          location: locationType,
          castEmbedUrl: embedUrl,
          isLoaded: true,
        });
      } catch (error) {
        console.warn("[MiniApp] Failed to load SDK context:", error);
        setContextData((prev) => ({ ...prev, isLoaded: true }));
      }
    }

    loadContext();
  }, []);

  return contextData;
}
