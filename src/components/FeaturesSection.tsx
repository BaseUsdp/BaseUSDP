import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeFeature, setActiveFeature] = useState(0);

  const dashboardFeatures = [
    {
      icon: "ph:eye-fill",
      title: "Encrypted Balances",
      description: "View and manage your balances with ZK Proof encryption. Only you can see your true holdings.",
      tag: "Privacy",
      stats: { metric: "256-bit", label: "Encryption" },
    },
    {
      icon: "ph:paper-plane-tilt-fill",
      title: "Confidential Payments",
      description: "Send and receive payments with complete transaction privacy. Amounts stay hidden.",
      tag: "Payments",
      stats: { metric: "<2s", label: "Settlement" },
    },
    {
      icon: "ph:credit-card-fill",
      title: "Virtual Cards",
      description: "Generate anonymous virtual cards for online purchases with spending limits and merchant locks.",
      tag: "Cards",
      stats: { metric: "∞", label: "Cards" },
    },
    {
      icon: "ph:chart-line-up-fill",
      title: "Yield Vaults",
      description: "Earn up to 8% APY on your encrypted assets through privacy-preserving DeFi strategies.",
      tag: "Yield",
      stats: { metric: "8%", label: "Max APY" },
    },
    {
      icon: "ph:lightning-fill",
      title: "x402 Protocol",
      description: "HTTP-native payments for AI agents and APIs. Enable monetization without exposing user data.",
      tag: "Protocol",
      stats: { metric: "HTTP", label: "Native" },
    },
    {
      icon: "ph:lock-fill",
      title: "Privacy Controls",
      description: "Fine-grained privacy settings. Choose public, partial, or full encryption for each transaction.",
      tag: "Control",
      stats: { metric: "3", label: "Modes" },
    },
  ];

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-white">
      <div className="absolute top-0 left-0 right-0 h-px bg-black/5" />

      <div className="container relative mx-auto px-6">
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={isInView ? { opacity: 1, y: 0 } : {}} 
          transition={{ duration: 0.6 }} 
          className="mb-16 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.02] mb-8">
            <Icon icon="ph:sparkle-fill" className="h-3 w-3 text-black" />
            <span className="text-xs font-medium text-black tracking-wide">Feature Suite</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-black mb-4">
            Your <span className="font-bold">Privacy Dashboard</span>
          </h2>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-black/30 mb-6">
            Everything You Need
          </h2>
          <p className="text-black/40 text-base md:text-lg">
            A complete suite of privacy-first financial tools, all accessible from a single intuitive dashboard.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="relative"
        >
          <div className="grid lg:grid-cols-[1fr_400px] gap-6 mb-6">
            {/* Active Feature Display */}
            <motion.div 
              className="relative bg-white rounded-3xl border border-black/10 overflow-hidden min-h-[400px]"
              layout
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-black/10" />
                    <div className="w-3 h-3 rounded-full bg-black/10" />
                    <div className="w-3 h-3 rounded-full bg-black/10" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/[0.03] border border-black/10">
                    <Icon icon="ph:stack-fill" className="w-3 h-3 text-black/30" />
                    <span className="text-xs text-black/30 font-mono">ALTIS://features/{dashboardFeatures[activeFeature].tag.toLowerCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-black" />
                  <span className="text-xs text-black font-medium">ACTIVE</span>
                </div>
              </div>

              <div className="p-8 lg:p-10 flex flex-col justify-center h-[calc(100%-60px)]">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-start gap-5 mb-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black text-white shadow-lg">
                      <Icon icon={dashboardFeatures[activeFeature].icon} className="h-10 w-10" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-2 block">
                        {dashboardFeatures[activeFeature].tag}
                      </span>
                      <h3 className="text-3xl font-bold text-black mb-2">
                        {dashboardFeatures[activeFeature].title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-black/50 text-lg leading-relaxed mb-8 max-w-lg">
                    {dashboardFeatures[activeFeature].description}
                  </p>

                  <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-black">
                        {dashboardFeatures[activeFeature].stats.metric}
                      </span>
                      <span className="text-black/30 text-sm uppercase tracking-wider">
                        {dashboardFeatures[activeFeature].stats.label}
                      </span>
                    </div>
                    <motion.a
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-black/90 transition-colors ml-auto"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Try Now
                      <Icon icon="ph:arrow-right" className="h-4 w-4" />
                    </motion.a>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Feature Selector */}
            <div className="space-y-3">
              {dashboardFeatures.map((feature, index) => (
                <motion.button
                  key={feature.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
                  onClick={() => setActiveFeature(index)}
                  className={`w-full group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left ${
                    activeFeature === index 
                      ? 'bg-black/[0.03] border-black/20' 
                      : 'bg-white border-black/5 hover:bg-black/[0.02] hover:border-black/15'
                  }`}
                >
                  {activeFeature === index && (
                    <motion.div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-black rounded-full"
                      layoutId="activeIndicator"
                    />
                  )}

                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                    activeFeature === index 
                      ? 'bg-black text-white' 
                      : 'bg-black/5 text-black/40 group-hover:text-black/60 border border-black/10'
                  }`}>
                    <Icon icon={feature.icon} className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium block truncate ${activeFeature === index ? 'text-black' : 'text-black/60'}`}>
                      {feature.title}
                    </span>
                    <span className={`text-xs truncate block ${activeFeature === index ? 'text-black/50' : 'text-black/30'}`}>
                      {feature.tag}
                    </span>
                  </div>

                  <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    activeFeature === index ? 'bg-black/10 text-black' : 'bg-black/[0.03] text-black/20'
                  }`}>
                    <Icon icon="ph:arrow-right" className="w-4 h-4" />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Bottom Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "100%", label: "Privacy Guarantee" },
              { value: "24/7", label: "Always Available" },
              { value: "0", label: "Data Leaks" },
              { value: "∞", label: "Scalability" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="group relative bg-white rounded-2xl p-6 border border-black/5 hover:border-black/20 transition-colors overflow-hidden"
              >
                <span className="block text-3xl font-bold text-black mb-1 relative z-10">
                  {stat.value}
                </span>
                <span className="text-xs text-black/30 uppercase tracking-wider relative z-10">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 px-8 py-4 rounded-2xl border border-black/10 bg-white">
            <div className="flex items-center gap-2">
              <Icon icon="ph:wallet-fill" className="h-5 w-5 text-black" />
              <span className="text-black font-medium">Ready to experience privacy-first finance?</span>
            </div>
            <a 
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-black/90 transition-colors"
            >
              Open Dashboard
              <Icon icon="ph:arrow-right" className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/5" />
    </section>
  );
};

export default FeaturesSection;
