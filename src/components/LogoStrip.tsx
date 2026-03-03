import { Icon } from "@iconify/react";

const LogoStrip = () => {
  const logos = [
    { icon: "simple-icons:coinbase", name: "Base" },
    { icon: "ph:shield-check-fill", name: "ZK Proofs" },
    { icon: "ph:currency-dollar-fill", name: "x402" },
    { icon: "simple-icons:solidity", name: "Solidity" },
    { icon: "simple-icons:typescript", name: "TypeScript" },
    { icon: "simple-icons:react", name: "React" },
    { icon: "ph:lock-fill", name: "ERC-20" },
    { icon: "ph:robot-fill", name: "AI Agents" },
  ];

  return (
    <div className="border-y border-border py-12 overflow-hidden bg-background">
      <div className="marquee-track marquee-anim">
        {[0, 1].map((set) => (
          <div key={set} className="flex items-center gap-24 px-12 opacity-40 hover:opacity-70 transition-opacity duration-500">
            {logos.map((logo, i) => (
              <div key={`${set}-${i}`} className="flex items-center gap-3 flex-shrink-0">
                <Icon icon={logo.icon} className="w-8 h-8 text-foreground" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{logo.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogoStrip;
