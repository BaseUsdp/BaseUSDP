import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const FAQSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      icon: "ph:globe-bold",
      question: "What is Web 4.0?",
      answer: "Web 4.0 represents the next evolution of the internet — an autonomous, agent-driven economy where AI agents, machines, and humans transact value seamlessly. Unlike Web3 which focused on decentralization, Web 4.0 adds intelligence and autonomy: AI agents independently negotiate, pay, and settle transactions. ALTIS Finance provides the confidential payment infrastructure that makes this possible, ensuring privacy for both human and machine participants.",
    },
    {
      icon: "ph:shield-check-bold",
      question: "What are Zero-Knowledge Proofs (ZK Proofs)?",
      answer: "ZK Proofs are cryptographic methods that allow one party to prove to another that a statement is true without revealing any additional information. This means your transaction amounts, balances, and financial data remain private while still being verifiable on the blockchain. ALTIS Finance uses ZK Proofs to enable truly confidential transactions.",
    },
    {
      icon: "ph:lightning-bold",
      question: "What is the x402 protocol?",
      answer: "x402 is an internet-native payment standard that implements HTTP 402 (Payment Required). It enables seamless machine-to-machine payments, micropayments, and API monetization. Any website, app, or AI agent can request and process payments instantly using this open standard.",
    },
    {
      icon: "ph:lock-bold",
      question: "How does ALTIS Finance protect my privacy?",
      answer: "ALTIS Finance encrypts your transaction amounts and balances using ZK Proof technology. Unlike traditional blockchains where all data is public, only you can see your true balances. Third parties, including validators and observers, cannot view your financial activity.",
    },
    {
      icon: "ph:robot-bold",
      question: "Can AI agents use ALTIS Finance?",
      answer: "Yes! ALTIS Finance is built for the agentic economy. AI agents can autonomously make and receive payments using the x402 protocol without exposing sensitive financial data. Our SDK enables developers to integrate confidential payments into any AI application.",
    },
    {
      icon: "ph:question-bold",
      question: "Which blockchains does ALTIS Finance support?",
      answer: "ALTIS Finance operates on Base (Ethereum L2) with ZK Proof capabilities for privacy. Transactions benefit from low fees and fast finality on Base network.",
    },
  ];

  return (
    <section ref={ref} id="faq" className="bg-secondary/30 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-8 py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="tag-pill">FAQ</span>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h2 className="display-section font-serif text-foreground">
              Everything you need{" "}
              <em className="text-muted-foreground">to know</em>
            </h2>
          </motion.div>
        </div>

        <div className="divide-y divide-border">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full py-8 flex items-start gap-6 text-left group exp-row"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                  openIndex === index ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                }`}>
                  <Icon icon={faq.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold transition-colors ${
                    openIndex === index ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {faq.question}
                  </h3>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openIndex === index ? "auto" : 0,
                      opacity: openIndex === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="text-muted-foreground text-sm leading-relaxed mt-4 max-w-2xl">
                      {faq.answer}
                    </p>
                  </motion.div>
                </div>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0 mt-1"
                >
                  <Icon icon="ph:caret-down-bold" className={`w-5 h-5 transition-colors ${openIndex === index ? "text-foreground" : "text-muted-foreground/30"}`} />
                </motion.div>
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12"
        >
          <p className="text-muted-foreground/60 text-sm">
            Still have questions?{" "}
            <a href="https://orb402.gitbook.io/orb402" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
              Read our docs
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
