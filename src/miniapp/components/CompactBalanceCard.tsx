/**
 * Compact Balance Card
 * Adapted from BalanceDisplay.tsx for Mini App's smaller viewport
 * Shows encrypted balance with privacy indicator
 */

import { Shield, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useFarcaster } from "../contexts/FarcasterContext";

export function CompactBalanceCard() {
  const { balance, isBalanceLoading, refreshBalance } = useFarcaster();
  const [isHidden, setIsHidden] = useState(false);

  const usdcBalance = balance?.usdc || 0;
  const usdtBalance = balance?.usdt || 0;
  const totalBalance = usdcBalance + usdtBalance;

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800/50 rounded-2xl p-4 border border-zinc-700/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-xs text-zinc-400 font-medium">
            Private Balance
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsHidden(!isHidden)}
            className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-400 transition-colors"
          >
            {isHidden ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={refreshBalance}
            disabled={isBalanceLoading}
            className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isBalanceLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Total Balance */}
      <div className="mb-3">
        {isBalanceLoading ? (
          <div className="w-32 h-8 bg-zinc-700/50 rounded animate-pulse" />
        ) : (
          <span className="text-2xl font-bold font-mono">
            {isHidden ? "$•••••" : `$${totalBalance.toFixed(2)}`}
          </span>
        )}
      </div>

      {/* Breakdown */}
      {!isHidden && (
        <div className="flex gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>USDC: ${usdcBalance.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>USDT: ${usdtBalance.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
