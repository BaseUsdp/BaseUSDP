import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { getBadges, type BadgeData } from "@/lib/badges";
import { cn } from "@/lib/utils";

interface BadgeMeta {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  description: string;
  href?: string;
  held: boolean;
  detail?: string | null;
}

const COMING_SOON: BadgeMeta[] = [
  {
    key: "ethos",
    label: "Ethos Score",
    shortLabel: "Ethos",
    icon: "ph:shield-star-bold",
    color: "text-amber-400",
    description: "Onchain reputation score from Ethos Network",
    href: "https://ethos.network",
    held: false,
    detail: "Soon",
  },
  {
    key: "babt",
    label: "Binance Account Bound Token",
    shortLabel: "BABT",
    icon: "ph:identification-card-bold",
    color: "text-yellow-400",
    description: "Binance-verified identity, soulbound",
    href: "https://www.binance.com/babt",
    held: false,
    detail: "Soon",
  },
];

const OnchainBadgesRow = () => {
  const { fullWalletAddress } = useWallet();
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fullWalletAddress) {
      setData(null);
      return;
    }
    setLoading(true);
    getBadges(fullWalletAddress)
      .then(setData)
      .finally(() => setLoading(false));
  }, [fullWalletAddress]);

  const badges: BadgeMeta[] = [
    {
      key: "coinbase_account",
      label: "Coinbase Verified Account",
      shortLabel: "CB Verified",
      icon: "ph:seal-check-bold",
      color: "text-sky-400",
      description: "EAS attestation issued by Coinbase on Base",
      href: "https://www.coinbase.com/onchain-verify",
      held: !!data?.coinbase_verified_account,
    },
    {
      key: "coinbase_country",
      label: "Coinbase Verified Country",
      shortLabel: "CB Country",
      icon: "ph:globe-hemisphere-west-bold",
      color: "text-emerald-400",
      description: "Verified country of residence (EAS, issued by Coinbase)",
      href: "https://www.coinbase.com/onchain-verify",
      held: !!data?.coinbase_verified_country,
      detail: data?.coinbase_verified_country ?? null,
    },
    {
      key: "basename",
      label: "Basename",
      shortLabel: "Basename",
      icon: "ph:address-book-bold",
      color: "text-violet-400",
      description: "You have a Basenames primary name on Base",
      href: "https://www.base.org/names",
      held: !!data?.basename,
      detail: data?.basename ?? null,
    },
    ...COMING_SOON,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon icon="ph:shield-check-bold" className="w-5 h-5 text-primary" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider">
            Onchain badges
          </h3>
        </div>
        {loading && (
          <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <BadgePill key={b.key} badge={b} />
        ))}
      </div>
    </motion.div>
  );
};

const BadgePill = ({ badge }: { badge: BadgeMeta }) => {
  const isSoon = badge.detail === "Soon";
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        badge.held
          ? `border-border bg-secondary ${badge.color}`
          : "border-border/40 bg-secondary/30 text-muted-foreground/60 grayscale",
        badge.href && !isSoon && "hover:border-primary/50 cursor-pointer"
      )}
      title={
        badge.held
          ? `${badge.label}${badge.detail && badge.detail !== "Soon" ? ` — ${badge.detail}` : ""}`
          : isSoon
          ? `${badge.label} — coming soon`
          : `${badge.description}. Click to verify yourself.`
      }
    >
      <Icon icon={badge.icon} className="w-3.5 h-3.5" />
      <span>{badge.shortLabel}</span>
      {badge.detail && (
        <span className="text-[10px] uppercase tracking-wider opacity-75">
          {badge.detail}
        </span>
      )}
    </span>
  );

  if (!badge.href || isSoon) return content;
  return (
    <a href={badge.href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
};

export default OnchainBadgesRow;
