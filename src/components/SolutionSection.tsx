import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";

const SolutionSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const solutions = [
    {
      icon: "ph:lightning-fill",
      title: "Internet-Native Payments",
      tag: "x402 Standard",
      description: "An open, neutral standard that activates HTTP 402. Any website, app, or API can request payment instantly.",
      features: ["Agent-to-agent transactions", "Micropayments (sub-cent)", "Usage-based billing", "P2P payments"],
      featured: false,
    },
    {
      icon: "ph:shield-check-fill",
      title: "Prove Without Revealing",
      tag: "ZK Proof Technology",
      description: "Zero-Knowledge Proofs allow verification of transactions without revealing sensitive data.",
      features: ["Confidential balances", "Private transactions", "Anonymous payments", "Fraud detection"],
      featured: true,
    },
    {
      icon: "ph:credit-card-fill",
      title: "Privacy-First Banking",
      tag: "Neobank Features",
      description: "Virtual cards, instant transfers, yield generation—all with privacy built-in.",
      features: ["Virtual Cards", "4-8% APY", "Real-time analytics", "Multi-factor auth"],
      featured: false,
    },
  ];

  const techStack = [
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
    <section ref={ref} id="features" className="max-w-[1400px] mx-auto px-8 py-28 border-t border-border">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <span className="tag-pill">Our Solution</span>
      </motion.div>

      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <motion.div
          className="md:col-span-6"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h2 className="display-section font-serif text-foreground">
            What we bring{" "}
            <em className="text-muted-foreground">to the table</em>
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 flex flex-col justify-end"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            Three revolutionary technologies combined to create the future of confidential finance.
          </p>
        </motion.div>
      </div>

      {/* Service cards grid — 2x2 with one dark featured */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-3xl overflow-hidden">
        {solutions.map((solution, i) => (
          <motion.div
            key={solution.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            className={`p-10 flex flex-col justify-between min-h-[280px] group transition-all duration-300 ${
              solution.featured
                ? "bg-foreground text-background"
                : "service-card bg-background"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className={`text-xs uppercase tracking-widest mb-2 ${solution.featured ? "text-background/50" : "text-muted-foreground"}`}>
                  {solution.tag}
                </div>
                <h3 className={`text-xl font-semibold ${solution.featured ? "text-background" : "text-foreground"}`}>
                  {solution.title}
                </h3>
              </div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                solution.featured
                  ? "bg-background/10 group-hover:bg-background group-hover:text-foreground"
                  : "bg-secondary group-hover:bg-foreground group-hover:text-background"
              }`}>
                <Icon icon="ph:arrow-right" className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-sm mt-6 leading-relaxed max-w-sm ${solution.featured ? "text-background/60" : "text-muted-foreground"}`}>
              {solution.description}
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {solution.features.slice(0, 3).map((f, fi) => (
                <span
                  key={fi}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                    solution.featured
                      ? "border-background/20 text-background/60"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Tech stack card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="service-card bg-background p-10 flex flex-col justify-between min-h-[280px]"
        >
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Infrastructure</div>
            <h3 className="text-xl font-semibold text-foreground">Full Stack</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            {techStack.slice(0, 6).map((tech) => (
              <div key={tech.name} className="flex items-center gap-2 text-sm">
                <Icon icon={tech.icon} className="w-4 h-4 text-foreground" />
                <span className="text-muted-foreground">{tech.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SolutionSection;
