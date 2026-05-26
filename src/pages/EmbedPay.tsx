/**
 * /embed/pay — popup target for the paywall.js embed script.
 *
 * URL: /embed/pay?to=<addr>&amount=<n>&token=USDC|USDT&article=<id>&from=<origin>
 *
 * Self-contained: connects directly to window.ethereum (no Veil / no auth
 * session), switches to Base if needed, sends an ERC-20 transfer, then
 * postMessages the success to window.opener with { articleId, txHash } so
 * the embedding page (paywall.js) can persist the unlock and reveal the
 * gated content. Closes itself on success.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { isAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import AddressDisplay from "@/components/AddressDisplay";
import { sendErc20WithOptionalPaymaster } from "@/lib/paymaster";

type Token = "USDC" | "USDT";

const TOKEN_ADDRESSES: Record<Token, Address> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};
const TOKEN_DECIMALS: Record<Token, number> = { USDC: 6, USDT: 6 };
const BASE_CHAIN_ID_HEX = "0x2105";
const BASE_CHAIN_ID = 8453;

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type Step = "idle" | "connecting" | "switching" | "sending" | "success" | "error";

const EmbedPay = () => {
  const [params] = useSearchParams();

  const to = params.get("to") ?? "";
  const amountRaw = params.get("amount") ?? "";
  const tokenRaw = (params.get("token") ?? "USDC").toUpperCase();
  const articleId = params.get("article") ?? "";
  const fromOrigin = params.get("from") ?? "";
  // `?preview=success` jumps straight to the success state for screenshots —
  // skips wallet connect / signing entirely. Visual only, no real payment.
  const previewMode = params.get("preview") === "success";

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
    if (!articleId) issues.push("Missing article id — open this page from a paywall, not directly.");
    if (!fromOrigin) issues.push("Missing return origin.");
    return {
      ok: issues.length === 0,
      issues,
      amountNum,
      token: tokenRaw as Token,
    };
  }, [to, amountRaw, tokenRaw, articleId, fromOrigin]);

  const [step, setStep] = useState<Step>(previewMode ? "success" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(
    previewMode
      ? "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890dead"
      : null,
  );
  const [sponsored, setSponsored] = useState<boolean>(previewMode);
  const [account, setAccount] = useState<Address | null>(null);

  // Discover an EVM provider on the visitor's browser. Don't auto-prompt —
  // wait for the Pay button so a popup blocker doesn't kill us.
  const getProvider = (): any | null => {
    const w = window as any;
    return w.ethereum ?? null;
  };

  const handlePay = async () => {
    setError(null);
    setStep("connecting");
    const provider = getProvider();
    if (!provider) {
      setError("No EVM wallet found in this browser. Install MetaMask, Rabby, Coinbase Wallet, or another wallet.");
      setStep("error");
      return;
    }

    try {
      const accts: string[] = await provider.request({ method: "eth_requestAccounts" });
      if (!accts || accts.length === 0) {
        throw new Error("No account returned from wallet");
      }
      const addr = accts[0] as Address;
      setAccount(addr);

      // Make sure we're on Base.
      setStep("switching");
      const currentChain: string = await provider.request({ method: "eth_chainId" });
      if (currentChain.toLowerCase() !== BASE_CHAIN_ID_HEX) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          });
        } catch (switchErr: any) {
          if (switchErr?.code === 4902) {
            // Chain not added — request it.
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: BASE_CHAIN_ID_HEX,
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }],
            });
          } else {
            throw switchErr;
          }
        }
      }

      // Send the ERC-20 transfer. Uses CDP Paymaster (gasless) when the
      // wallet supports EIP-5792 paymasterService on Base; otherwise falls
      // back to a standard signed transfer where the user pays gas.
      setStep("sending");
      const { txHash: hash, sponsored: wasSponsored } =
        await sendErc20WithOptionalPaymaster({
          provider,
          from: addr,
          tokenAddress: TOKEN_ADDRESSES[validation.token],
          recipient: to as Address,
          amount: amountRaw,
          decimals: TOKEN_DECIMALS[validation.token],
        });
      setTxHash(hash);
      setSponsored(wasSponsored);
      setStep("success");

      // Notify the opener page (paywall.js) so it can unlock content.
      try {
        if (window.opener && fromOrigin) {
          window.opener.postMessage(
            {
              type: "baseusdp.paywall.unlocked",
              articleId,
              txHash: hash,
            },
            fromOrigin
          );
        }
      } catch (postErr) {
        console.warn("[EmbedPay] postMessage to opener failed:", postErr);
      }

      // Give the opener a moment to receive the message before closing.
      setTimeout(() => {
        try { window.close(); } catch { /* noop */ }
      }, 1500);
    } catch (err: any) {
      console.error("[EmbedPay] error:", err);
      if (err?.code === 4001 || /reject/i.test(err?.message || "")) {
        setError("Cancelled in wallet.");
      } else {
        setError(err?.shortMessage || err?.message || "Payment failed.");
      }
      setStep("error");
    }
  };

  if (!validation.ok) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="ph:warning-bold" className="w-5 h-5 text-red-400" />
            <h1 className="font-display text-lg font-bold">Can't load this paywall</h1>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            {validation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Icon icon="ph:lock-key-bold" className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">Unlock this content</h1>
            <p className="text-xs text-muted-foreground">via BASEUSDP on Base</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-4 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-mono font-bold">
              ${validation.amountNum.toFixed(2)} {validation.token}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-mono text-xs">
              <AddressDisplay value={to} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Network</span>
            <span className="font-mono text-xs">Base</span>
          </div>
        </div>

        {step === "success" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Icon icon="ph:check-circle-bold" className="w-5 h-5" />
              <span className="text-sm font-medium">Payment sent. Returning you to the article…</span>
            </div>
            {sponsored && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Icon icon="ph:sparkle-bold" className="w-3.5 h-3.5" />
                <span>Gas sponsored by BASEUSDP — you paid $0 in fees</span>
              </div>
            )}
            {txHash && (
              <p className="text-xs text-muted-foreground font-mono break-all">
                tx: {txHash}
              </p>
            )}
          </div>
        ) : (
          <>
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handlePay}
              disabled={step === "connecting" || step === "switching" || step === "sending"}
            >
              {step === "connecting" && (
                <>
                  <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                  Connecting wallet…
                </>
              )}
              {step === "switching" && (
                <>
                  <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                  Switching to Base…
                </>
              )}
              {step === "sending" && (
                <>
                  <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                  Sending {validation.token}…
                </>
              )}
              {(step === "idle" || step === "error") && (
                <>
                  <Icon icon="ph:lock-key-open-bold" className="w-4 h-4 mr-2" />
                  Pay ${validation.amountNum.toFixed(2)} {validation.token}
                </>
              )}
            </Button>

            {error && (
              <p className="mt-3 text-xs text-red-400">{error}</p>
            )}

            {account && step !== "success" && (
              <p className="mt-3 text-[11px] text-muted-foreground font-mono">
                Paying from {account.slice(0, 6)}…{account.slice(-4)}
              </p>
            )}
          </>
        )}

        <p className="mt-4 text-[11px] text-muted-foreground text-center">
          Payment goes directly to the article's wallet. BASEUSDP never custodies your funds.
        </p>
      </div>
    </div>
  );
};

export default EmbedPay;
