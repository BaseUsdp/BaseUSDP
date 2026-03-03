import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      icon: "ph:eye-fill",
      title: "Encrypted Balances",
      description: "View and manage your balances with ZK Proof encryption. Only you can see your true holdings.",
      tag: "Privacy",
      stat: "256-bit",
      statLabel: "Encryption",
    },
    {
      icon: "ph:paper-plane-tilt-fill",
      title: "Confidential Payments",
      description: "Send and receive payments with complete transaction privacy. Amounts stay hidden.",
      tag: "Payments",
      stat: "<2s",
      statLabel: "Settlement",
    },
    {
      icon: "ph:credit-card-fill",
      title: "Virtual Cards",
      description: "Generate anonymous virtual cards for online purchases with spending limits and merchant locks.",
      tag: "Cards",
      stat: "∞",
      statLabel: "Cards",
    },
    {
      icon: "ph:chart-line-up-fill",
      title: "Yield Vaults",
      description: "Earn up to 8% APY on your encrypted assets through privacy-preserving DeFi strategies.",
      tag: "Yield",
      stat: "8%",
      statLabel: "Max APY",
    },
    {
      icon: "ph:lightning-fill",
      title: "x402 Protocol",
      description: "HTTP-native payments for AI agents and APIs. Enable monetization without exposing user data.",
      tag: "Protocol",
      stat: "HTTP",
      statLabel: "Native",
    },
    {
      icon: "ph:lock-fill",
      title: "Privacy Controls",
      description: "Fine-grained privacy settings. Choose public, partial, or full encryption for each transaction.",
      tag: "Control",
      stat: "3",
      statLabel: "Modes",
    },
  ];

  return (
    <section ref={ref} className="max-w-[1400px] mx-auto px-8 py-28 border-t border-border">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <span className="tag-pill">Feature Suite</span>
      </motion.div>

      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <motion.div
          className="md:col-span-6"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h2 className="display-section font-serif text-foreground">
            Your <em className="text-muted-foreground">Privacy</em> Dashboard
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 flex items-end"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            A complete suite of privacy-first financial tools, all accessible from a single intuitive dashboard.
          </p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Active Feature Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl bg-foreground text-background p-10 md:p-12 flex flex-col justify-between min-h-[450px]"
          >
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-background/10 flex items-center justify-center">
                  <Icon icon={features[activeFeature].icon} className="w-7 h-7 text-background" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-background/40">{features[activeFeature].tag}</div>
                  <h3 className="text-2xl font-semibold text-background">{features[activeFeature].title}</h3>
                </div>
              </div>
              <p className="text-background/60 text-lg leading-relaxed max-w-md">
                {features[activeFeature].description}
              </p>
            </div>
            <div className="flex items-end justify-between mt-10">
              <div>
                <p className="display-number font-serif text-background">{features[activeFeature].stat}</p>
                <p className="text-xs uppercase tracking-widest text-background/40 mt-2">{features[activeFeature].statLabel}</p>
              </div>
              <motion.a
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground font-medium text-sm hover:bg-background/90 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Try Now
                <Icon icon="ph:arrow-right" className="h-4 w-4" />
              </motion.a>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Feature List */}
        <div className="divide-y divide-border">
          {features.map((feature, i) => (
            <motion.button
              key={feature.title}
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
              onClick={() => setActiveFeature(i)}
              className={`w-full exp-row py-6 flex items-center justify-between gap-4 text-left group transition-all duration-300 ${
                activeFeature === i ? "pl-4" : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  activeFeature === i
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  <Icon icon={feature.icon} className="w-5 h-5" />
                </div>
                <div>
                  <span className={`text-sm font-medium block ${activeFeature === i ? "text-foreground" : "text-muted-foreground"}`}>
                    {feature.title}
                  </span>
                  <span className={`text-xs ${activeFeature === i ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {feature.tag}
                  </span>
                </div>
              </div>
              <p className={`font-serif text-2xl md:text-4xl tracking-tight transition-colors duration-300 shrink-0 ${
                activeFeature === i ? "text-foreground" : "text-muted-foreground/20"
              }`} style={{ letterSpacing: "-0.03em" }}>
                {feature.stat}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="mt-16 flex items-center justify-center gap-4 px-8 py-4 rounded-full border border-border bg-background w-fit mx-auto"
      >
        <Icon icon="ph:wallet-fill" className="h-5 w-5 text-foreground" />
        <span className="text-foreground font-medium text-sm">Ready to experience privacy-first finance?</span>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors"
        >
          Open Dashboard
          <Icon icon="ph:arrow-right" className="h-4 w-4" />
        </a>
      </motion.div>
    </section>
  );
};

export default FeaturesSection;
