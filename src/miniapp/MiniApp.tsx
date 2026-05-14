/**
 * Farcaster Mini App Root Component
 * Entry point rendered at /miniapp/*
 *
 * Includes error boundary to catch SDK crashes gracefully.
 */

import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FarcasterProvider } from "./contexts/FarcasterContext";
import { MiniAppLayout } from "./MiniAppLayout";
import MiniAppHome from "./pages/MiniAppHome";
import MiniAppSend from "./pages/MiniAppSend";
import MiniAppDeposit from "./pages/MiniAppDeposit";
import MiniAppHistory from "./pages/MiniAppHistory";
import MiniAppPayment from "./pages/MiniAppPayment";
import MiniAppSettings from "./pages/MiniAppSettings";

const miniAppQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Error boundary to catch SDK crashes
 */
class MiniAppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || "Something went wrong" };
  }

  componentDidCatch(error: Error) {
    console.error("[MiniApp] Uncaught error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
            <span className="text-2xl font-bold">O</span>
          </div>
          <h1 className="text-xl font-bold mb-2">BASEUSDP Mini App</h1>
          <p className="text-sm text-zinc-400 text-center mb-6 max-w-xs">
            This Mini App needs to be opened from inside Warpcast. Tap a cast
            embed or launch it from the Mini Apps section.
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
              href="https://www.baseusdp.com/dashboard"
              className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium text-zinc-300 text-center transition-colors"
            >
              Go to BASEUSDP Dashboard
            </a>
          </div>
          <p className="text-[10px] text-zinc-700 mt-6 font-mono">
            {this.state.error}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

function MiniAppInner() {
  useEffect(() => {
    import("@farcaster/miniapp-sdk")
      .then(({ default: sdk }) => sdk.actions.ready())
      .catch(() => {});
  }, []);

  return (
    <MiniAppLayout>
      <Routes>
        <Route index element={<MiniAppHome />} />
        <Route path="send" element={<MiniAppSend />} />
        <Route path="deposit" element={<MiniAppDeposit />} />
        <Route path="history" element={<MiniAppHistory />} />
        <Route path="settings" element={<MiniAppSettings />} />
        <Route path="pay/:id" element={<MiniAppPayment />} />
      </Routes>
    </MiniAppLayout>
  );
}

export default function MiniApp() {
  return (
    <MiniAppErrorBoundary>
      <QueryClientProvider client={miniAppQueryClient}>
        <FarcasterProvider>
          <MiniAppInner />
        </FarcasterProvider>
      </QueryClientProvider>
    </MiniAppErrorBoundary>
  );
}
