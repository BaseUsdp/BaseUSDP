import { Icon } from "@iconify/react";

const items = [
  {
    icon: "ph:identification-badge-bold",
    label: "Pre-verified wallets only · Coinbase / Binance / Ethos",
  },
  {
    icon: "ph:gift-bold",
    label: "Daily free deposits per address, then 0.3% fee",
  },
  {
    icon: "ph:clock-countdown-bold",
    label: "~8 min from deposit to shielded set",
  },
  {
    icon: "ph:shield-check-bold",
    label: "Multi-party trusted setup, no admin keys",
  },
];

const VeilEntryCard = () => {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--dash-border)",
        background:
          "linear-gradient(135deg, rgba(0,210,122,0.06), rgba(0,0,0,0))",
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon
            icon="ph:vault-bold"
            className="h-5 w-5"
            style={{ color: "hsl(var(--beam-green))" }}
          />
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "hsl(var(--beam-green))" }}
          >
            Veil Pool · Alternative private USDC
          </span>
        </div>

        <h2
          className="font-display text-2xl font-bold leading-tight sm:text-3xl"
          style={{ color: "var(--dash-text)" }}
        >
          Deposit into a larger,
          <br />
          shared anonymity set
          <span style={{ color: "hsl(var(--beam-green))" }}>.</span>
        </h2>

        <p
          className="mt-3 max-w-2xl text-sm leading-relaxed"
          style={{ color: "var(--dash-text-muted)" }}
        >
          Veil Cash is an open privacy pool on Base. Your USDC settles into
          the same anonymity set as every other Veil depositor — bigger crowd,
          better privacy. The BASEUSDP pool stays available alongside it; this
          tab is a separate route, not a replacement.
        </p>

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex items-center gap-2.5 text-xs"
              style={{ color: "var(--dash-text)" }}
            >
              <Icon
                icon={it.icon}
                className="h-4 w-4 shrink-0"
                style={{ color: "hsl(var(--beam-green))" }}
              />
              <span>{it.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <a
            href="https://dune.com/veil_cash/veil-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
            style={{ color: "var(--dash-text-muted)" }}
          >
            <Icon icon="ph:chart-line-up-bold" className="h-3.5 w-3.5" />
            Live pool stats · Dune
            <Icon icon="ph:arrow-up-right-bold" className="h-3 w-3" />
          </a>
          <a
            href="https://veil.cash"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
            style={{ color: "var(--dash-text-muted)" }}
          >
            <Icon icon="ph:globe-bold" className="h-3.5 w-3.5" />
            veil.cash
            <Icon icon="ph:arrow-up-right-bold" className="h-3 w-3" />
          </a>
          <a
            href="https://docs.veil.cash"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
            style={{ color: "var(--dash-text-muted)" }}
          >
            <Icon icon="ph:book-open-bold" className="h-3.5 w-3.5" />
            Docs
            <Icon icon="ph:arrow-up-right-bold" className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default VeilEntryCard;
