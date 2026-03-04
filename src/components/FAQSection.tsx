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
      question: "The Web4 Revolution: Autonomous. Agentic. Invisible.",
      answer: "Web4 is not just an upgrade; it's a paradigm shift. It's the era of the autonomous internet, where AI agents, not just humans, are primary economic actors. This new digital frontier demands a new standard of privacy and security. USDP is built for this future, enabling confidential commerce where AI agents transact with strategic discretion.",
    },
    {
      icon: "ph:shield-check-bold",
      question: "Zero-Knowledge: The Engine of Confidentiality",
      answer: "At the core of USDP's privacy infrastructure lies Zero-Knowledge Proofs (ZKPs). This advanced cryptographic technology allows us to verify transactions and identities without revealing any underlying data. For the Web4 agentic economy, ZKPs are not just about privacy; they're about enabling trustless, verifiable, and completely confidential interactions between autonomous entities.",
    },
    {
      icon: "ph:lightning-bold",
      question: "x402 Protocol: The Native Standard for Autonomous Commerce",
      answer: "The x402 protocol is more than just a payment standard; it's the internet-native language for the Web4 economy. By implementing HTTP 402 ('Payment Required'), x402 enables seamless, machine-to-machine value exchange. USDP integrates x402 to ensure that your AI agents can autonomously and confidentially interact with services and other agents, making payments a frictionless part of the autonomous web.",
    },
    {
      icon: "ph:lock-bold",
      question: "Your Privacy, Our Protocol: How USDP Secures Your Data",
      answer: "USDP is engineered from the ground up to be the most secure and private agentic wallet on Base. We leverage advanced Zero-Knowledge Proofs (ZKPs) and Fully Homomorphic Encryption (FHE) to encrypt your transaction amounts, balances, and even the links to your main wallet. This means your financial activity remains completely confidential, even from us. Your data, your control, always invisible.",
    },
    {
      icon: "ph:robot-bold",
      question: "AI Agents: Autonomy Meets Confidentiality",
      answer: "Absolutely. USDP is purpose-built for the burgeoning agentic economy. Our platform empowers AI agents to operate with full autonomy, making and receiving payments, interacting with protocols, and executing complex strategies — all while maintaining complete financial confidentiality. With USDP, your AI agents gain the strategic advantage of privacy, ensuring their operations remain secure and untraceable on Base.",
    },
    {
      icon: "ph:question-bold",
      question: "Built on Base: The Secure Foundation for Web4 Finance",
      answer: "USDP proudly operates on Base, Ethereum's leading Layer 2. This strategic choice provides our users and AI agents with unparalleled transaction speed, minimal fees, and the robust security of the Ethereum network. By leveraging Base, USDP ensures that confidential payments for the Web4 economy are not only private but also efficient, scalable, and future-proof.",
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
              Deep Dive into{" "}
              <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>USDP</em>
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
             Still have questions? Reach out to us on{" "}
             <a href="https://x.com/BaseUSDP" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
               Twitter
             </a>
           </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
