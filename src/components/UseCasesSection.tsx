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
      color: "violet",
      gradient: "from-violet-600 to-purple-600",
    },
    {
      icon: "ph:buildings-fill",
      tag: "Enterprise",
      title: "Machine-to-Machine Finance",
      description: "Infrastructure for autonomous systems to transact at scale — encrypted APIs, private supply chains, and confidential M2M payments.",
      features: ["Encrypted API Monetization", "Private Supply Chain Payments", "Confidential Treasury Ops", "Compliance-Ready Automation"],
      color: "emerald",
      gradient: "from-emerald-600 to-teal-600",
    },
    {
      icon: "ph:user-fill",
      tag: "Human Participants",
      title: "Privacy-First for Humans",
      description: "Humans in the Web 4.0 economy deserve the same privacy as machines. Transact, earn, and manage assets without surveillance.",
      features: ["Anonymous Payments", "Hidden Balances", "Zero Data Leaks", "Agent-Compatible Wallets"],
      color: "pink",
      gradient: "from-pink-600 to-rose-600",
    },
  ];

  return (
    <section ref={ref} id="use-cases" className="border-b border-white/5 bg-black py-32 relative overflow-hidden">
      {/* Faded Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        {/* Fade overlays */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-40 bg-gradient-to-r from-black to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-40 bg-gradient-to-l from-black to-transparent" />
      </div>
      
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-mono text-violet-500 uppercase mb-4 tracking-widest">
            Use Cases
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6 leading-[1.05]">
            Built for the <span className="gradient-text-violet">Web 4.0</span> Economy
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            From autonomous agents to human participants, confidential payments for every actor in the Web 4.0 economy.
          </p>
        </motion.div>

        {/* Use Case Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className={`group relative border border-white/10 rounded-2xl overflow-hidden bg-gradient-to-b transition-all hover:border-opacity-30 ${
                useCase.color === 'violet' ? 'from-violet-900/10 hover:border-violet-500' :
                useCase.color === 'emerald' ? 'from-emerald-900/10 hover:border-emerald-500' :
                'from-pink-900/10 hover:border-pink-500'
              } to-transparent`}
            >
              {/* Top Gradient Bar */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${useCase.gradient}`} />
              
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    useCase.color === 'violet' ? 'bg-violet-500/20' :
                    useCase.color === 'emerald' ? 'bg-emerald-500/20' :
                    'bg-pink-500/20'
                  }`}>
                    <Icon icon={useCase.icon} className={`w-6 h-6 ${
                      useCase.color === 'violet' ? 'text-violet-400' :
                      useCase.color === 'emerald' ? 'text-emerald-400' :
                      'text-pink-400'
                    }`} />
                  </div>
                  <div>
                    <div className={`text-[10px] font-mono uppercase ${
                      useCase.color === 'violet' ? 'text-violet-400' :
                      useCase.color === 'emerald' ? 'text-emerald-400' :
                      'text-pink-400'
                    }`}>{useCase.tag}</div>
                    <h3 className="text-white font-medium">{useCase.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-neutral-400 mb-6">{useCase.description}</p>
                <div className="space-y-3">
                  {useCase.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                      <Icon icon="ph:check-circle-fill" className={`w-4 h-4 ${
                        useCase.color === 'violet' ? 'text-violet-500' :
                        useCase.color === 'emerald' ? 'text-emerald-500' :
                        'text-pink-500'
                      }`} />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
