import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import WalletConnectOverlay from "./WalletConnectOverlay";

// Keep a single Unicorn Studio scene instance across React StrictMode re-mounts
declare global {
  interface Window {
    __unicornScene?: any;
  }
}

const HeroSection = () => {
  const ref = useRef(null);
  const unicornRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);
  const { isConnected } = useWallet();
  const navigate = useNavigate();

  // Initialize Unicorn Studio inside hero only
  useEffect(() => {
    let cancelled = false;

    const initScene = async () => {
      const UnicornStudio = (window as any).UnicornStudio;
      if (!UnicornStudio || !unicornRef.current) return false;

      try {
        if (window.__unicornScene) {
          try {
            window.__unicornScene.destroy();
          } catch {
            // ignore
          }
          window.__unicornScene = undefined;
        }

        const scene = await UnicornStudio.addScene({
          elementId: "unicorn-hero-bg",
          projectId: "ILgOO23w4wEyPQOKyLO4",
          scale: 1,
          dpi: 1.5,
          fps: 60,
          lazyLoad: false,
          production: true,
        });

        if (!cancelled) {
          window.__unicornScene = scene;
        } else {
          try {
            scene.destroy();
          } catch {
            // ignore
          }
        }
        return true;
      } catch (err) {
        console.error("Unicorn Studio error:", err);
        return false;
      }
    };

    const tryInit = async () => {
      const success = await initScene();
      if (!success && !cancelled) {
        const delays = [200, 500, 1000, 2000];
        for (const delay of delays) {
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) break;
          const result = await initScene();
          if (result) break;
        }
      }
    };

    tryInit();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLaunchApp = () => {
    navigate("/dashboard");
  };

  return (
    <>
      <section 
        ref={ref}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-transparent pt-32"
      >
        {/* Unicorn Studio Background - Hero Only */}
        <div
          ref={unicornRef}
          id="unicorn-hero-bg"
          className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
          style={{
            zIndex: 0,
            opacity: 0.9,
            filter: "contrast(1.1) brightness(1.2) hue-rotate(-30deg)",
          }}
        />

        {/* Technical Grid Background */}
        <div className="absolute inset-0 pointer-events-none z-[1] technical-grid opacity-30" />

        {/* Vertical Structure Lines */}
        <div className="absolute inset-0 pointer-events-none z-[1] max-w-[1400px] mx-auto border-x border-violet-500/[0.04]">
          <div className="absolute left-1/4 h-full w-px bg-violet-500/[0.03]" />
          <div className="absolute left-2/4 h-full w-px bg-violet-500/[0.03]" />
          <div className="absolute left-3/4 h-full w-px bg-violet-500/[0.03]" />
        </div>

        <div className="max-w-[1400px] relative mx-auto px-6 py-16 z-[2]">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left Column - Text Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 mb-8 border border-violet-500/20 rounded-full bg-violet-900/20 backdrop-blur-xl"
              >
                <Icon icon="ph:lightning-fill" className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-mono text-violet-300 uppercase tracking-widest">
                  x402 Protocol Enabled
                </span>
              </motion.div>

              {/* Main Headline */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight text-white mb-6 leading-[1.05]">
                The <span className="gradient-text-violet">Confidential</span> Payment Layer
                <span className="block text-neutral-600">for the Agentic Economy</span>
              </h1>

              {/* Sub-headline */}
              <p className="text-neutral-400 text-lg leading-relaxed max-w-xl mb-10">
                Our ZK Proof-powered infrastructure enables institutions, developers, and AI agents 
                to transact on-chain with complete privacy, unlocking the future of secure, 
                autonomous commerce.
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
                  className="group text-xs font-mono text-neutral-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
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
              {/* Glow Behind Card */}
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-indigo-600/20 rounded-3xl blur-2xl" />
              
              {/* Card */}
              <div className="relative glass-card rounded-2xl p-6 border-violet-500/20">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-mono text-neutral-500">ORB402://protocol/status</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-violet-500/20 border border-violet-500/30 rounded text-[9px] font-mono text-violet-300">Encrypted</span>
                    <span className="text-[10px] font-mono text-neutral-500">Latency: 14ms</span>
                  </div>
                </div>
                
                {/* Protocol Status */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
                        <Icon icon="ph:shield-check-fill" className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">Confidential Transactions</div>
                        <div className="text-[10px] text-neutral-500 font-mono">ZK Proof-Powered Encryption</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-violet-400 font-mono">256-bit</div>
                      <div className="text-[10px] text-neutral-600">AES</div>
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-black/40 rounded-lg border border-white/5 text-center">
                      <div className="text-lg text-white font-mono font-semibold">99.9%</div>
                      <div className="text-[9px] text-neutral-500 uppercase">Uptime</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-white/5 text-center">
                      <div className="text-lg text-white font-mono font-semibold">&lt;2s</div>
                      <div className="text-[9px] text-neutral-500 uppercase">Latency</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-violet-500/20 text-center">
                      <div className="text-lg text-violet-400 font-mono font-semibold">x402</div>
                      <div className="text-[9px] text-neutral-500 uppercase">Enabled</div>
                    </div>
                  </div>

                  {/* Protocol Features */}
                  <div className="p-4 bg-gradient-to-r from-violet-900/30 to-purple-900/30 rounded-xl border border-violet-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-neutral-400">Protocol Features</span>
                      <span className="text-[9px] text-violet-400 font-mono">ACTIVE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        "Zero-Knowledge Proofs",
                        "End-to-End Encryption",
                        "Smart Payment Routing",
                        "Agent Compatible"
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-neutral-300">
                          <Icon icon="ph:check-circle-fill" className="w-3 h-3 text-violet-500" />
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
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent pointer-events-none z-[3]" />
      </section>

      {/* Wallet Connect Overlay */}
      <WalletConnectOverlay 
        isOpen={showWalletOverlay} 
        onClose={() => setShowWalletOverlay(false)} 
      />
    </>
  );
};

export default HeroSection;
