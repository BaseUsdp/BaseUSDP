/**
 * /tip/:handle public landing page.
 *
 * Resolves a `@handle` against /api/user/lookup (which deliberately does
 * NOT expose the wallet address) and renders a small profile card with
 * an amount + token form. Submitting forwards the visitor to
 * /dashboard?tab=payments&send-handle=… so the existing internal-
 * transfer flow handles the actual payment server-side.
 *
 * Trade-off (deliberate, see tech_updates.md #8): only signed-in
 * BASEUSDP visitors can tip in v1. External-wallet tipping requires
 * exposing the recipient's address, which is a v2 opt-in decision.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getApiUrl } from "@/utils/apiConfig";

type Token = "USDC" | "USDT";
const TOKENS: Token[] = ["USDC", "USDT"];

interface LookupResponse {
  success: boolean;
  username?: string;
  profile_picture?: string | null;
  has_deposited?: boolean;
  error?: string;
}

const Tip = () => {
  const { handle: rawHandle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  const cleanHandle = useMemo(() => {
    if (!rawHandle) return "";
    return rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;
  }, [rawHandle]);

  const [profile, setProfile] = useState<LookupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<Token>("USDC");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!cleanHandle) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetch(
      `${getApiUrl()}/api/user/lookup?username=${encodeURIComponent(cleanHandle)}`
    )
      .then((r) => r.json())
      .then((data: LookupResponse) => {
        if (cancelled) return;
        if (!data.success) {
          setNotFound(true);
          setProfile(null);
        } else {
          setProfile(data);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanHandle]);

  const tipUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://baseusdp.com/tip/@${cleanHandle}`;

  const amountNum = parseFloat(amount || "0");
  const canSubmit = !!profile && amountNum > 0;

  const handleTip = () => {
    if (!canSubmit || !profile?.username) return;
    const qs = new URLSearchParams({
      tab: "payments",
      "send-handle": `@${profile.username}`,
      "send-amount": amount,
      "send-token": token,
    });
    if (memo.trim()) qs.set("send-memo", memo.trim().slice(0, 120));
    navigate(`/dashboard?${qs.toString()}`);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(tipUrl);
      toast.success("Tip link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-4">
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="ph:hand-coins-bold" className="h-5 w-5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Tip Jar
              </span>
            </div>
            <Link
              to="/"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              baseusdp.com
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                icon="ph:circle-notch-bold"
                className="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
          ) : notFound || !profile ? (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
              <div className="flex items-center gap-2 font-semibold">
                <Icon icon="ph:user-bold" className="h-4 w-4" />
                Handle not found
              </div>
              <p className="text-xs">
                @{cleanHandle || "—"} doesn't exist on BASEUSDP yet.
              </p>
              <Link
                to="/dashboard"
                className="mt-2 inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
              >
                <Icon icon="ph:arrow-right-bold" className="h-3.5 w-3.5" />
                Go to dashboard
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary/30">
                  {profile.profile_picture ? (
                    <img
                      src={profile.profile_picture}
                      alt={profile.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon="ph:user-bold"
                      className="h-8 w-8 text-muted-foreground"
                    />
                  )}
                </div>
                <div className="text-center">
                  <div className="font-display text-xl font-bold">
                    @{profile.username}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    accepts tips on BASEUSDP
                  </div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToken(t)}
                    className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
                    style={{
                      borderColor:
                        token === t ? "hsl(var(--primary))" : "var(--border)",
                      background:
                        token === t
                          ? "rgba(99,102,241,0.08)"
                          : "transparent",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Amount ({token})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="5.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-lg outline-none focus:border-primary"
                />
              </label>

              <label className="mb-4 block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Note (optional)
                </span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="thanks for shipping!"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <button
                type="button"
                onClick={handleTip}
                disabled={!canSubmit}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon icon="ph:paper-plane-tilt-bold" className="h-4 w-4" />
                Tip {amountNum > 0 ? `${amountNum} ${token}` : token}
              </button>

              <p className="mb-4 text-center text-[10px] leading-relaxed text-muted-foreground">
                Tips route through BASEUSDP's internal transfer — recipient
                address is never exposed. You'll need to sign in to BASEUSDP
                to complete the tip.
              </p>

              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  or share this page
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border border-border bg-white p-3">
                  <QRCodeSVG value={tipUrl} size={140} level="M" />
                </div>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ph:copy-bold" className="h-3.5 w-3.5" />
                  Copy tip URL
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Powered by BASEUSDP · USDC settles encrypted on the recipient's side
        </p>
      </div>
    </div>
  );
};

export default Tip;
