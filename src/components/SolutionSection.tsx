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
    },
    {
      icon: "ph:shield-check-fill",
      tag: "ZK Proof Technology",
      title: "Prove Without Revealing",
      description: "Zero-Knowledge Proofs allow verification of transactions without revealing sensitive data.",
      features: ["Confidential balances", "Private transactions", "Anonymous payments", "Fraud detection"],
    },
    {
      icon: "ph:credit-card-fill",
      tag: "Neobank Features",
      title: "Privacy-First Banking",
      description: "Virtual cards, instant transfers, yield generation—all with privacy built-in.",
      features: ["Virtual Cards", "4-8% APY", "Real-time analytics", "Multi-factor auth"],
    },
  ];

  const wallCards = [
    { name: "Base", type: "Blockchain Layer", icon: "simple-icons:ethereum" },
    { name: "ZK Proofs", type: "Privacy Layer", icon: "ph:shield-check-fill" },
    { name: "x402", type: "Payment Standard", icon: "ph:currency-dollar-fill" },
    { name: "Solidity", type: "Smart Contracts", icon: "ph:code-fill" },
    { name: "TypeScript", type: "Backend", icon: "simple-icons:typescript" },
    { name: "React + Vite", type: "Frontend", icon: "simple-icons:react" },
    { name: "ERC-20", type: "Token Standard", icon: "ph:lock-fill" },
    { name: "AI Agents", type: "Autonomous", icon: "ph:robot-fill" },
  ];

  return (
    <section ref={ref} id="features" className="border-b border-black/5 bg-white py-32 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="text-[10px] font-mono text-black/40 uppercase mb-4 tracking-widest">
              The Solution
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-black mb-6 leading-[1.05]">
              Privacy-First
              <span className="block text-black/30">Technology Stack</span>
            </h2>
            <p className="text-black/50 leading-relaxed mb-10">
              Three revolutionary technologies combined to create the future of confidential finance.
            </p>

            <div className="space-y-4">
              {solutions.map((solution, i) => (
                <motion.div
                  key={solution.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="group p-5 border border-black/10 rounded-xl bg-white hover:border-black/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                      <Icon icon={solution.icon} className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-black font-medium">{solution.title}</h4>
                        <span className="text-[10px] font-mono text-black/40 uppercase">{solution.tag}</span>
                      </div>
                      <p className="text-sm text-black/40 mb-3">{solution.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {solution.features.slice(0, 2).map((feature, fi) => (
                          <span key={fi} className="px-2 py-0.5 bg-black/[0.03] border border-black/10 rounded text-[9px] text-black/50">
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

          {/* Right Column - Wall */}
          <div className="relative overflow-hidden rounded-2xl border border-black/10 min-h-[500px]">
            <div className="absolute inset-0">
              <div className="wall-grid h-full w-full flex gap-4 px-6 py-8">
                <div className="wall-column wall-column-up flex flex-col gap-4 w-full">
                  {[...wallCards.slice(0, 4), ...wallCards.slice(0, 4)].map((card, i) => (
                    <WallCard key={`col1-${i}`} card={card} />
                  ))}
                </div>
                <div className="wall-column wall-column-down flex flex-col gap-4 w-full pt-8">
                  {[...wallCards.slice(4, 8), ...wallCards.slice(4, 8)].map((card, i) => (
                    <WallCard key={`col2-${i}`} card={card} />
                  ))}
                </div>
                <div className="wall-column wall-column-up flex-col gap-4 w-full pt-16 hidden lg:flex">
                  {[...wallCards, ...wallCards].map((card, i) => (
                    <WallCard key={`col3-${i}`} card={card} />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

const WallCard = ({ card }: { card: { name: string; type: string; icon: string } }) => {
  return (
    <div className="wall-card rounded-xl p-5 aspect-[4/3] flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="w-7 h-7 text-black">
          <Icon icon={card.icon} className="w-full h-full" />
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-black" />
      </div>
      <div>
        <div className="text-sm font-mono text-black/80">{card.name}</div>
        <div className="text-[9px] font-mono text-black/40">{card.type}</div>
      </div>
    </div>
  );
};

export default SolutionSection;
