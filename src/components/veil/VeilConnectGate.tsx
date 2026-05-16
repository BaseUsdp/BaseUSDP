import { Icon } from "@iconify/react";
import { useVeil } from "@/contexts/VeilContext";

interface Props {
  title?: string;
  description?: string;
  onConnected?: () => void;
}

const VeilConnectGate = ({ title, description, onConnected }: Props) => {
  const { connect, isConnecting, error } = useVeil();

  const handleConnect = async () => {
    try {
      await connect();
      onConnected?.();
    } catch {
      /* surfaced via context error */
    }
  };

  return (
    <div className="space-y-3 py-2">
      <div
        className="flex items-start gap-3 rounded-lg border px-4 py-3 text-xs"
        style={{
          borderColor: "var(--dash-border)",
          background: "var(--dash-surface)",
          color: "var(--dash-text-muted)",
        }}
      >
        <Icon
          icon="ph:signature-bold"
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: "hsl(var(--beam-amber))" }}
        />
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            {title ?? "Sign in to Veil"}
          </p>
          <p className="mt-0.5 leading-relaxed">
            {description ??
              "We'll ask your wallet to sign a fixed message. The signature derives your Veil keypair locally — it never leaves your browser, and is not stored after you reload."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
        style={{
          background: "hsl(var(--beam-green))",
          color: "#0a0a0a",
        }}
      >
        {isConnecting ? (
          <>
            <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
            Waiting for signature…
          </>
        ) : (
          <>
            <Icon icon="ph:signature-bold" className="h-4 w-4" />
            Sign in with wallet
          </>
        )}
      </button>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.08)",
            color: "#ef4444",
          }}
        >
          <Icon icon="ph:warning-bold" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default VeilConnectGate;
