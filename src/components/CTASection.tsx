import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Rounded-corner dark card with entry animation */}
      <div className="cta-card-wrapper">
        <div className="cta-card-inner bg-foreground text-background">
          {/* Grain overlay */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative z-10 max-w-[1400px] mx-auto px-8 py-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <span className="tag-pill" style={{ borderColor: "hsl(0 0% 30%)", color: "hsl(0 0% 45%)" }}>
                Join the Invisible Economy
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-serif text-background"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "clamp(3.5rem, 10vw, 9rem)",
                lineHeight: 0.9,
                letterSpacing: "-0.03em",
              }}
            >
              Launch Your
              <br />
              <em>Private Wallet</em>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
            >
              <p className="text-base text-background/40 max-w-sm leading-relaxed">
                The future of autonomous commerce is here, and it demands privacy. USDP empowers you and your AI agents to transact with complete confidentiality on Base. Step into the Web4 era with the ultimate private agentic wallet.
              </p>
              <div className="flex items-center gap-6 shrink-0">
                <motion.button
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-3 bg-background text-foreground rounded-full px-7 py-4 text-sm font-semibold hover:bg-background/90 transition-all duration-300 group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-center w-7 h-7 bg-foreground rounded-full group-hover:bg-foreground/80 transition-colors">
                    <Icon icon="ph:arrow-right-bold" className="w-4 h-4 text-background" />
                  </div>
                  Launch Dashboard
                </motion.button>
                <a
                  href="#about"
                  onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="text-sm text-background/40 hover:text-background/70 transition-colors underline underline-offset-4"
                >
                  Learn More About USDP
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        .cta-card-inner {
          position: relative;
          border-radius: 1.5rem 1.5rem 0 0;
          overflow: hidden;
        }

        @supports (animation-timeline: view()) {
          .cta-card-wrapper {
            view-timeline: --cta-section;
          }
          .cta-card-inner {
            transform-origin: 50% 100%;
            scale: 0.94;
            animation: cta-grow both ease-in-out;
            animation-timeline: --cta-section;
            animation-range: entry 40%;
          }
          @keyframes cta-grow {
            to { scale: 1; border-radius: 0; }
          }
        }
      `}</style>
    </section>
  );
};

export default CTASection;
