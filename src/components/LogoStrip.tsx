import { Icon } from "@iconify/react";

const ICONS_ROW1 = [
  { icon: "simple-icons:coinbase", name: "Base", color: "#0052FF" },
  { icon: "ph:shield-check-fill", name: "ZK Proofs", color: "#8B5CF6" },
  { icon: "ph:currency-dollar-fill", name: "x402", color: "#10B981" },
  { icon: "simple-icons:solidity", name: "Solidity", color: "#F97316" },
  { icon: "simple-icons:typescript", name: "TypeScript", color: "#3178C6" },
  { icon: "simple-icons:react", name: "React", color: "#61DAFB" },
  { icon: "ph:lock-fill", name: "ERC-20", color: "#EC4899" },
];

const ICONS_ROW2 = [
  { icon: "ph:robot-fill", name: "AI Agents", color: "#06B6D4" },
  { icon: "simple-icons:ethereum", name: "Ethereum", color: "#627EEA" },
  { icon: "ph:wallet-fill", name: "Wallets", color: "#F59E0B" },
  { icon: "ph:code-fill", name: "Smart Contracts", color: "#8B5CF6" },
  { icon: "ph:globe-fill", name: "Web3", color: "#3B82F6" },
  { icon: "ph:database-fill", name: "On-Chain", color: "#14B8A6" },
  { icon: "ph:lightning-fill", name: "Fast Settlement", color: "#EF4444" },
];

const repeated = <T,>(arr: T[], times = 4) => Array.from({ length: times }).flatMap(() => arr);

const LogoStrip = () => {
  return (
    <section className="relative w-full overflow-hidden py-24" style={{ background: 'hsl(0 0% 5%)' }}>
      {/* Grid bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 30%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 30%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-3 px-4">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{
              border: '1px solid hsl(0 0% 25%)',
              color: 'hsl(0 0% 55%)',
            }}
          >
            <Icon icon="ph:plugs-connected-fill" className="w-3.5 h-3.5" />
            Ecosystem
          </span>
          <h2
            className="text-center font-serif"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "hsl(0 0% 95%)",
            }}
          >
            Built on proven infrastructure
          </h2>
          <p className="max-w-md text-center text-sm" style={{ color: 'hsl(0 0% 50%)' }}>
            Powered by industry-leading protocols and tooling across the Base L2 ecosystem.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative w-full max-w-5xl">
          {/* Row 1 — scroll left */}
          <div className="mb-5 flex overflow-hidden">
            <div className="logo-scroll-left flex shrink-0 items-center gap-4">
              {repeated(ICONS_ROW1).map((item, i) => (
                <div
                  key={i}
                  className="group flex shrink-0 items-center gap-3 rounded-xl px-5 py-3.5 transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'hsl(0 0% 10%)',
                    border: '1px solid hsl(0 0% 18%)',
                    boxShadow: `0 0 0 0 ${item.color}00`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${item.color}60`;
                    e.currentTarget.style.boxShadow = `0 0 20px -4px ${item.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'hsl(0 0% 18%)';
                    e.currentTarget.style.boxShadow = `0 0 0 0 ${item.color}00`;
                  }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${item.color}20` }}
                  >
                    <Icon icon={item.icon} className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium" style={{ color: 'hsl(0 0% 80%)' }}>
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
                  className="group flex shrink-0 items-center gap-3 rounded-xl px-5 py-3.5 transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'hsl(0 0% 10%)',
                    border: '1px solid hsl(0 0% 18%)',
                    boxShadow: `0 0 0 0 ${item.color}00`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${item.color}60`;
                    e.currentTarget.style.boxShadow = `0 0 20px -4px ${item.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'hsl(0 0% 18%)';
                    e.currentTarget.style.boxShadow = `0 0 0 0 ${item.color}00`;
                  }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${item.color}20` }}
                  >
                    <Icon icon={item.icon} className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium" style={{ color: 'hsl(0 0% 80%)' }}>
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fade edges — dark */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-28" style={{ background: 'linear-gradient(to right, hsl(0 0% 5%), transparent)' }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-28" style={{ background: 'linear-gradient(to left, hsl(0 0% 5%), transparent)' }} />
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
