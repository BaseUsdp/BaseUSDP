import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";
import { WarpBackground } from "@/components/ui/warp-background";

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} id="about" className="max-w-[1400px] mx-auto px-8 py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <span className="tag-pill">About USDP</span>
      </motion.div>

      <div className="grid md:grid-cols-12 gap-10 items-start mb-20">
        <motion.div
          className="md:col-span-7"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h2 className="display-section font-serif text-foreground">
            The Internet Was Built for Information. We're{" "}
             <span className="italic gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Building</span>{" "}the Protocol for{" "}
             <span className="italic gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Private Value.</span>
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 pt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            The digital economy runs on public infrastructure, yet value exchange remains fragmented, centralized, and alarmingly transparent.
          </p>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="h-full"
        >
          <WarpBackground
            beamsPerSide={4}
            beamSize={5}
            beamDelayMax={3}
            beamDuration={3}
            beamDelayMin={0}
            perspective={100}
            className="bg-secondary/50 h-full"
          >
            <div className="p-10 flex flex-col justify-between h-full min-h-[320px]">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center">
                    <Icon icon="ph:eye-fill" className="w-6 h-6 text-background" />
                  </div>
                  <div>
                    <h3 className="text-lg text-foreground font-medium">Our Vision</h3>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest">Core Mission</div>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  A world where financial privacy is a fundamental right, not a privilege. Where individuals, institutions, and AI agents can transact freely without sacrificing confidentiality or compliance.
                </p>
              </div>
              <div className="flex items-center gap-4 mt-8">
                <div className="flex -space-x-2">
                  {["ph:user-fill", "ph:buildings-fill", "ph:robot-fill"].map((icon, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-foreground border-2 border-background flex items-center justify-center" style={{ opacity: 1 - i * 0.2 }}>
                      <Icon icon={icon} className="w-4 h-4 text-background" />
                    </div>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">+2 Stakeholder Types</span>
              </div>
            </div>
          </WarpBackground>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-col justify-center gap-0 pl-6"
        >
          <div className="border-b border-border pb-10 mb-10">
            <p className="display-number font-serif text-foreground">$2.5T+</p>
            <p className="text-base text-muted-foreground mt-3 leading-relaxed max-w-xs">
              Market opportunity in privacy-first institutional finance infrastructure.
            </p>
          </div>
          <div>
            <p className="display-number font-serif text-foreground">100%</p>
            <p className="text-base text-muted-foreground mt-3 leading-relaxed max-w-xs">
              Encrypted — zero data leakage across every transaction, every time.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="mt-16 max-w-3xl"
      >
        <p className="text-muted-foreground leading-relaxed mb-6">
          Public blockchains promised a revolution in peer-to-peer finance, but their inherent transparency created a critical barrier to mainstream adoption. For institutions, enterprises, and any entity that values financial privacy, broadcasting every transaction to the world is not just a risk — it's a non-starter.
        </p>
        <p className="text-foreground font-medium leading-relaxed">
          USDP was created to solve this fundamental problem — and to power the Web4 economy. By integrating cutting-edge Zero-Knowledge Proofs (ZKPs) with the internet-native x402 payment standard, we have created the world's first confidential payment layer for the autonomous internet economy. Autonomous by design. Invisible by default.
        </p>
      </motion.div>
    </section>
  );
};

export default AboutSection;
