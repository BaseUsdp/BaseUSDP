import { Icon } from "@iconify/react";

const VeilDisclosure = () => {
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
          Veil Pool is a third-party privacy pool.
        </span>{" "}
        Operated by{" "}
        <a
          href="https://veil.cash"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          veil.cash
        </a>
        . BASEUSDP is not the custodian of these funds. Withdrawals are
        governed by veil.cash's contracts and relay. Once funds are deposited,
        Veil's team has no admin control over them.
      </div>
    </div>
  );
};

export default VeilDisclosure;
