import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import ScrollMorphHero from "@/components/ui/scroll-morph-hero";

const HeroSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const navigate = useNavigate();

  return (
    <section ref={ref} className="relative overflow-hidden bg-background">
      {/* Scroll Morph Hero — full viewport */}
      <ScrollMorphHero />

      {/* Bottom overlay bar with stats + CTA — pinned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-background via-background/90 to-transparent pt-16 pb-8">
        <div className="max-w-[1400px] mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 1 }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-6 border-t border-border/30"
          >
            <div className="flex items-center gap-8">
              {[
                { label: "Protocol", value: "x402" },
                { label: "Privacy", value: "ZK Proofs" },
                { label: "Network", value: "Base L2" },
              ].map((stat, i) => (
                <div key={stat.label} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-border/30" />}
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
      </div>
    </section>
  );
};

export default HeroSection;
