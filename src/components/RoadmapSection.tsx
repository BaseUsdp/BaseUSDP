import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";

const RoadmapSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activePhase, setActivePhase] = useState(0);
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  const phases = [
    {
      phase: "Phase 1",
      status: "IN PROGRESS",
      title: "Protocol Launch",
      subtitle: "Core Infrastructure",
      quarter: "Q1 2026",
      icon: "ph:rocket-launch-bold",
      progress: 65,
      color: "from-violet-500 to-purple-600",
      glowColor: "violet",
      description: "Launch of the ORB402 protocol on Base L2 with ZK Proof-powered smart contracts and developer SDKs.",
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
      subtitle: "Partnership Integration",
      quarter: "Q2 2026",
      icon: "ph:users-three-bold",
      progress: 0,
      color: "from-blue-500 to-cyan-600",
      glowColor: "blue",
      description: "Launch of the ORB402 Neobank with P2P payments, confidential savings, and virtual card management.",
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
      subtitle: "Multi-Chain Expansion",
      quarter: "Q3 2026",
      icon: "ph:hand-fist-bold",
      progress: 0,
      color: "from-emerald-500 to-teal-600",
      glowColor: "emerald",
      description: "Introduction of the VOID token with decentralized governance and cross-chain bridge development.",
      milestones: [
        { name: "VOID Token Launch", done: false },
        { name: "Governance Portal", done: false },
        { name: "Cross-Chain Bridge", done: false },
      ],
    },
    {
      phase: "Phase 4",
      status: "UPCOMING",
      title: "Agentic Economy",
      subtitle: "Advanced Features",
      quarter: "Q4 2026",
      icon: "ph:brain-bold",
      progress: 0,
      color: "from-orange-500 to-amber-600",
      glowColor: "orange",
      description: "Deep AI integrations establishing ORB402 as the default privacy layer for autonomous commerce.",
      milestones: [
        { name: "AI Agent SDK", done: false },
        { name: "Institutional Vaults", done: false },
        { name: "ZK Derivatives", done: false },
      ],
    },
  ];

  return (
    <section ref={ref} id="roadmap" className="relative py-32 overflow-hidden bg-[#020202]">
      {/* Top Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage: `repeating-linear-gradient(-45deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)`}} />
      

      <div className="container relative mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-8">
            <Icon icon="ph:sparkle-bold" className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">Roadmap</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-4">
            Building the <span className="text-primary">Future</span>
          </h2>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white/50 mb-6">
            of Private Finance
          </h2>
          <p className="text-white/50 text-base md:text-lg">
            A clear path to revolutionizing confidential transactions and privacy-first financial infrastructure.
          </p>
        </motion.div>

        {/* Main Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative"
        >
          <div className="relative bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
            {/* Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                  <Icon icon="ph:crosshair-bold" className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40 font-mono">ORB402://roadmap/2026</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.div 
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs text-primary font-medium">ACTIVE</span>
              </div>
            </div>

            {/* Phase Navigation - Horizontal Timeline */}
            <div className="px-6 py-6 border-b border-white/5">
              <div className="flex items-center justify-between relative">

                {phases.map((phase, i) => (
                  <motion.button
                    key={phase.phase}
                    onClick={() => setActivePhase(i)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="relative z-10 group"
                  >
                    {/* Node */}
                    <motion.div
                      className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                        activePhase === i 
                          ? `bg-gradient-to-br ${phase.color} border-transparent shadow-lg` 
                          : i < activePhase
                            ? 'bg-primary/20 border-primary/40'
                            : 'bg-white/5 border-white/10 group-hover:border-white/20'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      animate={activePhase === i ? { 
                        boxShadow: [
                          "0 0 20px rgba(139, 92, 246, 0.3)",
                          "0 0 40px rgba(139, 92, 246, 0.5)",
                          "0 0 20px rgba(139, 92, 246, 0.3)"
                        ]
                      } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Icon icon={phase.icon} className={`w-6 h-6 ${
                        activePhase === i ? 'text-white' : 
                        i < activePhase ? 'text-primary' : 'text-white/40'
                      }`} />
                      
                      {/* Progress ring for active phase */}
                      {phase.status === "IN PROGRESS" && (
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="30"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="2"
                          />
                          <motion.circle
                            cx="32"
                            cy="32"
                            r="30"
                            fill="none"
                            stroke="url(#progressGradient)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 30 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 30 * (1 - phase.progress / 100) }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                          <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                              <stop offset="100%" stopColor="hsl(280, 100%, 70%)" />
                            </linearGradient>
                          </defs>
                        </svg>
                      )}
                    </motion.div>

                    {/* Label */}
                    <div className="mt-3 text-center">
                      <p className={`text-xs font-medium ${activePhase === i ? 'text-primary' : 'text-white/60'}`}>
                        {phase.quarter}
                      </p>
                      <p className={`text-[10px] ${activePhase === i ? 'text-white/70' : 'text-white/30'}`}>
                        {phase.title}
                      </p>
                    </div>

                    {/* Status badge for active */}
                    {phase.status === "IN PROGRESS" && (
                      <motion.div
                        className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-primary text-[8px] font-bold text-white"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {phase.progress}%
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Active Phase Content */}
            <div className="p-6 lg:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePhase}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="grid lg:grid-cols-[1fr_300px] gap-8">
                    {/* Left Content */}
                    <div>
                      {/* Phase Header */}
                      <div className="flex items-start gap-4 mb-6">
                        <motion.div 
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${phases[activePhase].color} text-white shadow-lg`}
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <Icon icon={phases[activePhase].icon} className="w-7 h-7" />
                        </motion.div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-white">{phases[activePhase].title}</h3>
                            {phases[activePhase].status === "IN PROGRESS" && (
                              <span className="px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-semibold text-primary flex items-center gap-1.5">
                                <motion.span 
                                  className="w-1.5 h-1.5 rounded-full bg-primary"
                                  animate={{ opacity: [1, 0.3, 1] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                />
                                IN PROGRESS
                              </span>
                            )}
                          </div>
                          <p className="text-white/50">{phases[activePhase].subtitle}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-white/60 leading-relaxed mb-8">
                        {phases[activePhase].description}
                      </p>

                      {/* Progress Bar (for active phase) */}
                      {phases[activePhase].status === "IN PROGRESS" && (
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/40 uppercase tracking-wider">Progress</span>
                            <span className="text-sm font-bold text-primary">{phases[activePhase].progress}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full bg-gradient-to-r ${phases[activePhase].color} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${phases[activePhase].progress}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Milestones */}
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-4 block">
                          Key Milestones
                        </span>
                        <div className="space-y-3">
                          {phases[activePhase].milestones.map((milestone, i) => (
                            <motion.div
                              key={milestone.name}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              onHoverStart={() => setHoveredMilestone(milestone.name)}
                              onHoverEnd={() => setHoveredMilestone(null)}
                              className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                                milestone.done 
                                  ? 'bg-primary/10 border-primary/30' 
                                  : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                              }`}
                            >
                              {/* Animated highlight */}
                              <motion.div
                                className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 to-transparent"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: hoveredMilestone === milestone.name ? 1 : 0 }}
                              />
                              
                              <motion.div 
                                className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
                                  milestone.done 
                                    ? 'bg-primary text-white' 
                                    : 'bg-white/5 text-white/40 border border-white/10'
                                }`}
                                animate={milestone.done ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                {milestone.done ? (
                                  <Icon icon="ph:check-circle-bold" className="w-5 h-5" />
                                ) : (
                                  <Icon icon="ph:clock-bold" className="w-5 h-5" />
                                )}
                              </motion.div>
                              
                              <span className={`relative font-medium ${milestone.done ? 'text-white' : 'text-white/60'}`}>
                                {milestone.name}
                              </span>
                              
                              <Icon icon="ph:arrow-right-bold" className={`w-4 h-4 ml-auto transition-transform ${
                                hoveredMilestone === milestone.name ? 'translate-x-1 text-primary' : 'text-white/20'
                              }`} />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Stats Panel */}
                    <div className="space-y-4">
                      {/* Timeline Info */}
                      <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon icon="ph:lightning-bold" className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-white">Timeline</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-xs text-white/40">Quarter</span>
                            <span className="text-sm font-bold text-white">{phases[activePhase].quarter}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-white/40">Phase</span>
                            <span className="text-sm font-bold text-primary">{phases[activePhase].phase}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-white/40">Status</span>
                            <span className={`text-sm font-bold ${
                              phases[activePhase].status === "IN PROGRESS" ? 'text-emerald-400' : 'text-white/50'
                            }`}>
                              {phases[activePhase].status === "IN PROGRESS" ? "Active" : "Upcoming"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Completion Stats */}
                      <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-4 block">Completion</span>
                        <div className="grid grid-cols-3 gap-3">
                          {phases[activePhase].milestones.map((m, i) => (
                            <div key={i} className="text-center">
                              <motion.div
                                className={`w-full aspect-square rounded-xl flex items-center justify-center mb-2 ${
                                  m.done ? 'bg-primary/20' : 'bg-white/5'
                                }`}
                                animate={m.done ? { 
                                  boxShadow: ["0 0 0 rgba(139,92,246,0)", "0 0 15px rgba(139,92,246,0.3)", "0 0 0 rgba(139,92,246,0)"]
                                } : {}}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                {m.done ? (
                                  <Icon icon="ph:check-circle-bold" className="w-5 h-5 text-primary" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-white/20" />
                                )}
                              </motion.div>
                              <span className="text-[10px] text-white/40">{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Jump */}
                      <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 p-5">
                        <span className="text-xs text-primary uppercase tracking-wider mb-3 block">Quick Jump</span>
                        <div className="grid grid-cols-4 gap-2">
                          {phases.map((p, i) => (
                            <motion.button
                              key={i}
                              onClick={() => setActivePhase(i)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                                activePhase === i 
                                  ? 'bg-primary text-white' 
                                  : 'bg-white/5 text-white/40 hover:bg-white/10'
                              }`}
                            >
                              {i + 1}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </section>
  );
};

export default RoadmapSection;
