import { motion, useInView } from "framer-motion";
import { useRef, useState, MouseEvent } from "react";
import { Icon } from "@iconify/react";

const FAQSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [mousePosition, setMousePosition] = useState({ x: -999, y: -999 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    });
  };

  const faqs = [
    {
      icon: "ph:globe-bold",
      question: "What is Web 4.0?",
      answer: "Web 4.0 represents the next evolution of the internet — an autonomous, agent-driven economy where AI agents, machines, and humans transact value seamlessly. Unlike Web3 which focused on decentralization, Web 4.0 adds intelligence and autonomy: AI agents independently negotiate, pay, and settle transactions. ORB402 provides the confidential payment infrastructure that makes this possible, ensuring privacy for both human and machine participants.",
    },
    {
      icon: "ph:shield-check-bold",
      question: "What are Zero-Knowledge Proofs (ZK Proofs)?",
      answer: "ZK Proofs are cryptographic methods that allow one party to prove to another that a statement is true without revealing any additional information. This means your transaction amounts, balances, and financial data remain private while still being verifiable on the blockchain. ORB402 uses ZK Proofs to enable truly confidential transactions.",
    },
    {
      icon: "ph:lightning-bold",
      question: "What is the x402 protocol?",
      answer: "x402 is an internet-native payment standard that implements HTTP 402 (Payment Required). It enables seamless machine-to-machine payments, micropayments, and API monetization. Any website, app, or AI agent can request and process payments instantly using this open standard.",
    },
    {
      icon: "ph:lock-bold",
      question: "How does ORB402 protect my privacy?",
      answer: "ORB402 encrypts your transaction amounts and balances using ZK Proof technology. Unlike traditional blockchains where all data is public, only you can see your true balances. Third parties, including validators and observers, cannot view your financial activity.",
    },
{
      icon: "ph:robot-bold",
      question: "Can AI agents use ORB402?",
      answer: "Yes! ORB402 is built for the agentic economy. AI agents can autonomously make and receive payments using the x402 protocol without exposing sensitive financial data. Our SDK enables developers to integrate confidential payments into any AI application.",
    },
    {
      icon: "ph:question-bold",
      question: "Which blockchains does ORB402 support?",
      answer: "ORB402 operates on Base (Ethereum L2) with ZK Proof capabilities for privacy. Transactions benefit from low fees and fast finality on Base network.",
    },
  ];

  return (
    <section ref={ref} id="faq" className="relative py-32 overflow-hidden bg-[#020202]">
      {/* Top Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage: `repeating-linear-gradient(-45deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)`}} />

      <div className="container relative mx-auto px-6" onMouseMove={handleMouseMove}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-8">
            <Icon icon="ph:sparkle-bold" className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">FAQ</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-4">
            Frequently <span className="text-primary">Asked</span>
          </h2>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white/50 mb-6">
            Questions
          </h2>
          <p className="text-white/50 text-base md:text-lg">
            Everything you need to know about ORB402 and privacy-first payments.
          </p>
        </motion.div>

        {/* FAQ Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              className="flashlight-card relative"
              style={{
                '--mouse-x': `${mousePosition.x}px`,
                '--mouse-y': `${mousePosition.y}px`,
              } as React.CSSProperties}
            >
              <motion.div
                className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
                  openIndex === index 
                    ? 'bg-white/[0.04] border-primary/30' 
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full p-6 text-left"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      openIndex === index ? 'bg-primary text-white' : 'bg-white/5 text-white/40'
                    }`}>
                      <Icon icon={faq.icon} className="w-5 h-5" />
                    </div>
                    
                    {/* Question */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold transition-colors ${
                        openIndex === index ? 'text-white' : 'text-white/80'
                      }`}>
                        {faq.question}
                      </h3>
                    </div>
                    
                    {/* Chevron */}
                    <motion.div
                      animate={{ rotate: openIndex === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex-shrink-0 ${openIndex === index ? 'text-primary' : 'text-white/30'}`}
                    >
                      <Icon icon="ph:caret-down-bold" className="w-5 h-5" />
                    </motion.div>
                  </div>
                </button>
                
                {/* Answer */}
                <motion.div
                  initial={false}
                  animate={{
                    height: openIndex === index ? "auto" : 0,
                    opacity: openIndex === index ? 1 : 0,
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 pl-20">
                    <p className="text-white/50 text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-white/40 text-sm">
            Still have questions?{" "}
            <a href="https://orb402.gitbook.io/orb402" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Read our docs
            </a>
          </p>
        </motion.div>
      </div>

      {/* Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </section>
  );
};

export default FAQSection;
