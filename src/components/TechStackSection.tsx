import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const TechStackSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  const layers = [
    {
      icon: "ph:robot-bold",
      label: "01",
      name: "Agent Layer",
      description: "Initiates tasks & determines constraints",
      metrics: ["2.4K/s requests", "12ms latency", "99.99% uptime"],
      color: "var(--beam-cyan)",
    },
    {
      icon: "ph:graph-bold",
      label: "02",
      name: "Coordination Layer",
      description: "Service discovery & context management",
      metrics: ["847 nodes", "12.4K connections", "100% sync"],
      color: "var(--beam-violet)",
    },
    {
      icon: "ph:path-bold",
      label: "03",
      name: "Facilitation Layer",
      description: "Routing, verification & execution",
      metrics: ["156K txns", "100% verified", "24 pending"],
      color: "var(--beam-indigo)",
    },
    {
      icon: "ph:currency-circle-dollar-bold",
      label: "04",
      name: "Currency Layer",
      description: "Stablecoin transfers (USDC)",
      metrics: ["$2.4B volume", "12 pairs", "98% liquidity"],
      color: "var(--beam-amber)",
    },
    {
      icon: "ph:cube-bold",
      label: "05",
      name: "Blockchain Layer",
      description: "Cryptographic settlement on Base",
      metrics: ["12.4M blocks", "2s finality", "100 validators"],
      color: "var(--beam-green)",
    },
  ];

  const techStack = [
    { icon: "simple-icons:coinbase", name: "Base", role: "Blockchain Layer" },
    { icon: "ph:shield-check-fill", name: "ZK Proofs", role: "Privacy Layer" },
    { icon: "ph:currency-dollar-fill", name: "x402", role: "Payment Standard" },
    { icon: "simple-icons:solidity", name: "Solidity", role: "Smart Contracts" },
    { icon: "simple-icons:typescript", name: "TypeScript", role: "Backend" },
    { icon: "simple-icons:react", name: "React + Vite", role: "Frontend" },
  ];

  return (
    <section ref={ref} id="tech" className="bg-background border-t border-border">
      <div className="max-w-[1400px] mx-auto px-8 py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="tag-pill">Core Architecture</span>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-10 mb-20">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h2 className="display-section font-serif text-foreground">
              Web4 Privacy{" "}
              <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Infrastructure</em>
            </h2>
          </motion.div>
          <motion.div
            className="md:col-span-4 md:col-start-9 flex items-end"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <p className="text-base text-muted-foreground leading-relaxed">
              Five architectural layers engineered for the Web4 agentic economy — delivering end-to-end encrypted, autonomous transactions at scale.
            </p>
          </motion.div>
        </div>

        {/* Stacked horizontal layers — like a GSAP timeline */}
        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border hidden md:block" />

          <div className="space-y-0">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: -40 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
                className="group relative"
                onMouseEnter={() => setHoveredLayer(i)}
                onMouseLeave={() => setHoveredLayer(null)}
              >
                <div className="grid md:grid-cols-[80px_1fr] gap-0">
                  {/* Left: number node */}
                  <div className="hidden md:flex flex-col items-center pt-10">
                    <motion.div
                      className="w-[18px] h-[18px] rounded-full border-2 z-10 transition-colors duration-300"
                      style={{ borderColor: `hsl(${layer.color})`, backgroundColor: hoveredLayer === i ? `hsl(${layer.color})` : 'hsl(var(--background))' }}
                      whileHover={{ scale: 1.3 }}
                    />
                  </div>

                  {/* Right: content */}
                  <div className="border-b border-border py-10 pl-0 md:pl-4 group-hover:pl-6 transition-all duration-500">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-xs font-mono text-muted-foreground/40">{layer.label}</span>
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                            <Icon icon={layer.icon} className="w-4 h-4" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground">{layer.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-md ml-[72px] md:ml-0">
                          {layer.description}
                        </p>
                      </div>

                      {/* Metrics — revealed on hover with stagger */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {layer.metrics.map((metric, mi) => (
                          <motion.span
                            key={mi}
                            initial={{ opacity: 0, y: 10 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.4, delay: 0.15 * i + 0.08 * mi }}
                            className="text-xs font-mono px-3 py-1.5 rounded-full border border-border text-muted-foreground bg-secondary/50"
                          >
                            {metric}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tech stack strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-20 pt-10 border-t border-border"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-8">Powered by</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {techStack.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 1 + i * 0.06 }}
                className="flex items-center gap-3 group cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                  <Icon icon={tech.icon} className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tech.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{tech.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TechStackSection;
