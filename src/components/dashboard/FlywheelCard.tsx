import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/utils/apiConfig";

interface FlywheelStatus {
  configured: boolean;
  chain?: string;
  wallet?: string;
  explorer?: string;
  balance?: {
    usdc: number;
    raw: string;
    decimals: number;
  };
  usdpBurnt?: {
    amount: number;
    raw: string;
    decimals: number;
    symbol: string;
    token: string;
    note?: string;
  };
  allocation?: {
    buybacks: number;
    burns: number;
    rewards: number;
    note?: string;
  };
  error?: string;
}

const truncateAddress = (addr: string) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

const formatUsd = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatToken = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });

const FlywheelCard = () => {
  const [status, setStatus] = useState<FlywheelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);
      const apiUrl = getApiUrl();
      const resp = await fetch(`${apiUrl}/api/flywheel/status`);
      const data = (await resp.json()) as FlywheelStatus;
      setStatus(data);
    } catch (err: any) {
      console.error("FlywheelCard fetch failed", err);
      setError("Could not load flywheel status");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading BASEUSDP flywheel…
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold">BASEUSDP Flywheel</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {error || "Unavailable"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchStatus()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" /> BASEUSDP Flywheel
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Flywheel wallet not yet configured on this deployment.
        </p>
      </div>
    );
  }

  const balanceUsd = status.balance?.usdc ?? 0;
  const burntAmount = status.usdpBurnt?.amount ?? 0;
  const burntSymbol = status.usdpBurnt?.symbol ?? "USDP";
  const alloc = status.allocation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" /> BASEUSDP Flywheel
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Base · fee revenue routed to a dedicated treasury wallet
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchStatus(true)}
          disabled={isRefreshing}
          aria-label="Refresh flywheel status"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="text-xs text-muted-foreground">Wallet balance (USDC)</div>
          <div className="font-display text-2xl font-bold mt-1">
            ${formatUsd(balanceUsd)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="text-xs text-muted-foreground">{burntSymbol} Burnt</div>
          <div className="font-display text-2xl font-bold mt-1 flex items-center gap-1">
            <Flame className="h-4 w-4 text-orange-500" />
            {formatToken(burntAmount)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{burntSymbol} burned by flywheel</div>
        </div>
      </div>

      {alloc && (
        <div className="space-y-2 mb-4">
          <div className="text-xs text-muted-foreground">Indicative allocation</div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-background/40">
            <div
              className="bg-sky-500"
              style={{ width: `${alloc.buybacks}%` }}
              title={`Buybacks ${alloc.buybacks}%`}
            />
            <div
              className="bg-orange-500"
              style={{ width: `${alloc.burns}%` }}
              title={`Burns ${alloc.burns}%`}
            />
            <div
              className="bg-emerald-500"
              style={{ width: `${alloc.rewards}%` }}
              title={`Rewards ${alloc.rewards}%`}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Buybacks {alloc.buybacks}%
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Burns {alloc.burns}%
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Rewards {alloc.rewards}%
            </span>
          </div>
        </div>
      )}

      {status.wallet && (
        <a
          href={status.explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {truncateAddress(status.wallet)}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </motion.div>
  );
};

export default FlywheelCard;
