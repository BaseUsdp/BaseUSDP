import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import WalletConnectOverlay from "./WalletConnectOverlay";

const CONTRACT_ADDRESS = "0xb05460ae4555ed1797292138a27221eda7727b07";

declare global {
  interface Window {
    __unicornScene?: any;
  }
}

const wordRevealVariants = {
  hidden: { y: "110%", opacity: 0 },
  visible: (i: number) => ({
    y: "0%",
    opacity: 1,
    transition: {
      duration: 0.8,
      delay: 0.3 + i * 0.12,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

const HeroSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);
  const { isConnected } = useWallet();
  const navigate = useNavigate();

  return (
    <>
      <section
        ref={ref}
        className="min-h-screen flex flex-col justify-end relative overflow-hidden bg-background pt-16"
      >
        {/* Subtle grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-16 w-full">
          {/* Available badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-10 flex items-center gap-3"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <button
              onClick={() => {
                navigator.clipboard.writeText(CONTRACT_ADDRESS);
                toast.success("Contract address copied to clipboard");
              }}
              className="tag-pill hover:border-foreground/40 transition-colors"
              style={{ border: "none", padding: 0 }}
            >
              <span className="text-muted-foreground">CA: {CONTRACT_ADDRESS}</span>
            </button>
          </motion.div>

          {/* Main headline with word reveal */}
          <div className="display-hero text-foreground mb-12">
            <div className="line-mask">
              <motion.span
                className="inline-block font-serif"
                variants={wordRevealVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                custom={0}
              >
                The
              </motion.span>{" "}
              <motion.span
                className="inline-block font-serif italic"
                variants={wordRevealVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                custom={1}
              >
                Confidential
              </motion.span>
            </div>
            <div className="line-mask flex items-end gap-6 flex-wrap">
              <motion.span
                className="inline-block font-serif"
                variants={wordRevealVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                custom={2}
              >
                Layer
              </motion.span>
              <motion.span
                className="inline-block max-w-[280px]"
                variants={wordRevealVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                custom={3}
                style={{
                  fontSize: "clamp(0.9rem, 2vw, 1.5rem)",
                  fontWeight: 300,
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "clamp(0.5rem, 1vw, 1rem)",
                  lineHeight: 1.4,
                  letterSpacing: "-0.01em",
                }}
              >
                Privacy-first payments for the Web 4.0 autonomous economy
              </motion.span>
            </div>
          </div>

          {/* Bottom row */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-10 border-t border-border"
          >
            <div className="flex items-center gap-8">
              {[
                { label: "Protocol", value: "x402" },
                { label: "Privacy", value: "ZK Proofs" },
                { label: "Network", value: "Base L2" },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-border" />}
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-sm font-medium text-foreground">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate("/dashboard")}
                className="shiny-cta"
              >
                <span className="flex items-center gap-2">
                  <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                  Dashboard
                </span>
              </button>
              <a
                href="#about"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>Scroll to explore</span>
                <Icon icon="ph:arrow-down" className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <WalletConnectOverlay
        isOpen={showWalletOverlay}
        onClose={() => setShowWalletOverlay(false)}
      />
    </>
  );
};

export default HeroSection;
