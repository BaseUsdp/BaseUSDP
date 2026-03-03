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
    },
    {
      icon: "ph:buildings-fill",
      tag: "Enterprise",
      title: "Machine-to-Machine Finance",
      description: "Infrastructure for autonomous systems to transact at scale — encrypted APIs, private supply chains, and confidential M2M payments.",
      features: ["Encrypted API Monetization", "Private Supply Chain Payments", "Confidential Treasury Ops", "Compliance-Ready Automation"],
    },
    {
      icon: "ph:user-fill",
      tag: "Human Participants",
      title: "Privacy-First for Humans",
      description: "Humans in the Web 4.0 economy deserve the same privacy as machines. Transact, earn, and manage assets without surveillance.",
      features: ["Anonymous Payments", "Hidden Balances", "Zero Data Leaks", "Agent-Compatible Wallets"],
    },
  ];

  return (
    <section ref={ref} id="use-cases" className="border-b border-black/5 bg-white py-32 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-[10px] font-mono text-black/40 uppercase mb-4 tracking-widest">
            Use Cases
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-black mb-6 leading-[1.05]">
            Built for the <span className="font-bold">Web 4.0</span> Economy
          </h2>
          <p className="text-black/40 text-lg max-w-2xl mx-auto">
            From autonomous agents to human participants, confidential payments for every actor in the Web 4.0 economy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="group relative border border-black/10 rounded-2xl overflow-hidden bg-white transition-all hover:border-black/30 hover:shadow-md"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-black" />
              
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-black">
                    <Icon icon={useCase.icon} className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-black/40">{useCase.tag}</div>
                    <h3 className="text-black font-medium">{useCase.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-black/40 mb-6">{useCase.description}</p>
                <div className="space-y-3">
                  {useCase.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-black/60">
                      <Icon icon="ph:check-circle-fill" className="w-4 h-4 text-black" />
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
