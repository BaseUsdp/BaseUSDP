import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";
import PaymentFlowSVG from "@/components/svg-animations/PaymentFlowSVG";
import ZKShieldSVG from "@/components/svg-animations/ZKShieldSVG";
import PrivateWalletSVG from "@/components/svg-animations/PrivateWalletSVG";
import TechStackSVG from "@/components/svg-animations/TechStackSVG";

const solutions = [
  {
    icon: "ph:lightning-fill",
    title: "Internet-Native Payments",
    tag: "x402 Standard",
    description: "An open, neutral standard that activates HTTP 402. Any website, app, or API can request payment instantly.",
    features: ["Agent-to-agent transactions", "Micropayments (sub-cent)", "Usage-based billing"],
    featured: false,
    illustration: "payment",
  },
  {
    icon: "ph:shield-check-fill",
    title: "Prove Without Revealing",
    tag: "ZK Proof Technology",
    description: "Zero-Knowledge Proofs allow verification of transactions without revealing sensitive data.",
    features: ["Confidential balances", "Private transactions", "Anonymous payments"],
    featured: true,
    illustration: "zk",
  },
  {
    icon: "ph:credit-card-fill",
    title: "Privacy-First Banking",
    tag: "Neobank Features",
    description: "Instant transfers, yield generation—all with privacy built-in.",
    features: ["Private Transfers", "4-8% APY", "Real-time analytics"],
    featured: false,
    illustration: "wallet",
  },
];

const SolutionSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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
            How USDP delivers{" "}
            <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>unparalleled confidentiality</em>
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 flex flex-col justify-end"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            Three revolutionary technologies combined to power the Web4 agentic economy with unparalleled privacy.
          </p>
        </motion.div>
      </div>

      {/* Bento grid — 3 cards top, 1 wide bottom */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {solutions.map((solution, i) => (
          <motion.div
            key={solution.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            className={`rounded-3xl overflow-hidden group transition-all duration-300 ${
              solution.featured
                ? "bg-foreground text-background"
                : "bg-secondary/40 border border-border"
            }`}
          >
            {/* SVG Illustration area */}
            <div className={`px-4 pt-6 ${solution.featured ? "opacity-90" : ""}`}>
              {solution.illustration === "payment" && <PaymentFlowSVG />}
              {solution.illustration === "zk" && <ZKShieldSVG inverted={solution.featured} />}
              {solution.illustration === "wallet" && <PrivateWalletSVG />}
            </div>

            {/* Text content */}
            <div className="p-8 pt-4">
              <div className={`text-xs uppercase tracking-widest mb-2 ${solution.featured ? "text-background/50" : "text-muted-foreground"}`}>
                {solution.tag}
              </div>
              <h3 className={`text-xl font-semibold mb-3 ${solution.featured ? "text-background" : "text-foreground"}`}>
                {solution.title}
              </h3>
              <p className={`text-sm leading-relaxed mb-6 ${solution.featured ? "text-background/60" : "text-muted-foreground"}`}>
                {solution.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {solution.features.map((f, fi) => (
                  <span
                    key={fi}
                    className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      solution.featured
                        ? "border-background/20 text-background/60"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Wide tech stack card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-4 rounded-3xl bg-secondary/40 border border-border overflow-hidden grid md:grid-cols-2 gap-0"
      >
        <div className="p-8 flex flex-col justify-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Infrastructure</div>
          <h3 className="text-xl font-semibold text-foreground mb-3">Full Stack Architecture</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Five architectural layers working in concert to deliver end-to-end encrypted transactions at scale.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "simple-icons:coinbase", name: "Base L2" },
              { icon: "ph:shield-check-fill", name: "ZK Proofs" },
              { icon: "ph:currency-dollar-fill", name: "x402" },
              { icon: "simple-icons:solidity", name: "Solidity" },
              { icon: "ph:robot-fill", name: "AI Agents" },
              { icon: "ph:lock-fill", name: "ERC-20" },
            ].map((tech) => (
              <div key={tech.name} className="flex items-center gap-2 text-sm">
                <Icon icon={tech.icon} className="w-4 h-4 text-foreground" />
                <span className="text-muted-foreground">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center p-4">
          <TechStackSVG />
        </div>
      </motion.div>
    </section>
  );
};

export default SolutionSection;
