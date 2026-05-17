import { Icon } from "@iconify/react";
import type { VeilStatus } from "@/services/veilService";

interface Props {
  status: VeilStatus | null;
  loading: boolean;
}

const Pill = ({
  ok,
  label,
  hint,
}: {
  ok: boolean | null;
  label: string;
  hint?: string;
}) => {
  const color =
    ok === null
      ? "hsl(var(--beam-amber))"
      : ok
      ? "hsl(var(--beam-green))"
      : "#ef4444";
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-surface)",
      }}
      title={hint}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span style={{ color: "var(--dash-text)" }}>{label}</span>
    </div>
  );
};

const VeilStatusBadge = ({ status, loading }: Props) => {
  const relayOk = loading ? null : status?.relay.ok ?? false;
  const registered = loading
    ? null
    : status?.registration?.isRegistered ?? null;
  const verified = loading
    ? null
    : status?.eligibility?.isAllowed ?? null;
  const network = status?.relay.network;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        ok={relayOk}
        label={
          loading
            ? "Checking relay…"
            : relayOk
            ? `Relay online${network ? ` · ${network}` : ""}`
            : "Relay offline"
        }
        hint={status?.relay.timestamp}
      />
      {registered !== null && (
        <Pill
          ok={registered}
          label={
            registered
              ? "Wallet registered"
              : "Wallet not registered yet"
          }
          hint={
            registered
              ? "Your deposit key is recorded on-chain."
              : "First deposit will register the wallet automatically."
          }
        />
      )}
      {verified !== null && (
        <Pill
          ok={verified}
          label={
            verified
              ? "Verified · deposits unlocked"
              : "Unverified · deposits blocked"
          }
          hint={
            verified
              ? "Coinbase / Binance / Ethos attestation detected. Deposits enter the shielded set in ~8 min."
              : "Veil's entry contract only accepts deposits from pre-verified wallets. Verify once (free, ~2 min) via Coinbase Onchain Verify, Binance BABT, or Ethos Score."
          }
        />
      )}
      {status?.relay.rateLimit && (
        <div
          className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-[11px]"
          style={{
            borderColor: "var(--dash-border)",
            background: "var(--dash-surface)",
            color: "var(--dash-text-muted)",
          }}
        >
          <Icon icon="ph:gauge-bold" className="h-3.5 w-3.5" />
          <span>
            {status.relay.rateLimit.limit} req /
            {Math.round(status.relay.rateLimit.windowMs / 1000)}s
          </span>
        </div>
      )}
    </div>
  );
};

export default VeilStatusBadge;
