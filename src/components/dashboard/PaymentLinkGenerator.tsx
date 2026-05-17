/**
 * Compose a shareable payment-link URL: pick recipient + token + amount
 * + memo and get a `baseusdp.com/pay?…` URL plus QR + share buttons.
 *
 * Everything is encoded in the URL — no server-side state. Recipient
 * defaults to the connected wallet so this doubles as a tip-jar setup.
 */

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";

type Token = "USDC" | "USDT";
const TOKENS: Token[] = ["USDC", "USDT"];

const PaymentLinkGenerator = () => {
  const { fullWalletAddress, isConnected } = useWallet();
  const [recipient, setRecipient] = useState<string>("");
  const [token, setToken] = useState<Token>("USDC");
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  const effectiveRecipient = recipient.trim() || fullWalletAddress || "";
  const amountNum = parseFloat(amount || "0");
  const isRecipientValid = isAddress(effectiveRecipient);
  const isAmountValid = amountNum > 0;
  const isValid = isRecipientValid && isAmountValid;

  const linkUrl = useMemo(() => {
    if (!isValid) return null;
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://baseusdp.com";
    const qs = new URLSearchParams({
      to: effectiveRecipient,
      amount,
      token,
    });
    const memoClean = memo.trim();
    if (memoClean) qs.set("memo", memoClean.slice(0, 120));
    return `${base}/pay?${qs.toString()}`;
  }, [isValid, effectiveRecipient, amount, token, memo]);

  const copyLink = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success("Payment link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const tweetIntent = useMemo(() => {
    if (!linkUrl) return null;
    const text = `pay me ${amountNum} ${token}${memo.trim() ? ` for ${memo.trim()}` : ""}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(linkUrl)}`;
  }, [linkUrl, amountNum, token, memo]);

  const warpcastIntent = useMemo(() => {
    if (!linkUrl) return null;
    const text = `pay me ${amountNum} ${token}${memo.trim() ? ` for ${memo.trim()}` : ""}`;
    return `https://warpcast.com/~/compose?text=${encodeURIComponent(text + "\n" + linkUrl)}`;
  }, [linkUrl, amountNum, token, memo]);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
          <Icon icon="ph:link-bold" className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Payment Link</h3>
          <p className="text-xs text-muted-foreground">
            Generate a shareable URL anyone can pay — no account required.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {TOKENS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setToken(t)}
              className="rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                borderColor:
                  token === t ? "hsl(var(--primary))" : "var(--border)",
                background: token === t ? "rgba(99,102,241,0.08)" : "transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Amount ({token})
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-lg outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Recipient
            {!recipient.trim() && isConnected && fullWalletAddress && (
              <span className="ml-2 normal-case tracking-normal text-[10px] text-muted-foreground">
                (defaults to your wallet)
              </span>
            )}
          </span>
          <input
            type="text"
            placeholder={fullWalletAddress || "0x…"}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm outline-none focus:border-primary"
          />
          {recipient.trim() && !isRecipientValid && (
            <p className="mt-1 text-[11px] text-amber-500">
              Enter a valid 0x address.
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Memo (optional)
          </span>
          <input
            type="text"
            maxLength={120}
            placeholder="Invoice #123, coffee, etc."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        {isValid && linkUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Your link
              </div>
              <code className="block break-all text-xs">{linkUrl}</code>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Icon icon="ph:copy-bold" className="h-4 w-4" />
                Copy link
              </button>
              {tweetIntent && (
                <a
                  href={tweetIntent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ri:twitter-x-fill" className="h-4 w-4" />
                  Share on X
                </a>
              )}
              {warpcastIntent && (
                <a
                  href={warpcastIntent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ph:lightning-bold" className="h-4 w-4" />
                  Cast on Farcaster
                </a>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 pt-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Or have them scan
              </span>
              <div className="rounded-xl border border-border bg-white p-3">
                <QRCodeSVG value={linkUrl} size={160} level="M" />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
            Enter an amount {recipient.trim() ? "and a valid recipient address" : ""}
            {" "}to generate a link.
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentLinkGenerator;
