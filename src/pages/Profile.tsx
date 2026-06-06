/**
 * Public creator profile page at /@<handle>.
 *
 * Anyone (logged in or not) can visit. Shows the creator's avatar +
 * handle + light aggregate stats + recent tips, with a big "Tip me"
 * button linking to the existing /tip/:handle flow. Designed to be
 * share-friendly — social cards unfurl from this URL.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Avatar } from "@coinbase/onchainkit/identity";
import { base } from "viem/chains";
import { getApiUrl } from "@/utils/apiConfig";

interface RecentTip {
  sender_handle: string | null;
  sender_address: string | null;
  amount: number | null;
  token: string;
  memo: string | null;
  created_at: string;
}

interface Profile {
  handle: string;
  displayName: string;
  profilePicture: string | null;
  walletAddress: string;
  bio: string | null;
  bannerUrl: string | null;
  twitterHandle: string | null;
  farcasterHandle: string | null;
  websiteUrl: string | null;
  totalReceived: number;
  tipCount: number;
  uniqueTippers: number;
  recentTips: RecentTip[];
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const ProfilePage = () => {
  // The route is handled via the root catchall (RootCatchAll in App.tsx)
  // because React Router v6 won't match `@` as a literal segment prefix.
  // Parse the handle directly out of the pathname.
  const { pathname } = useLocation();
  const after = pathname.startsWith("/@") ? pathname.slice(2) : "";
  const rawHandle = decodeURIComponent(after.split("/")[0] ?? "").trim();
  const handle = rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!handle) {
        setError("not_found");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${getApiUrl()}/api/profile/${encodeURIComponent(handle)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError("not_found");
        } else {
          setProfile(data as Profile);
        }
      } catch {
        if (!cancelled) setError("network");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Icon icon="ph:circle-notch-bold" className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="rounded-2xl border border-border bg-card p-8 max-w-md text-center">
          <Icon icon="ph:user-circle-minus-bold" className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold mb-1">Profile not found</h1>
          <p className="text-sm text-muted-foreground">
            <code>@{handle}</code> isn't a registered BASEUSDP handle.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
          >
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const fmtAmount = (n: number | null) =>
    typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const useOnchainAvatar = ADDRESS_RE.test(profile.walletAddress);

  const socialLinks: { icon: string; href: string; label: string }[] = [];
  if (profile.twitterHandle) {
    socialLinks.push({
      icon: "ri:twitter-x-fill",
      href: `https://x.com/${profile.twitterHandle}`,
      label: `@${profile.twitterHandle} on X`,
    });
  }
  if (profile.farcasterHandle) {
    socialLinks.push({
      icon: "simple-icons:farcaster",
      href: `https://warpcast.com/${profile.farcasterHandle}`,
      label: `@${profile.farcasterHandle} on Farcaster`,
    });
  }
  if (profile.websiteUrl) {
    socialLinks.push({
      icon: "ph:globe-bold",
      href: profile.websiteUrl,
      label: profile.websiteUrl,
    });
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card overflow-hidden"
        >
          {/* Banner strip */}
          {profile.bannerUrl ? (
            <div
              className="h-32 sm:h-40 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.bannerUrl})` }}
              aria-hidden
            />
          ) : (
            <div className="h-16 sm:h-20 w-full bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15" aria-hidden />
          )}

          <div className="px-6 sm:px-8 pb-8 -mt-12 flex flex-col items-center gap-4 text-center">
            {profile.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt={profile.handle}
                className="w-24 h-24 rounded-full object-cover border-4 border-card shadow-md"
              />
            ) : useOnchainAvatar ? (
              <Avatar
                address={profile.walletAddress as `0x${string}`}
                chain={base}
                className="w-24 h-24 rounded-full border-4 border-card shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/15 border-4 border-card flex items-center justify-center shadow-md">
                <Icon icon="ph:user-bold" className="w-10 h-10 text-primary" />
              </div>
            )}

            <div>
              <h1 className="font-display text-2xl font-bold">{profile.handle}</h1>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {profile.walletAddress.slice(0, 6)}…{profile.walletAddress.slice(-4)}
              </p>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground max-w-md whitespace-pre-line">
                {profile.bio}
              </p>
            )}

            {socialLinks.length > 0 && (
              <div className="flex items-center gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    className="w-9 h-9 rounded-full border border-border bg-secondary/30 hover:bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon icon={s.icon} className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}

            <div className="w-full mt-2 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 25].map((amt) => (
                  <Link
                    key={amt}
                    to={`/tip/${profile.handle}?amount=${amt}`}
                    className="flex items-center justify-center px-2 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-sm font-semibold transition-colors"
                  >
                    ${amt}
                  </Link>
                ))}
              </div>
              <Link
                to={`/tip/${profile.handle}`}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                <Icon icon="ph:hand-coins-bold" className="w-4 h-4" />
                Tip a custom amount
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Received</p>
            <p className="text-xl font-bold mt-1">${profile.totalReceived.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tips</p>
            <p className="text-xl font-bold mt-1">{profile.tipCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tippers</p>
            <p className="text-xl font-bold mt-1">{profile.uniqueTippers}</p>
          </div>
        </motion.div>

        {/* Recent tips */}
        {profile.recentTips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h2 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-wide mb-4">
              Recent tips
            </h2>
            <div className="space-y-2">
              {profile.recentTips.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {t.sender_address && ADDRESS_RE.test(t.sender_address) ? (
                      <Avatar
                        address={t.sender_address as `0x${string}`}
                        chain={base}
                        className="w-6 h-6 rounded-full shrink-0"
                      />
                    ) : null}
                    <span className="font-medium truncate">
                      {t.sender_handle ??
                        (t.sender_address
                          ? `${t.sender_address.slice(0, 6)}…${t.sender_address.slice(-4)}`
                          : "anonymous")}
                    </span>
                    {t.memo && (
                      <span className="text-xs text-muted-foreground italic truncate">
                        "{t.memo}"
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-emerald-500">
                      {fmtAmount(t.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {fmtTime(t.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Powered by{" "}
          <Link to="/" className="underline hover:text-foreground">
            BASEUSDP
          </Link>{" "}
          · USDC tips on Base
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;
