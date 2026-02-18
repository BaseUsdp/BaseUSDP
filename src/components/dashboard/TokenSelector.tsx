import { useState } from "react";
import { BASE_TOKENS, type TokenInfo } from "@/services/clawncherSwapService";
import { cn } from "@/lib/utils";

interface TokenSelectorProps {
  selected: TokenInfo;
  onSelect: (token: TokenInfo) => void;
  exclude?: string; // address to exclude (the other side of the pair)
}

const TokenSelector = ({ selected, onSelect, exclude }: TokenSelectorProps) => {
  const [open, setOpen] = useState(false);

  const availableTokens = BASE_TOKENS.filter(
    (t) => t.address.toLowerCase() !== exclude?.toLowerCase()
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
        style={{
          background: "var(--dash-surface)",
          border: "1px solid var(--dash-border)",
          color: "var(--dash-text)",
        }}
      >
        <img
          src={selected.logoUrl}
          alt={selected.symbol}
          className="w-5 h-5 rounded-full"
        />
        <span className="text-sm font-medium">{selected.symbol}</span>
        <svg
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden min-w-[180px]"
            style={{
              background: "var(--dash-surface)",
              border: "1px solid var(--dash-border)",
            }}
          >
            {availableTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => {
                  onSelect(token);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-sky-500/10",
                  token.address === selected.address && "bg-sky-500/20"
                )}
                style={{ color: "var(--dash-text)" }}
              >
                <img
                  src={token.logoUrl}
                  alt={token.symbol}
                  className="w-5 h-5 rounded-full"
                />
                <div className="text-left">
                  <div className="font-medium">{token.symbol}</div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    {token.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TokenSelector;
