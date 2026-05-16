import { Icon } from "@iconify/react";

const SmsDisclosure = () => {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border px-4 py-3 text-xs leading-relaxed"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-surface)",
        color: "var(--dash-text-muted)",
      }}
    >
      <Icon
        icon="ph:info-bold"
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: "hsl(var(--beam-cyan))" }}
      />
      <div>
        <span className="font-semibold" style={{ color: "var(--dash-text)" }}>
          Pay anyone with a one-time claim link.
        </span>{" "}
        Your USDC is escrowed on-chain. Anyone with the link can claim it once;
        you can refund yourself if the link goes unclaimed for 24 hours.
        Settlement runs through the BASEUSDP privacy pool, so the recipient
        address on Basescan isn't directly linked back to your deposit.
      </div>
    </div>
  );
};

export default SmsDisclosure;
