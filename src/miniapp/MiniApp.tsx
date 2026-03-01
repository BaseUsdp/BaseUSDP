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
 * Detect if we're running inside a Farcaster iframe
 */
function isFarcasterFrame(): boolean {
  try {
    return window !== window.parent;
  } catch {
    return true; // cross-origin iframe
  }
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
  const [isInFrame, setIsInFrame] = useState<boolean | null>(null);

  useEffect(() => {
    setIsInFrame(isFarcasterFrame());
  }, []);

  // Still detecting
  if (isInFrame === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Outside Farcaster — show fallback
  if (!isInFrame) {
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
