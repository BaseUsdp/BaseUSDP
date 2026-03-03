import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import WalletConnectOverlay from "./WalletConnectOverlay";

const CONTRACT_ADDRESS = "0xb05460ae4555ed1797292138a27221eda7727b07";

declare global {
  interface Window {
    __unicornScene?: any;
  }
}

const HeroSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);
  const { isConnected } = useWallet();
  const navigate = useNavigate();

  const handleLaunchApp = () => {
    navigate("/dashboard");
  };

  return (
    <>
      <section 
        ref={ref}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-32"
      >
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none z-[1] technical-grid opacity-40" />

        <div className="max-w-[1400px] relative mx-auto px-6 py-16 z-[2]">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left Column */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
            >
              {/* Contract Address Badge */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                onClick={() => {
                  navigator.clipboard.writeText(CONTRACT_ADDRESS);
                  toast.success("Contract address copied to clipboard");
                }}
                className="flex items-center gap-2 px-4 py-2 mb-3 border border-black/20 rounded-full bg-white cursor-pointer hover:bg-black/5 transition-all group"
              >
                <Icon icon="ph:copy-simple" className="w-3.5 h-3.5 text-black/50 group-hover:text-black transition-colors" />
                <span className="text-[10px] font-mono text-black uppercase tracking-widest">
                  CA: {CONTRACT_ADDRESS}
                </span>
              </motion.button>

              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 mb-8 border border-black/15 rounded-full bg-black/5"
              >
                <Icon icon="ph:lightning-fill" className="w-4 h-4 text-black" />
                <span className="text-[10px] font-mono text-black/70 uppercase tracking-widest">
                  Web 4.0 Infrastructure · x402 Protocol
                </span>
              </motion.div>

              {/* Main Headline */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight text-black mb-6 leading-[1.05]">
                The <span className="font-bold">Confidential</span> Payment Layer
                <span className="block text-black/30">for the Web 4.0 Economy</span>
              </h1>

              {/* Sub-headline */}
              <p className="text-black/50 text-lg leading-relaxed max-w-xl mb-10">
                Built for Web 4.0 — where autonomous agents, institutions, and developers transact
                on-chain with complete privacy. ZK Proof-powered infrastructure for the next era of
                secure, autonomous commerce.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-6">
                <button 
                  onClick={handleLaunchApp} 
                  className="shiny-cta"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                    Dashboard
                  </span>
                </button>
                
                <a 
                  href="#about" 
                  className="group text-xs font-mono text-black/40 hover:text-black uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  Learn More
                  <Icon icon="ph:arrow-right" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </motion.div>

            {/* Right Column - Dashboard Preview Card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              {/* Card */}
              <div className="relative glass-card rounded-2xl p-6 border-black/10">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-mono text-black/40">ALTIS://protocol/status</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-black/5 border border-black/10 rounded text-[9px] font-mono text-black/60">Encrypted</span>
                    <span className="text-[10px] font-mono text-black/40">Latency: 14ms</span>
                  </div>
                </div>
                
                {/* Protocol Status */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/[0.02] rounded-xl border border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black/5 rounded-lg flex items-center justify-center">
                        <Icon icon="ph:shield-check-fill" className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <div className="text-sm text-black font-medium">Confidential Transactions</div>
                        <div className="text-[10px] text-black/40 font-mono">ZK Proof-Powered Encryption</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-black font-mono">256-bit</div>
                      <div className="text-[10px] text-black/30">AES</div>
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-black/[0.02] rounded-lg border border-black/5 text-center">
                      <div className="text-lg text-black font-mono font-semibold">99.9%</div>
                      <div className="text-[9px] text-black/40 uppercase">Uptime</div>
                    </div>
                    <div className="p-3 bg-black/[0.02] rounded-lg border border-black/5 text-center">
                      <div className="text-lg text-black font-mono font-semibold">&lt;2s</div>
                      <div className="text-[9px] text-black/40 uppercase">Latency</div>
                    </div>
                    <div className="p-3 bg-black/[0.02] rounded-lg border border-black/10 text-center">
                      <div className="text-lg text-black font-mono font-semibold">x402</div>
                      <div className="text-[9px] text-black/40 uppercase">Enabled</div>
                    </div>
                  </div>

                  {/* Protocol Features */}
                  <div className="p-4 bg-black/[0.02] rounded-xl border border-black/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-black/50">Protocol Features</span>
                      <span className="text-[9px] text-black font-mono">ACTIVE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        "Zero-Knowledge Proofs",
                        "End-to-End Encryption",
                        "Smart Payment Routing",
                        "Agent Compatible"
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-black/70">
                          <Icon icon="ph:check-circle-fill" className="w-3 h-3 text-black" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Gradient Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none z-[3]" />
      </section>

      <WalletConnectOverlay 
        isOpen={showWalletOverlay} 
        onClose={() => setShowWalletOverlay(false)} 
      />
    </>
  );
};

export default HeroSection;
