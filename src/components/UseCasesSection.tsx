import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";

const UseCasesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const useCases = [
    {
      icon: "ph:robot-fill",
      tag: "Autonomous Agents",
      title: "Agent-to-Agent Commerce",
      description: "AI agents autonomously negotiate, pay, and settle transactions with built-in privacy — no human intervention required.",
      features: ["Autonomous Payments", "Agent Identity Verification", "Private Negotiations", "Machine-Speed Settlement"],
      accentColor: "var(--beam-cyan)",
    },
    {
      icon: "ph:buildings-fill",
      tag: "Enterprise",
      title: "Machine-to-Machine Finance",
      description: "Infrastructure for autonomous systems to transact at scale — encrypted APIs, private supply chains, and confidential M2M payments.",
      features: ["Encrypted API Monetization", "Private Supply Chain Payments", "Confidential Treasury Ops", "Compliance-Ready Automation"],
      accentColor: "var(--beam-violet)",
    },
    {
      icon: "ph:user-fill",
      tag: "Human Participants",
      title: "Privacy-First for Humans",
      description: "Humans in the Web4 economy deserve the same privacy as machines. Transact, earn, and manage assets without surveillance.",
      features: ["Anonymous Payments", "Hidden Balances", "Zero Data Leaks", "Agent-Compatible Wallets"],
      accentColor: "var(--beam-green)",
    },
  ];

  return (
    <section ref={ref} id="use-cases" className="max-w-[1400px] mx-auto px-8 py-28 border-t border-border">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <span className="tag-pill">Applications</span>
      </motion.div>

      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <motion.div
          className="md:col-span-6"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h2 className="display-section font-serif text-foreground">
            Built for the{" "}
            <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Web4</em> Economy
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 flex items-end"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            From autonomous agents to human participants, confidential payments for every actor in the Web4 economy.
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {useCases.map((uc, i) => (
          <motion.div
            key={uc.title}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
            className="group rounded-3xl overflow-hidden bg-foreground text-background p-8 flex flex-col justify-between min-h-[400px] hover-lift"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `hsl(${uc.accentColor} / 0.2)` }}>
                  <Icon icon={uc.icon} className="w-6 h-6" style={{ color: `hsl(${uc.accentColor})` }} />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-background/40">{uc.tag}</span>
              </div>
              <h3 className="text-xl font-semibold text-background mb-4">{uc.title}</h3>
              <p className="text-sm text-background/50 leading-relaxed">{uc.description}</p>
            </div>

            <div className="mt-8 space-y-2">
              {uc.features.map((feature, fi) => (
                <div key={fi} className="flex items-center gap-2 text-sm text-background/60">
                  <Icon icon="ph:check-circle-fill" className="w-4 h-4 text-background/40" />
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default UseCasesSection;
