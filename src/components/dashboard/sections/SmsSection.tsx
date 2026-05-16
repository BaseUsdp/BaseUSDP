import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import SmsDisclosure from "@/components/sms/SmsDisclosure";
import SmsSendCard from "@/components/sms/SmsSendCard";
import SmsHistoryCard from "@/components/sms/SmsHistoryCard";

const SmsSection = () => {
  const { isConnected } = useWallet();
  const [reloadTick, setReloadTick] = useState(0);
  const refresh = () => setReloadTick((t) => t + 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 p-4 sm:p-6"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              SMS Pay<span className="text-primary">.</span>
            </h1>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                borderColor: "hsl(var(--beam-cyan))",
                color: "hsl(var(--beam-cyan))",
              }}
            >
              On-chain · Base
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            Lock USDC into the escrow, get a claim link, share it however you
            want — WhatsApp, Telegram, iMessage, email, anything. The
            recipient connects a wallet on the claim page and the USDC
            settles to them through the privacy pool.
          </p>
        </div>
      </div>

      <SmsDisclosure />

      {!isConnected && (
        <div
          className="flex items-start gap-2 rounded-lg border px-4 py-3 text-xs"
          style={{
            borderColor: "var(--dash-border)",
            background: "var(--dash-overlay)",
            color: "var(--dash-text-muted)",
          }}
        >
          <Icon icon="ph:wallet-bold" className="mt-0.5 h-4 w-4 shrink-0" />
          Connect a wallet on Base to generate a claim link.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SmsSendCard onSent={refresh} />
        <SmsHistoryCard reloadTick={reloadTick} />
      </div>

      <details
        className="rounded-xl border p-4 text-xs"
        style={{
          borderColor: "var(--dash-border)",
          background: "var(--dash-overlay)",
          color: "var(--dash-text-muted)",
        }}
      >
        <summary
          className="cursor-pointer text-sm font-semibold"
          style={{ color: "var(--dash-text)" }}
        >
          How it works
        </summary>
        <ul className="mt-3 space-y-1.5 leading-relaxed">
          <li>
            You enter an amount and click <em>Generate claim link</em>.
            Your wallet signs two transactions the first time
            (USDC approval + deposit), then just one each subsequent send.
          </li>
          <li>
            USDC is locked in the on-chain <code className="font-mono">
              SMSEscrow
            </code> contract on Base, keyed by a random 32-byte token.
          </li>
          <li>
            You share the resulting link with the recipient over any channel
            you trust. The link is unguessable — only someone you give it to
            can claim it.
          </li>
          <li>
            The recipient opens the link, connects any wallet, and signs a
            single claim transaction. USDC is delivered through the privacy
            pool's external transfer path, so on-chain observers can't link
            your deposit to the recipient's address.
          </li>
          <li>
            Recipient receives the deposit amount minus the pool's 0.5%
            maintenance fee. If nothing happens in 24 hours, anyone (including
            you) can call <code className="font-mono">refund()</code> to send
            the USDC back to your wallet — no admin, no trusted relay.
          </li>
        </ul>
      </details>
    </motion.div>
  );
};

export default SmsSection;
