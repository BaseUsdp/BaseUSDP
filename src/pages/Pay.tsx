/**
 * /pay landing page — renders a prefilled payment request from URL params.
 *
 * URL shape: /pay?to=0x…&amount=10&token=USDC&memo=Invoice
 *
 * The page is stateless: everything is encoded in the URL, nothing
 * is fetched server-side. Visitors can pay through BASEUSDP, open the
 * request in a native wallet via `ethereum:` URI, or scan the QR with
 * another device.
 */

import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { isAddress, parseUnits } from "viem";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import AddressDisplay from "@/components/AddressDisplay";

type Token = "USDC" | "USDT";

const TOKEN_ADDRESSES: Record<Token, `0x${string}`> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};
const TOKEN_DECIMALS: Record<Token, number> = { USDC: 6, USDT: 6 };
const BASE_CHAIN_ID = 8453;
const MAX_MEMO_LENGTH = 120;

function sanitizeMemo(raw: string | null): string | null {
  if (!raw) return null;
  // Strip control characters and cap length.
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_MEMO_LENGTH);
}

const Pay = () => {
  const [params] = useSearchParams();

  const to = params.get("to") ?? "";
  const amountRaw = params.get("amount") ?? "";
  const tokenRaw = (params.get("token") ?? "USDC").toUpperCase();
  const memo = sanitizeMemo(params.get("memo"));

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!isAddress(to)) issues.push("Recipient address is missing or invalid.");
    const amountNum = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amountNum) || amountNum <= 0) {
      issues.push("Amount must be a positive number.");
    }
    if (tokenRaw !== "USDC" && tokenRaw !== "USDT") {
      issues.push("Token must be USDC or USDT.");
    }
    return {
      ok: issues.length === 0,
      issues,
      amountNum,
      token: tokenRaw as Token,
    };
  }, [to, amountRaw, tokenRaw]);

  const ethereumUri = useMemo(() => {
    if (!validation.ok) return null;
    const tokenAddress = TOKEN_ADDRESSES[validation.token];
    const decimals = TOKEN_DECIMALS[validation.token];
    let amountWei: bigint;
    try {
      amountWei = parseUnits(amountRaw as `${number}`, decimals);
    } catch {
      return null;
    }
    return `ethereum:${tokenAddress}@${BASE_CHAIN_ID}/transfer?address=${to}&uint256=${amountWei.toString()}`;
  }, [validation, to, amountRaw]);

  const pageUrl =
    typeof window !== "undefined" ? window.location.href : "https://baseusdp.com";

  const copyDetails = async () => {
    const summary = [
      `Pay ${validation.amountNum} ${validation.token}`,
      `To: ${to}`,
      memo ? `Memo: ${memo}` : null,
      `Link: ${pageUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Payment details copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-4">
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="ph:lightning-bold" className="h-5 w-5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Payment Request
              </span>
            </div>
            <Link
              to="/"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              baseusdp.com
            </Link>
          </div>

          {!validation.ok ? (
            <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
              <div className="flex items-center gap-2 font-semibold">
                <Icon icon="ph:warning-bold" className="h-4 w-4" />
                Invalid payment link
              </div>
              <ul className="ml-5 list-disc space-y-1 text-xs">
                {validation.issues.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
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
              <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Amount
              </div>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight">
                  {validation.amountNum.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  })}
                </span>
                <span className="text-lg font-semibold text-muted-foreground">
                  {validation.token}
                </span>
              </div>

              <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                To
              </div>
              <div className="mb-4 truncate rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-sm">
                <AddressDisplay value={to} />
              </div>

              {memo && (
                <>
                  <div className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    Memo
                  </div>
                  <div className="mb-4 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                    {memo}
                  </div>
                </>
              )}

              <div className="mb-4 space-y-2">
                <Link
                  to="/dashboard"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Icon icon="ph:shield-check-bold" className="h-4 w-4" />
                  Pay with BASEUSDP
                </Link>
                {ethereumUri && (
                  <a
                    href={ethereumUri}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-secondary/50"
                  >
                    <Icon icon="ph:wallet-bold" className="h-4 w-4" />
                    Open in wallet
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyDetails}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ph:copy-bold" className="h-4 w-4" />
                  Copy details
                </button>
              </div>

              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  or scan
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex items-center justify-center rounded-xl border border-border bg-white p-4">
                <QRCodeSVG value={pageUrl} size={180} level="M" />
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Powered by BASEUSDP · transferring on Base (chain {BASE_CHAIN_ID})
        </p>
      </div>
    </div>
  );
};

export default Pay;
