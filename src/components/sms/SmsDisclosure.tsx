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
          Phone numbers are hashed in your browser before they leave.
        </span>{" "}
        BASEUSDP only stores keccak256 hashes — never raw numbers, names, or
        message history. Unclaimed escrows auto-refund to the sender after 24
        hours, and the refund endpoint is permissionless, so funds can never
        get stuck behind the relay.
      </div>
    </div>
  );
};

export default SmsDisclosure;
