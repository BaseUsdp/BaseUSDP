import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";
import Lottie from "lottie-react";
import eyeAnimation from "@/assets/eye-animation.json";

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section 
      ref={ref}
      id="about"
      className="bg-black border-b border-white/5 pt-32 pb-32 relative"
    >
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left Column - Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="text-[10px] font-mono text-violet-500 uppercase mb-4 tracking-widest">
              01 — About ORB402
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-8 leading-[1.05]">
              The Internet Was Built for Information.
              <span className="block text-neutral-600 mt-2">We're Building the Protocol for Private Value.</span>
            </h2>
            <div className="space-y-6 text-neutral-400 leading-relaxed">
              <p>
                The digital economy runs on public infrastructure, yet value exchange remains fragmented, centralized, and alarmingly transparent.
              </p>
              <p>
                Public blockchains promised a revolution in peer-to-peer finance, but their inherent transparency created a critical barrier to mainstream adoption. For institutions, enterprises, and any entity that values financial privacy, broadcasting every transaction to the world is not just a risk—it's a non-starter.
              </p>
              <p>
                <span className="text-white font-medium">ORB402 was created to solve this fundamental problem — and to power the Web 4.0 economy.</span> Web 4.0 is the era where autonomous agents and machines transact value independently, and privacy is non-negotiable. By integrating cutting-edge Zero-Knowledge Proofs (ZK Proofs) with the internet-native x402 payment standard, we have created the world's first confidential payment layer for this new autonomous internet economy.
              </p>
            </div>
          </motion.div>
          
          {/* Right Column - Vision Card + Filler Boxes */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Vision Card */}
            <div className="glass-card rounded-2xl p-8 border-violet-500/10">
              <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Lottie 
                  animationData={eyeAnimation} 
                  loop={true}
                  style={{ width: 32, height: 32 }}
                />
              </div>
                <div>
                  <h3 className="text-lg text-white font-medium">Our Vision</h3>
                  <div className="text-[10px] font-mono text-violet-400 uppercase">Core Mission</div>
                </div>
              </div>
              <p className="text-neutral-300 leading-relaxed mb-8">
                A world where financial privacy is a fundamental right, not a privilege. Where individuals, institutions, and AI agents can transact freely without sacrificing confidentiality or compliance.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-violet-600 border-2 border-black flex items-center justify-center">
                    <Icon icon="ph:user-fill" className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-black flex items-center justify-center">
                    <Icon icon="ph:buildings-fill" className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-black flex items-center justify-center">
                    <Icon icon="ph:robot-fill" className="w-4 h-4 text-white" />
                  </div>
                </div>
                <span className="text-xs text-neutral-500">+2 Stakeholder Types</span>
              </div>
            </div>

            {/* Filler Box 1 - Key Stats */}
            <div className="glass-card rounded-2xl p-6 border-white/5">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-white mb-1">$2.5T+</div>
                  <div className="text-[10px] text-neutral-500 uppercase font-mono">Market Opportunity</div>
                </div>
                <div className="text-center border-x border-white/10">
                  <div className="text-2xl font-semibold text-violet-400 mb-1">100%</div>
                  <div className="text-[10px] text-neutral-500 uppercase font-mono">Encrypted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-white mb-1">Sub-sec</div>
                  <div className="text-[10px] text-neutral-500 uppercase font-mono">Finality</div>
                </div>
              </div>
            </div>

            {/* Filler Box 2 - Tech Partners */}
            <div className="glass-card rounded-2xl p-6 border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Web 4.0 Stack</span>
                <Icon icon="ph:arrow-right" className="w-4 h-4 text-neutral-600" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                  <Icon icon="simple-icons:coinbase" className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-neutral-300">Base</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                  <Icon icon="ph:shield-check-fill" className="w-4 h-4 text-violet-400" />
                  <span className="text-xs text-neutral-300">ZK Proofs</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                  <Icon icon="ph:currency-dollar-fill" className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-neutral-300">x402</span>
                </div>
              </div>
            </div>

            {/* Learn More Link */}
            <a 
              href="#features" 
              className="flex items-center gap-2 text-xs font-mono text-violet-400 hover:text-violet-300 transition-colors uppercase tracking-widest group pt-2"
            >
              Learn More
              <Icon icon="ph:arrow-right" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
