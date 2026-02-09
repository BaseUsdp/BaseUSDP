import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";

const SolutionSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const solutions = [
    {
      icon: "ph:lightning-fill",
      tag: "x402 Standard",
      title: "Internet-Native Payments",
      description: "An open, neutral standard that activates HTTP 402. Any website, app, or API can request payment instantly.",
      features: ["Agent-to-agent transactions", "Micropayments (sub-cent)", "Usage-based billing", "P2P payments"],
      gradient: "from-blue-400 to-blue-600",
    },
    {
      icon: "ph:shield-check-fill",
      tag: "ZK Proof Technology",
      title: "Prove Without Revealing",
      description: "Zero-Knowledge Proofs allow verification of transactions without revealing sensitive data.",
      features: ["Confidential balances", "Private transactions", "Anonymous payments", "Fraud detection"],
      gradient: "from-violet-400 to-purple-600",
    },
    {
      icon: "ph:credit-card-fill",
      tag: "Neobank Features",
      title: "Privacy-First Banking",
      description: "Virtual cards, instant transfers, yield generation—all with privacy built-in.",
      features: ["Virtual Cards", "4-8% APY", "Real-time analytics", "Multi-factor auth"],
      gradient: "from-emerald-400 to-green-600",
    },
  ];

  // 3D Wall cards data
  const wallCards = [
    { name: "Solana", type: "Blockchain Layer", icon: "simple-icons:solana" },
    { name: "ZK Proofs", type: "Privacy Layer", icon: "ph:shield-check-fill" },
    { name: "x402", type: "Payment Standard", icon: "ph:currency-dollar-fill" },
    { name: "Rust", type: "Smart Contracts", icon: "ph:code-fill" },
    { name: "TypeScript", type: "Backend", icon: "simple-icons:typescript" },
    { name: "React + Vite", type: "Frontend", icon: "simple-icons:react" },
    { name: "SPL Tokens", type: "Token Standard", icon: "ph:lock-fill" },
    { name: "AI Agents", type: "Autonomous", icon: "ph:robot-fill" },
  ];

  return (
    <section ref={ref} id="features" className="border-b border-white/5 bg-black py-32 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-stretch">
          {/* Left Column - Solution Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="text-[10px] font-mono text-violet-500 uppercase mb-4 tracking-widest">
              The Solution
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6 leading-[1.05]">
              Privacy-First
              <span className="block text-neutral-600">Technology Stack</span>
            </h2>
            <p className="text-neutral-400 leading-relaxed mb-10">
              Three revolutionary technologies combined to create the future of confidential finance.
            </p>

            {/* Solution Cards */}
            <div className="space-y-4">
              {solutions.map((solution, i) => (
                <motion.div
                  key={solution.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="group p-5 border border-white/10 rounded-xl bg-white/[0.02] hover:border-violet-500/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${solution.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Icon icon={solution.icon} className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">{solution.title}</h4>
                        <span className="text-[10px] font-mono text-violet-400 uppercase">{solution.tag}</span>
                      </div>
                      <p className="text-sm text-neutral-500 mb-3">{solution.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {solution.features.slice(0, 2).map((feature, fi) => (
                          <span key={fi} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] text-neutral-400">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - 3D Wall - Matches left column height */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5 min-h-[500px]">
            {/* Contained wall with mask */}
            <div className="absolute inset-0">
              <div className="wall-grid h-full w-full flex gap-4 px-6 py-8">
                {/* Column 1 - Scrolling Up */}
                <div className="wall-column wall-column-up flex flex-col gap-4 w-full">
                  {[...wallCards.slice(0, 4), ...wallCards.slice(0, 4)].map((card, i) => (
                    <WallCard key={`col1-${i}`} card={card} />
                  ))}
                </div>
                
                {/* Column 2 - Scrolling Down */}
                <div className="wall-column wall-column-down flex flex-col gap-4 w-full pt-8">
                  {[...wallCards.slice(4, 8), ...wallCards.slice(4, 8)].map((card, i) => (
                    <WallCard key={`col2-${i}`} card={card} />
                  ))}
                </div>
                
                {/* Column 3 - Scrolling Up (Hidden on mobile) */}
                <div className="wall-column wall-column-up flex-col gap-4 w-full pt-16 hidden lg:flex">
                  {[...wallCards, ...wallCards].map((card, i) => (
                    <WallCard key={`col3-${i}`} card={card} />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Fade overlays - contained */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

const WallCard = ({ card }: { card: { name: string; type: string; icon: string } }) => {
  const iconColors: Record<string, string> = {
    "simple-icons:coinbase": "text-blue-400",
    "ph:shield-check-fill": "text-violet-400",
    "ph:currency-dollar-fill": "text-blue-400",
    "ph:code-fill": "text-neutral-300",
    "simple-icons:typescript": "text-blue-500",
    "simple-icons:react": "text-cyan-400",
    "ph:lock-fill": "text-emerald-400",
    "ph:robot-fill": "text-orange-400",
  };

  return (
    <div className="wall-card rounded-xl p-5 aspect-[4/3] flex flex-col justify-between bg-white/[0.03] border border-white/10 backdrop-blur-sm">
      <div className="flex justify-between items-start">
        <div className={`w-7 h-7 ${iconColors[card.icon] || 'text-white'}`}>
          <Icon icon={card.icon} className="w-full h-full" />
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_#8b5cf6]" />
      </div>
      <div>
        <div className="text-sm font-mono text-white/80">{card.name}</div>
        <div className="text-[9px] font-mono text-neutral-500">{card.type}</div>
      </div>
    </div>
  );
};

export default SolutionSection;
