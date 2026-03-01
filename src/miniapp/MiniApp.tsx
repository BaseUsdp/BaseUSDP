/**
 * Farcaster Mini App Root Component
 * Entry point rendered at /miniapp/*
 *
 * Wraps children in FarcasterProvider + QueryClientProvider
 * Calls sdk.actions.ready() after first render to dismiss splash screen
 * Shows fallback UI when opened outside Farcaster's iframe
 */

import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FarcasterProvider } from "./contexts/FarcasterContext";
import { MiniAppLayout } from "./MiniAppLayout";
import MiniAppHome from "./pages/MiniAppHome";
import MiniAppSend from "./pages/MiniAppSend";
import MiniAppDeposit from "./pages/MiniAppDeposit";
import MiniAppHistory from "./pages/MiniAppHistory";
import MiniAppPayment from "./pages/MiniAppPayment";

const miniAppQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Detect if we're likely running inside Farcaster/Warpcast
 * Checks for: iframe, SDK message channel, Warpcast user agent, or mobile webview
 */
function isFarcasterContext(): boolean {
  try {
    // Check if inside an iframe
    if (window !== window.parent) return true;
  } catch {
    return true; // cross-origin iframe
  }

  // Check user agent for Warpcast
  const ua = navigator.userAgent || "";
  if (ua.includes("Warpcast") || ua.includes("Farcaster")) return true;

  // Check if opened in a mobile webview (common pattern for Mini Apps)
  const isWebView =
    ua.includes("wv") || // Android WebView
    (ua.includes("Mobile") && !ua.includes("Safari") && ua.includes("AppleWebKit")); // iOS WebView
  if (isWebView) return true;

  // Check for Farcaster SDK message handler on window
  if (typeof (window as any).__farcaster__ !== "undefined") return true;

  // Check URL params that Farcaster might inject
  const params = new URLSearchParams(window.location.search);
  if (params.has("fc_action") || params.has("fc_context")) return true;

  return false;
}

/**
 * Fallback page shown when opening /miniapp outside Warpcast
 */
function OutsideFarcasterFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
        <span className="text-2xl font-bold">O</span>
      </div>
      <h1 className="text-xl font-bold mb-2">ORB402 Mini App</h1>
      <p className="text-sm text-zinc-400 text-center mb-6 max-w-xs">
        This page is designed to run inside Warpcast. Open it from the Farcaster app to send and receive private payments.
      </p>
      <div className="space-y-3 w-full max-w-xs">
        <a
          href="https://warpcast.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-center transition-colors"
        >
          Open Warpcast
        </a>
        <a
          href="https://orb402.com/dashboard"
          className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium text-zinc-300 text-center transition-colors"
        >
          Go to ORB402 Dashboard
        </a>
      </div>
      <p className="text-xs text-zinc-600 mt-8">
        Privacy-First Payments on Base
      </p>
    </div>
  );
}

function MiniAppInner() {
  useEffect(() => {
    import("@farcaster/miniapp-sdk")
      .then(({ default: sdk }) => sdk.actions.ready())
      .catch(() => { /* Not in Farcaster context */ });
  }, []);

  return (
    <MiniAppLayout>
      <Routes>
        <Route index element={<MiniAppHome />} />
        <Route path="send" element={<MiniAppSend />} />
        <Route path="deposit" element={<MiniAppDeposit />} />
        <Route path="history" element={<MiniAppHistory />} />
        <Route path="pay/:id" element={<MiniAppPayment />} />
      </Routes>
    </MiniAppLayout>
  );
}

export default function MiniApp() {
  const [envChecked, setEnvChecked] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);

  useEffect(() => {
    const detected = isFarcasterContext();

    if (detected) {
      setIsFarcaster(true);
      setEnvChecked(true);
    } else {
      // If simple detection fails, try initializing the SDK as final check
      import("@farcaster/miniapp-sdk")
        .then(async ({ default: sdk }) => {
          const context = await Promise.race([
            sdk.context,
            new Promise((_, reject) => setTimeout(() => reject("timeout"), 3000)),
          ]);
          setIsFarcaster(!!context);
          setEnvChecked(true);
        })
        .catch(() => {
          setIsFarcaster(false);
          setEnvChecked(true);
        });
    }
  }, []);

  // Still detecting
  if (!envChecked) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Outside Farcaster — show fallback
  if (!isFarcaster) {
    return <OutsideFarcasterFallback />;
  }

  return (
    <QueryClientProvider client={miniAppQueryClient}>
      <FarcasterProvider>
        <MiniAppInner />
      </FarcasterProvider>
    </QueryClientProvider>
  );
}
