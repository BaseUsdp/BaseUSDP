import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";
import AnimatedCounter from "@/components/ui/AnimatedCounter";

const ProblemSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const riskCards = [
    {
      icon: "ph:chart-line-up-fill",
      title: "Competitive Risk",
      description: "Exposing financial strategies and trading patterns to competitors",
      color: "red",
    },
    {
      icon: "ph:eye-fill",
      title: "Privacy Breach",
      description: "Client data transparency visible to competitors and public",
      color: "orange",
    },
    {
      icon: "ph:buildings-fill",
      title: "Institutional Adoption",
      description: "Blocked by transparency requirements of public blockchains",
      color: "yellow",
    },
  ];

  return (
    <section ref={ref} id="problem" className="border-b border-white/5 bg-black py-32 relative overflow-hidden">
      {/* Red Glow Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 border border-red-500/30 rounded-full bg-red-900/20">
              <Icon icon="ph:warning-fill" className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Critical Issue</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6 leading-[1.05]">
              The Blockchain
              <span className="block text-red-500">Confidentiality Crisis</span>
            </h2>
            <p className="text-neutral-400 leading-relaxed mb-8">
              Public blockchains expose everything by default. This transparency is a critical dealbreaker for institutional banking.
            </p>

            {/* Risk Cards */}
            <div className="space-y-4">
              {riskCards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className={`p-4 border rounded-xl group transition-colors ${
                    card.color === 'red' ? 'border-red-500/20 bg-red-900/10 hover:border-red-500/40' :
                    card.color === 'orange' ? 'border-orange-500/20 bg-orange-900/10 hover:border-orange-500/40' :
                    'border-yellow-500/20 bg-yellow-900/10 hover:border-yellow-500/40'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      card.color === 'red' ? 'bg-red-500/20' :
                      card.color === 'orange' ? 'bg-orange-500/20' :
                      'bg-yellow-500/20'
                    }`}>
                      <Icon icon={card.icon} className={`w-5 h-5 ${
                        card.color === 'red' ? 'text-red-400' :
                        card.color === 'orange' ? 'text-orange-400' :
                        'text-yellow-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">{card.title}</h4>
                      <p className="text-sm text-neutral-500">{card.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Risk Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="glass-card rounded-2xl p-6 border-red-500/10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm font-medium text-white">Risk Dashboard</div>
                  <div className="text-[10px] font-mono text-neutral-500">Real-time exposure analysis</div>
                </div>
                <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-[9px] font-mono text-red-400">critical</span>
              </div>

              {/* Risk Bars */}
              <div className="space-y-4 mb-6">
                {[
                  { label: "Tx Visibility", value: 100, color: "bg-red-500" },
                  { label: "Data Exposure", value: 87, color: "bg-red-500" },
                  { label: "Pattern Leakage", value: 94, color: "bg-red-500" },
                  { label: "Competitive Risk", value: 85, color: "bg-red-500" },
                  { label: "Privacy Breach", value: 92, color: "bg-red-500" },
                  { label: "Institutional Adoption", value: 78, color: "bg-red-500" },
                ].map((item, i) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-neutral-400">{item.label}</span>
                      <span className="text-xs font-mono text-red-400">{item.value}%</span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={isInView ? { width: `${item.value}%` } : {}}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Case Study Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-card rounded-2xl p-6 border-white/5 mt-4"
            >
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
                Real-World Case Study
              </div>
              <h4 className="text-white font-medium mb-3">BlackRock × JP Morgan TCN</h4>
              <p className="text-sm text-neutral-400 leading-relaxed">
                BlackRock used JP Morgan Chase's Tokenized Collateral Network (TCN) to tokenize shares in a money market fund. This transaction used a <span className="text-white underline decoration-dotted underline-offset-2">private blockchain</span>— demonstrating the critical need for confidentiality in institutional finance.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
