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
      gradient: "from-violet-500 to-purple-600",
      stats: { metric: "256-bit", label: "Encryption" },
    },
    {
      icon: "ph:paper-plane-tilt-fill",
      title: "Confidential Payments",
      description: "Send and receive payments with complete transaction privacy. Amounts stay hidden.",
      tag: "Payments",
      gradient: "from-blue-500 to-cyan-600",
      stats: { metric: "<2s", label: "Settlement" },
    },
    {
      icon: "ph:credit-card-fill",
      title: "Virtual Cards",
      description: "Generate anonymous virtual cards for online purchases with spending limits and merchant locks.",
      tag: "Cards",
      gradient: "from-emerald-500 to-green-600",
      stats: { metric: "∞", label: "Cards" },
    },
    {
      icon: "ph:chart-line-up-fill",
      title: "Yield Vaults",
      description: "Earn up to 8% APY on your encrypted assets through privacy-preserving DeFi strategies.",
      tag: "Yield",
      gradient: "from-orange-500 to-amber-600",
      stats: { metric: "8%", label: "Max APY" },
    },
    {
      icon: "ph:lightning-fill",
      title: "x402 Protocol",
      description: "HTTP-native payments for AI agents and APIs. Enable monetization without exposing user data.",
      tag: "Protocol",
      gradient: "from-pink-500 to-rose-600",
      stats: { metric: "HTTP", label: "Native" },
    },
    {
      icon: "ph:lock-fill",
      title: "Privacy Controls",
      description: "Fine-grained privacy settings. Choose public, partial, or full encryption for each transaction.",
      tag: "Control",
      gradient: "from-indigo-500 to-blue-600",
      stats: { metric: "3", label: "Modes" },
    },
  ];

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-[#020202]">
      {/* Background */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)`,
        }}
      />

      <div className="container relative mx-auto px-6">
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={isInView ? { opacity: 1, y: 0 } : {}} 
          transition={{ duration: 0.6 }} 
          className="mb-16 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-8">
            <Icon icon="ph:sparkle-fill" className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">Feature Suite</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-4">
            Your <span className="text-primary">Privacy Dashboard</span>
          </h2>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white/50 mb-6">
            Everything You Need
          </h2>
          <p className="text-white/50 text-base md:text-lg">
            A complete suite of privacy-first financial tools, all accessible from a single intuitive dashboard.
          </p>
        </motion.div>

        {/* Ultra Premium Bento Grid Layout */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="relative"
        >
          {/* Main Feature Card - Large */}
          <div className="grid lg:grid-cols-[1fr_400px] gap-6 mb-6">
            {/* Active Feature Display */}
            <motion.div 
              className="relative bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden min-h-[400px]"
              layout
            >
              {/* Header bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                    <Icon icon="ph:stack-fill" className="w-3 h-3 text-white/40" />
                    <span className="text-xs text-white/40 font-mono">ORB402://features/{dashboardFeatures[activeFeature].tag.toLowerCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs text-primary font-medium">ACTIVE</span>
                </div>
              </div>

              {/* Feature Content */}
              <div className="p-8 lg:p-10 flex flex-col justify-center h-[calc(100%-60px)]">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-start gap-5 mb-6">
                    <motion.div 
                      className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${dashboardFeatures[activeFeature].gradient} text-white shadow-2xl`}
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      <Icon icon={dashboardFeatures[activeFeature].icon} className="h-10 w-10" />
                    </motion.div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 block">
                        {dashboardFeatures[activeFeature].tag}
                      </span>
                      <h3 className="text-3xl font-bold text-white mb-2">
                        {dashboardFeatures[activeFeature].title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-lg">
                    {dashboardFeatures[activeFeature].description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-2">
                      <motion.span 
                        className="text-5xl font-bold text-white"
                        animate={{ opacity: [1, 0.7, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {dashboardFeatures[activeFeature].stats.metric}
                      </motion.span>
                      <span className="text-white/40 text-sm uppercase tracking-wider">
                        {dashboardFeatures[activeFeature].stats.label}
                      </span>
                    </div>
                    <motion.a
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors ml-auto"
                      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0, 1, 255, 0.4)" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Try Now
                      <Icon icon="ph:arrow-right" className="h-4 w-4" />
                    </motion.a>
                  </div>
                </motion.div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-accent/10 blur-[80px] pointer-events-none" />
            </motion.div>

            {/* Feature Selector - Vertical Stack */}
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
                      ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-primary/40' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                  }`}
                >
                  {/* Active indicator */}
                  {activeFeature === index && (
                    <motion.div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full"
                      layoutId="activeIndicator"
                    />
                  )}

                  <motion.div 
                    className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                      activeFeature === index 
                        ? `bg-gradient-to-br ${feature.gradient} text-white shadow-lg` 
                        : 'bg-white/5 text-white/40 group-hover:text-white/60 border border-white/10'
                    }`}
                    whileHover={{ scale: 1.05 }}
                  >
                    <Icon icon={feature.icon} className="w-5 h-5" />
                  </motion.div>
                  
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium block truncate ${activeFeature === index ? 'text-white' : 'text-white/70'}`}>
                      {feature.title}
                    </span>
                    <span className={`text-xs truncate block ${activeFeature === index ? 'text-white/60' : 'text-white/40'}`}>
                      {feature.tag}
                    </span>
                  </div>

                  <motion.div
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                      activeFeature === index ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'
                    }`}
                    animate={activeFeature === index ? { x: [0, 4, 0] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Icon icon="ph:arrow-right" className="w-4 h-4" />
                  </motion.div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Bottom Stats Row */}
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
                className="group relative bg-white/[0.02] rounded-2xl p-6 border border-white/5 hover:border-primary/30 transition-colors overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                />
                <motion.span 
                  className="block text-3xl font-bold text-white mb-1 relative z-10"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                >
                  {stat.value}
                </motion.span>
                <span className="text-xs text-white/40 uppercase tracking-wider relative z-10">{stat.label}</span>
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
          <div className="inline-flex items-center gap-4 px-8 py-4 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Icon icon="ph:wallet-fill" className="h-5 w-5 text-primary" />
              <span className="text-white font-medium">Ready to experience privacy-first finance?</span>
            </div>
            <a 
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
            >
              Open Dashboard
              <Icon icon="ph:arrow-right" className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </section>
  );
};

export default FeaturesSection;
