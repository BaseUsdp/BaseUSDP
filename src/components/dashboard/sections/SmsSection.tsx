import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import SmsDisclosure from "@/components/sms/SmsDisclosure";
import SmsSendCard from "@/components/sms/SmsSendCard";
import SmsHistoryCard from "@/components/sms/SmsHistoryCard";
import SmsQueueCard from "@/components/sms/SmsQueueCard";
import SmsOfflineBadge from "@/components/sms/SmsOfflineBadge";
import {
  installOnlineDrainer,
  listQueued,
  subscribeQueue,
} from "@/lib/sms/offlineQueue";

const SmsSection = () => {
  const { isConnected } = useWallet();
  const [reloadTick, setReloadTick] = useState(0);
  const [queuedCount, setQueuedCount] = useState(() => listQueued().length);

  useEffect(() => {
    installOnlineDrainer();
    const unsub = subscribeQueue(() => setQueuedCount(listQueued().length));
    return () => {
      unsub();
    };
  }, []);

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
              Local preview
            </span>
            <SmsOfflineBadge queuedCount={queuedCount} />
          </div>
          <p className="text-muted-foreground mt-1">
            Send private USDC to any E.164 phone number. The recipient doesn't
            need a wallet to receive the link — only to claim. Unclaimed sends
            auto-refund to you in 24 hours.
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
          Connect a wallet to sign send commitments.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SmsSendCard onSent={refresh} />
        <SmsHistoryCard reloadTick={reloadTick} onMutated={refresh} />
      </div>

      <SmsQueueCard onChanged={refresh} />

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
          How this works locally
        </summary>
        <ul className="mt-3 space-y-1.5 leading-relaxed">
          <li>
            Phone numbers are normalized to E.164 and{" "}
            <code className="font-mono">keccak256</code>-hashed in your browser
            before they touch the network.
          </li>
          <li>
            The send commitment{" "}
            <code className="font-mono">(phoneHash, amount, claimToken)</code>{" "}
            is signed by your wallet with{" "}
            <code className="font-mono">personal_sign</code>.
          </li>
          <li>
            The local API stores the escrow in{" "}
            <code className="font-mono">data/sms-escrow.json</code>. In
            production this would be the on-chain{" "}
            <code className="font-mono">SMSEscrow.sol</code> contract.
          </li>
          <li>
            With <code className="font-mono">SMS_PROVIDER=console</code>{" "}
            (default), the SMS body is logged to stdout and the local inbox
            above. Set <code className="font-mono">SMS_PROVIDER=twilio</code>{" "}
            with valid Twilio creds to send real SMS.
          </li>
          <li>
            The refund endpoint is permissionless: anyone can trigger it after
            the 24-hour expiry. Funds can never get stuck behind the relay.
          </li>
        </ul>
      </details>
    </motion.div>
  );
};

export default SmsSection;
