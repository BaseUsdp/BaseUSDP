import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();

  return (
    <section ref={ref} className="relative py-16 overflow-hidden bg-white">
      <div className="absolute top-0 left-0 right-0 h-px bg-black/5" />

      <div className="container relative mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative w-full"
        >
          <div className="absolute inset-0 bg-black/[0.02] rounded-2xl border border-black/10" />

          <div className="relative z-10 px-8 py-6 lg:px-12 flex flex-col lg:flex-row items-center justify-between gap-6 rounded-2xl">
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 text-center lg:text-left">
              <motion.h3 
                className="text-2xl lg:text-3xl font-semibold tracking-tight text-black"
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Ready to Transform{" "}
                <span className="italic text-black/30 font-light">Your</span>{" "}
                <span className="font-bold">Financial Privacy?</span>
              </motion.h3>
              
              <motion.p 
                className="text-black/40 text-sm lg:text-base max-w-md hidden lg:block"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Connect your wallet and experience the future of confidential finance.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative flex-shrink-0"
            >
              <motion.button
                className="relative inline-flex items-center gap-3 bg-black text-white rounded-full py-3 px-8 font-semibold text-sm cursor-pointer"
                onClick={() => navigate("/dashboard")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                Dashboard
                <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
