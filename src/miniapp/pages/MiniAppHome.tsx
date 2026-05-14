/**
 * Mini App Home Page
 * Compact balance card + quick action buttons
 * If no balance: prominent "Deposit USDC to get started" CTA
 */

import { useNavigate } from "react-router-dom";
import { Send, ArrowDownToLine, CreditCard } from "lucide-react";
import { CompactBalanceCard } from "../components/CompactBalanceCard";
import { useFarcaster } from "../contexts/FarcasterContext";

export default function MiniAppHome() {
  const navigate = useNavigate();
  const { balance, isBalanceLoading } = useFarcaster();

  const totalBalance = (balance?.usdc || 0) + (balance?.usdt || 0);
  const hasBalance = totalBalance > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Balance Card */}
      <CompactBalanceCard />

      {/* No Balance CTA */}
      {!isBalanceLoading && !hasBalance && (
        <button
          onClick={() => navigate("/miniapp/deposit")}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-center hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          <ArrowDownToLine className="w-5 h-5 mx-auto mb-1.5" />
          <span className="text-sm font-semibold">
            Deposit USDC to get started
          </span>
          <p className="text-xs text-indigo-200 mt-0.5">
            Privacy-protected on Base
          </p>
        </button>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => navigate("/miniapp/send")}
          className="flex flex-col items-center gap-1.5 py-3.5 bg-zinc-800/50 border border-zinc-700/30 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Send className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xs font-medium text-zinc-300">Send</span>
        </button>

        <button
          onClick={() => navigate("/miniapp/deposit")}
          className="flex flex-col items-center gap-1.5 py-3.5 bg-zinc-800/50 border border-zinc-700/30 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
            <ArrowDownToLine className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-xs font-medium text-zinc-300">Deposit</span>
        </button>

        <button
          onClick={() => navigate("/miniapp/history")}
          className="flex flex-col items-center gap-1.5 py-3.5 bg-zinc-800/50 border border-zinc-700/30 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xs font-medium text-zinc-300">History</span>
        </button>
      </div>

      {/* Privacy badge */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-zinc-500">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Protected by ZK proofs on Base
      </div>
    </div>
  );
}
