/**
 * Farcaster Mini App Root Component
 * Entry point rendered at /miniapp/*
 *
 * Always renders the Mini App — the FarcasterContext handles auth gracefully.
 * If SDK is unavailable (opened outside Warpcast), auth will fail and
 * MiniAppLayout shows an error with retry option.
 */

import { useEffect } from "react";
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
  return (
    <QueryClientProvider client={miniAppQueryClient}>
      <FarcasterProvider>
        <MiniAppInner />
      </FarcasterProvider>
    </QueryClientProvider>
  );
}
