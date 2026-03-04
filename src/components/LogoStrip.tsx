import { Icon } from "@iconify/react";
import { DotPattern } from "@/components/ui/dot-pattern";

const ICONS_ROW1 = [
  { icon: "simple-icons:coinbase", name: "Base L2" },
  { icon: "ph:shield-check-fill", name: "ZK Proofs" },
  { icon: "ph:currency-dollar-fill", name: "x402 Standard" },
  { icon: "simple-icons:solidity", name: "Solidity" },
  { icon: "ph:robot-fill", name: "AI Agent Compatible" },
  { icon: "ph:lock-fill", name: "ERC-20" },
];

const ICONS_ROW2 = [
  { icon: "simple-icons:ethereum", name: "Ethereum" },
  { icon: "ph:wallet-fill", name: "Wallets" },
  { icon: "ph:code-fill", name: "Smart Contracts" },
  { icon: "simple-icons:typescript", name: "TypeScript" },
  { icon: "simple-icons:react", name: "React" },
  { icon: "ph:lightning-fill", name: "Fast Settlement" },
];

const repeated = <T,>(arr: T[], times = 4) => Array.from({ length: times }).flatMap(() => arr);

const LogoStrip = () => {
  return (
    <section className="relative w-full overflow-hidden bg-background py-20 border-y border-border">
      

      <div className="relative z-10 flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Icon icon="ph:plugs-connected-fill" className="w-3.5 h-3.5" />
            Ecosystem
          </span>
          <h2
            className="text-center font-serif text-foreground"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            The USDP Ecosystem: Engineered for <span className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Web4</span>
          </h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            USDP is built upon a foundation of elite, battle-tested protocols, creating a robust and secure environment for the Web4 agentic economy.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative w-full max-w-4xl">
          {/* Row 1 — scroll left */}
          <div className="mb-4 flex overflow-hidden">
            <div className="logo-scroll-left flex shrink-0 items-center gap-4">
              {repeated(ICONS_ROW1).map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 shadow-sm transition-colors hover:border-primary/30"
                >
                  <Icon icon={item.icon} className="h-5 w-5 text-foreground" />
                  <span className="whitespace-nowrap text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — scroll right */}
          <div className="flex overflow-hidden">
            <div className="logo-scroll-right flex shrink-0 items-center gap-4">
              {repeated(ICONS_ROW2).map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 shadow-sm transition-colors hover:border-primary/30"
                >
                  <Icon icon={item.icon} className="h-5 w-5 text-foreground" />
                  <span className="whitespace-nowrap text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>

      <style>{`
        @keyframes logo-scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes logo-scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .logo-scroll-left {
          animation: logo-scroll-left 35s linear infinite;
        }
        .logo-scroll-right {
          animation: logo-scroll-right 35s linear infinite;
        }
      `}</style>
    </section>
  );
};

export default LogoStrip;
