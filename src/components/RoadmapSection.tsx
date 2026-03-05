import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const RoadmapSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);

  const phases = [
    {
      phase: "Phase 1",
      status: "IN PROGRESS",
      title: "Protocol Launch",
      quarter: "Q1 2026",
      icon: "ph:rocket-launch-bold",
      progress: 65,
      description: "Launch of the USDP protocol on Base L2 with ZK Proof-powered smart contracts and developer SDKs.",
      milestones: [
        { name: "Mainnet Deployment", done: true },
        { name: "Developer SDK Release", done: true },
        { name: "Security Audits", done: false },
      ],
    },
    {
      phase: "Phase 2",
      status: "UPCOMING",
      title: "Consumer App",
      quarter: "Q2 2026",
      icon: "ph:users-three-bold",
      progress: 0,
      description: "Launch of the USDP Neobank with P2P payments and confidential savings.",
      milestones: [
        { name: "Neobank App Launch", done: false },
        { name: "Partner Integrations", done: false },
        { name: "Network Expansion", done: false },
      ],
    },
    {
      phase: "Phase 3",
      status: "UPCOMING",
      title: "Governance",
      quarter: "Q3 2026",
      icon: "ph:hand-fist-bold",
      progress: 0,
      description: "Introduction of the governance token with decentralized governance and cross-chain bridge development.",
      milestones: [
        { name: "Token Launch", done: false },
        { name: "Governance Portal", done: false },
        { name: "Cross-Chain Bridge", done: false },
      ],
    },
    {
      phase: "Phase 4",
      status: "UPCOMING",
      title: "Web 4.0 Agentic Economy",
      quarter: "Q4 2026",
      icon: "ph:brain-bold",
      progress: 0,
      description: "Deep AI integrations establishing USDP as the default privacy layer for Web4 — the autonomous, agent-driven internet economy.",
      milestones: [
        { name: "AI Agent SDK", done: false },
        { name: "Institutional Vaults", done: false },
        { name: "ZK Derivatives", done: false },
        { name: "Web 4.0 Marketplace", done: false },
      ],
    },
  ];

  return (
    <section ref={ref} id="roadmap" className="bg-background border-t border-border">
      <div className="max-w-[1400px] mx-auto px-8 py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="tag-pill">Future Path</span>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-10 mb-20">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
          <h2 className="display-section font-serif text-foreground">
              Evolving the{" "}
              <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Web4</em>
              <br />
              Privacy Landscape
            </h2>
          </motion.div>
          <motion.div
            className="md:col-span-4 md:col-start-9 flex items-end"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <p className="text-base text-muted-foreground leading-relaxed">
              Our roadmap for evolving the Web4 privacy landscape — from protocol launch to a fully autonomous agentic economy.
            </p>
          </motion.div>
        </div>

        {/* Horizontal cards layout — magazine editorial spread */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => setHoveredPhase(i)}
              onMouseLeave={() => setHoveredPhase(null)}
              className={`relative rounded-3xl border p-8 md:p-10 transition-all duration-500 overflow-hidden group ${
                i === 0
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border hover:border-foreground/20"
              }`}
            >
              {/* Subtle animated gradient on hover */}
              {i !== 0 && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-secondary/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                />
              )}

              <div className="relative z-10">
                {/* Top row */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      i === 0 ? "bg-background/10" : "bg-secondary"
                    }`}>
                      <Icon icon={phase.icon} className={`w-5 h-5 ${i === 0 ? "text-background" : "text-foreground"}`} />
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase tracking-widest ${i === 0 ? "text-background/40" : "text-muted-foreground"}`}>
                        {phase.quarter}
                      </span>
                    </div>
                  </div>

                  {phase.status === "IN PROGRESS" ? (
                    <div className="flex items-center gap-2">
                      <motion.span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "hsl(var(--beam-green))" }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span className={`text-[10px] uppercase tracking-widest font-semibold ${i === 0 ? "text-background/60" : "text-foreground"}`}>
                        {phase.progress}% Complete
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[10px] uppercase tracking-widest ${i === 0 ? "text-background/30" : "text-muted-foreground/50"}`}>
                      {phase.status}
                    </span>
                  )}
                </div>

                {/* Title & description */}
                <h3 className={`text-2xl font-semibold mb-3 ${i === 0 ? "text-background" : "text-foreground"}`}>
                  {phase.title}
                </h3>
                <p className={`text-sm leading-relaxed mb-8 ${i === 0 ? "text-background/50" : "text-muted-foreground"}`}>
                  {phase.description}
                </p>

                {/* Progress bar for active phase */}
                {phase.status === "IN PROGRESS" && (
                  <div className="mb-8">
                    <div className={`h-1 rounded-full overflow-hidden ${i === 0 ? "bg-background/10" : "bg-secondary"}`}>
                      <motion.div
                        className={`h-full rounded-full ${i === 0 ? "bg-background" : "bg-foreground"}`}
                        initial={{ width: 0 }}
                        animate={isInView ? { width: `${phase.progress}%` } : {}}
                        transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}

                {/* Milestones */}
                <div className="space-y-3">
                  {phase.milestones.map((milestone, mi) => (
                    <motion.div
                      key={milestone.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.4, delay: 0.4 + i * 0.12 + mi * 0.06 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                        milestone.done
                          ? i === 0 ? "bg-background text-foreground" : "bg-foreground text-background"
                          : i === 0 ? "border border-background/20" : "border border-border"
                      }`}>
                        {milestone.done && <Icon icon="ph:check-bold" className="w-3 h-3" />}
                      </div>
                      <span className={`text-sm ${
                        milestone.done
                          ? i === 0 ? "text-background" : "text-foreground"
                          : i === 0 ? "text-background/40" : "text-muted-foreground"
                      }`}>
                        {milestone.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RoadmapSection;
