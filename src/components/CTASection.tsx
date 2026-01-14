import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  return (
    <section ref={ref} className="relative py-16 overflow-hidden bg-[#020202]">
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage: `repeating-linear-gradient(-45deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)`}} />
      <div className="absolute inset-0 pointer-events-none" style={{background: `radial-gradient(ellipse 60% 40% at 50% 50%, hsl(262 83% 58% / 0.08), transparent 60%)`}} />

      <div className="container relative mx-auto px-6">
        {/* Slim Rectangle CTA Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative w-full"
        >
          {/* Card Background */}
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.5)]" />

          {/* Content Wrapper */}
          <div className="relative z-10 px-8 py-6 lg:px-12 flex flex-col lg:flex-row items-center justify-between gap-6 rounded-2xl">
            
            {/* Text Content */}
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 text-center lg:text-left">
              <motion.h3 
                className="text-2xl lg:text-3xl font-semibold tracking-tight text-white"
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Ready to Transform{" "}
                <span className="italic text-white/40 font-light">Your</span>{" "}
                <span className="text-primary">Financial Privacy?</span>
              </motion.h3>
              
              <motion.p 
                className="text-white/50 text-sm lg:text-base max-w-md hidden lg:block"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Connect your wallet and experience the future of confidential finance.
              </motion.p>
            </div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              onHoverStart={() => setIsButtonHovered(true)}
              onHoverEnd={() => setIsButtonHovered(false)}
              className="relative flex-shrink-0"
            >
              {/* Glow effect behind button */}
              <motion.div
                className="absolute inset-0 rounded-full blur-xl"
                animate={{
                  opacity: isButtonHovered ? 0.5 : 0.2,
                  scale: isButtonHovered ? 1.3 : 1,
                }}
                transition={{ duration: 0.3 }}
                style={{ background: 'hsl(262 83% 58%)' }}
              />

              <motion.button
                className="relative inline-flex items-center gap-3 bg-primary/10 text-white/60 rounded-full p-1 border border-primary/20 overflow-hidden opacity-60 cursor-not-allowed"
                disabled
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{ pointerEvents: "none" }}
                whileHover={{ scale: 1 }}
                whileTap={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <span className="inline-flex items-center gap-3 bg-primary/10 rounded-full py-3 px-8 relative">
                    <Icon icon="ph:clock" className="w-4 h-4" />
                    <span className="font-semibold text-sm whitespace-nowrap">Coming Soon</span>
                    <motion.div
                      animate={{ x: isButtonHovered ? 5 : 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                    </motion.div>
                  </span>
                </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;