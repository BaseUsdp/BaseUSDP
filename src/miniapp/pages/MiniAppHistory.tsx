/**
 * Mini App Transaction History Page
 * Compact list adapted from TransactionHistory component
 * Calls existing GET /api/history/{wallet} endpoint
 */

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Clock, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFarcaster } from "../contexts/FarcasterContext";
import farcasterApi from "../services/farcasterApi";

interface Transaction {
  signature: string;
  timestamp: string | number;
  type: string;
  status: string;
  from?: string;
  to?: string;
  amount?: number;
  fee?: number;
  memo?: string;
}

export default function MiniAppHistory() {
  const navigate = useNavigate();
  const { walletAddress, bearerToken } = useFarcaster();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (bearerToken) {
    farcasterApi.setToken(bearerToken);
  }

  const fetchHistory = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await farcasterApi.getTransactionHistory(walletAddress.toLowerCase(), 20);
      setTransactions(result.transactions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [walletAddress]);

  const formatDate = (timestamp: string | number) => {
    const date = typeof timestamp === "string"
      ? new Date(timestamp)
      : new Date(timestamp * 1000);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHash = (hash: string) =>
    `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/miniapp")} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">History</h1>
        </div>
        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading && transactions.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchHistory} className="text-xs text-indigo-400 mt-2">
            Retry
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((tx) => {
            const isOutgoing =
              tx.from?.toLowerCase() === walletAddress?.toLowerCase();
            const isIncoming =
              tx.to?.toLowerCase() === walletAddress?.toLowerCase();

            return (
              <div
                key={tx.signature}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
              >
                {/* Direction Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isOutgoing
                      ? "bg-red-500/10"
                      : isIncoming
                        ? "bg-green-500/10"
                        : "bg-zinc-700/50"
                  }`}
                >
                  {isOutgoing ? (
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 text-green-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium capitalize">
                      {tx.type}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        tx.status === "success"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <span>{formatDate(tx.timestamp)}</span>
                    <span>·</span>
                    <span className="font-mono">{truncateHash(tx.signature)}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  {tx.amount != null && (
                    <span
                      className={`text-sm font-mono font-medium ${
                        isOutgoing ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {isOutgoing ? "-" : "+"}${tx.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
