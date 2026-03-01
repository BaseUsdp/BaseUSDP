/**
 * Mini App Layout
 * Mobile-first compact layout (works in 424x695 web viewport + full-screen mobile)
 * Header bar (balance + settings) + content area + bottom tab nav
 * No sidebars — everything single-column
 */

import React from "react";
import { useFarcaster } from "./contexts/FarcasterContext";
import { MiniAppNav } from "./components/MiniAppNav";
import { Loader2 } from "lucide-react";

interface MiniAppLayoutProps {
  children: React.ReactNode;
}

export function MiniAppLayout({ children }: MiniAppLayoutProps) {
  const { isAuthenticated, isAuthenticating, authError, farcasterUsername, balance, isBalanceLoading, authenticate } =
    useFarcaster();

  // Loading state
  if (isAuthenticating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-zinc-400">Connecting to ORB402...</p>
      </div>
    );
  }

  // Auth error state
  if (!isAuthenticated && authError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white px-6">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <p className="text-sm text-zinc-400 text-center mb-4">{authError}</p>
        <button
          onClick={() => authenticate()}
          className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Not authenticated yet
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-zinc-400">Initializing...</p>
      </div>
    );
  }

  const totalBalance = (balance?.usdc || 0) + (balance?.usdt || 0);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
            {farcasterUsername?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm font-medium text-zinc-300">
            @{farcasterUsername || "user"}
          </span>
        </div>
        <div className="text-right">
          {isBalanceLoading ? (
            <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
          ) : (
            <span className="text-sm font-semibold font-mono">
              ${totalBalance.toFixed(2)}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Bottom Nav */}
      <MiniAppNav />
    </div>
  );
}
