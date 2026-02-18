import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import dashboardPreview from "@/assets/dashboard-preview.png";

const TechStackSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const techStats = [
    { 
      icon: "ph:shield-check-bold", 
      value: "256", 
      suffix: "-bit", 
      label: "ZK Encryption", 
      description: "Cutting-edge Zero-Knowledge Proof Technology",
    },
    { 
      icon: "ph:lightning-bold", 
      value: "< 2", 
      suffix: "s", 
      label: "Transaction Speed", 
      description: "Sub-second encrypted transfers",
    },
    { 
      icon: "ph:lock-bold", 
      value: "100", 
      suffix: "%", 
      label: "Privacy Guarantee", 
      description: "Zero transaction data leakage",
    },
    { 
      icon: "ph:trend-up-bold", 
      value: "∞", 
      suffix: "", 
      label: "Scalability", 
      description: "Built for enterprise volume",
    },
  ];

  const techStack = [
    { icon: "ph:globe-bold", name: "Base", category: "Blockchain", description: "Ethereum L2 with low-cost, high-speed transactions" },
    { icon: "ph:stack-bold", name: "ZK Proofs", category: "Privacy Layer", description: "Zero-Knowledge Proofs for confidential computing" },
    { icon: "ph:coins-bold", name: "x402", category: "Payment Standard", description: "HTTP 402 for internet-native payments" },
    { icon: "ph:code-bold", name: "Solidity", category: "Smart Contracts", description: "EVM contracts & ORB402 protocol" },
    { icon: "ph:cpu-bold", name: "TypeScript", category: "Backend", description: "Node.js with Express & native x402 libs" },
    { icon: "ph:database-bold", name: "React + Vite", category: "Frontend", description: "Modern web app with optimized builds" },
  ];

  const layers = [
    { 
      name: "Agent Layer", 
      description: "Initiates tasks & determines constraints",
      icon: "ph:robot-bold",
      status: "Active",
      statusColor: "emerald",
      metrics: { requests: "2.4K/s", latency: "12ms", uptime: "99.99%" },
      color: "from-violet-500 to-purple-600",
      useDashboard: true,
    },
    { 
      name: "Coordination Layer", 
      description: "Service discovery & context management",
      icon: "ph:graph-bold",
      status: "Synced",
      statusColor: "blue",
      metrics: { nodes: "847", connections: "12.4K", sync: "100%" },
      color: "from-purple-500 to-indigo-600",
    },
    { 
      name: "Facilitation Layer", 
      description: "Routing, verification & execution",
      icon: "ph:path-bold",
      status: "Processing",
      statusColor: "primary",
      metrics: { txns: "156K", verified: "100%", pending: "24" },
      color: "from-indigo-500 to-blue-600",
    },
    { 
      name: "Currency Layer", 
      description: "Stablecoin transfers (USDC)",
      icon: "ph:currency-circle-dollar-bold",
      status: "Liquid",
      statusColor: "cyan",
      metrics: { volume: "$2.4B", pairs: "12", liquidity: "98%" },
      color: "from-blue-500 to-cyan-600",
    },
    { 
      name: "Blockchain Layer", 
      description: "Cryptographic settlement on Base",
      icon: "ph:cube-bold",
      status: "Confirmed",
      statusColor: "teal",
      metrics: { blocks: "12.4M", finality: "2s", validators: "100" },
      color: "from-cyan-500 to-teal-600",
    },
  ];

  // Generate animated network nodes
  const networkNodes = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 10 + (i % 5) * 22,
    y: 15 + Math.floor(i / 5) * 22,
    delay: i * 0.1,
    connected: [1, 4, 7, 12, 15, 18].includes(i),
  }));

  // Generate transaction flow data
  const transactionFlow = [
    { id: 1, from: "Agent", to: "Coord", progress: 100 },
    { id: 2, from: "Coord", to: "Facil", progress: 85 },
    { id: 3, from: "Facil", to: "Currency", progress: 60 },
    { id: 4, from: "Currency", to: "Chain", progress: 30 },
  ];

  const renderLayerVisualization = (layerIndex: number) => {
    const layer = layers[layerIndex];
    
    if (layer.useDashboard) {
      return (
        <div className="relative w-full h-full min-h-[250px] rounded-xl overflow-hidden border border-white/10">
          <img 
            src={dashboardPreview} 
            alt="ORB402 Dashboard" 
            className="w-full h-full object-cover object-top opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Icon icon="ph:broadcast-bold" className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Live Dashboard Preview</span>
            </div>
          </div>
        </div>
      );
    }

    switch (layerIndex) {
      case 1: // Coordination Layer - Network Graph
        return (
          <div className="relative w-full h-full flex flex-col justify-center p-4">
            <svg className="w-full h-32" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet">
              {/* Connection lines */}
              {networkNodes.slice(0, 10).filter(n => n.connected).map((node, i) => {
                const nextConnected = networkNodes.slice(0, 10).filter(n => n.connected)[i + 1];
                if (!nextConnected) return null;
                return (
                  <motion.line
                    key={`line-${node.id}`}
                    x1={node.x}
                    y1={node.y * 0.6}
                    x2={nextConnected.x}
                    y2={nextConnected.y * 0.6}
                    stroke="rgba(139, 92, 246, 0.3)"
                    strokeWidth="0.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: node.delay }}
                  />
                );
              })}
              
              {/* Animated data packet */}
              <motion.circle
                r="1.5"
                fill="hsl(262, 83%, 58%)"
                filter="url(#glow)"
                animate={{
                  cx: networkNodes.slice(0, 10).filter(n => n.connected).map(n => n.x),
                  cy: networkNodes.slice(0, 10).filter(n => n.connected).map(n => n.y * 0.6),
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Network nodes */}
              {networkNodes.slice(0, 10).map((node) => (
                <motion.g key={node.id}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y * 0.6}
                    r={node.connected ? 2 : 1}
                    fill={node.connected ? "hsl(262, 83%, 58%)" : "rgba(255,255,255,0.2)"}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: node.delay, type: "spring" }}
                  />
                  {node.connected && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y * 0.6}
                      r="3"
                      fill="none"
                      stroke="rgba(139, 92, 246, 0.3)"
                      strokeWidth="0.5"
                      animate={{ r: [3, 5, 3], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: node.delay }}
                    />
                  )}
                </motion.g>
              ))}
              
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
            </svg>
            
            {/* Stats overlay */}
            <div className="flex gap-2 mt-4">
              {Object.entries(layer.metrics).map(([key, value]) => (
                <div key={key} className="flex-1 bg-black/60 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                  <div className="text-[10px] text-white/40 uppercase">{key}</div>
                  <div className="text-sm font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 2: // Facilitation Layer - Transaction Flow
        return (
          <div className="relative w-full h-full min-h-[250px] flex flex-col justify-center p-4">
            {/* Flow visualization */}
            <div className="space-y-4">
              {transactionFlow.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-right">
                      <span className="text-xs text-white/60">{tx.from}</span>
                    </div>
                    <div className="flex-1 h-8 bg-white/5 rounded-lg border border-white/10 overflow-hidden relative">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/30 to-primary/10"
                        initial={{ width: "0%" }}
                        animate={{ width: `${tx.progress}%` }}
                        transition={{ duration: 1.5, delay: i * 0.2 }}
                      />
                      <motion.div
                        className="absolute inset-y-0 left-0 w-2 bg-primary"
                        animate={{ left: ["0%", `${tx.progress}%`] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                        style={{ boxShadow: "0 0 20px #0001ff" }}
                      />
                      {/* Packet indicators */}
                      {[0, 1, 2].map((p) => (
                        <motion.div
                          key={p}
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white"
                          animate={{ 
                            left: ["0%", "100%"],
                            opacity: [0, 1, 1, 0]
                          }}
                          transition={{ 
                            duration: 1.5, 
                            repeat: Infinity, 
                            delay: p * 0.5 + i * 0.2,
                            ease: "linear"
                          }}
                        />
                      ))}
                    </div>
                    <div className="w-20">
                      <span className="text-xs text-white/60">{tx.to}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Verification badge */}
            <motion.div
              className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icon icon="ph:check-circle-bold" className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">All Verified</span>
            </motion.div>
          </div>
        );

      case 3: // Currency Layer - Financial Dashboard
        return (
          <div className="relative w-full h-full min-h-[250px] p-4 flex flex-col gap-3">
            {/* Token cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { symbol: "USDC", name: "USD Coin", amount: "••••••", change: "+2.4%" },
                { symbol: "ETH", name: "Ethereum", amount: "••••••", change: "+5.2%" },
              ].map((token, i) => (
                <motion.div
                  key={token.symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                      i === 0 ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-indigo-400 to-purple-600'
                    }`}>
                      {token.symbol.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{token.symbol}</div>
                      <div className="text-[10px] text-white/40">{token.name}</div>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <motion.span 
                      className="text-lg font-bold text-white"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      {token.amount}
                    </motion.span>
                    <span className="text-xs text-emerald-400">{token.change}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Volume chart simulation */}
            <div className="flex-1 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/40 mb-3">24h Volume</div>
              <div className="flex items-end gap-1 h-20">
                {Array.from({ length: 24 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-primary/30 to-primary rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${20 + Math.random() * 80}%` }}
                    transition={{ duration: 0.5, delay: i * 0.03 }}
                  />
                ))}
              </div>
            </div>
            
            {/* Liquidity indicator */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-primary to-cyan-500 rounded-full"
                animate={{ width: ["60%", "95%", "75%", "90%", "60%"] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        );

      case 4: // Blockchain Layer - Block visualization
        return (
          <div className="relative w-full h-full min-h-[250px] p-4">
            {/* Block chain visualization */}
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex gap-2">
                  {Array.from({ length: 8 }, (_, col) => {
                    const blockNum = row * 8 + col;
                    const isConfirmed = blockNum < 28;
                    const isPending = blockNum >= 28 && blockNum < 30;
                    return (
                      <motion.div
                        key={col}
                        className={`flex-1 aspect-square rounded-lg border flex items-center justify-center relative overflow-hidden ${
                          isPending 
                            ? 'bg-primary/20 border-primary/50' 
                            : isConfirmed 
                              ? 'bg-white/5 border-white/10' 
                              : 'bg-white/[0.02] border-white/5'
                        }`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: blockNum * 0.02 }}
                        whileHover={{ scale: 1.1, borderColor: "rgba(139, 92, 246, 0.5)" }}
                      >
                        {isPending && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                        {isConfirmed && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                        {isPending && (
                          <motion.div 
                            className="w-2 h-2 rounded-full bg-primary"
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* Block info */}
            <motion.div
              className="absolute bottom-6 left-6 right-6 bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/40">Latest Block</div>
                  <div className="text-lg font-mono font-bold text-white">#12,847,293</div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Icon icon="ph:check-circle-bold" className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Finalized</span>
                  </motion.div>
                  <span className="text-xs text-white/40">2s ago</span>
                </div>
              </div>
            </motion.div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section ref={ref} id="technology" className="relative border-t border-white/5">
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 w-[600px] h-[600px] -translate-x-1/2 bg-primary/8 rounded-full blur-[150px]" />
      </div>

      <div className="container relative mx-auto px-6 py-32">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div 
            className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a]/80 ring-1 ring-white/10 px-3 py-1.5 shadow-lg border border-white/5 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center justify-center bg-primary/20 w-6 h-6 rounded-full">
              <Icon icon="ph:cpu-bold" className="w-3.5 h-3.5 text-primary" />
            </span>
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-primary pr-1">
              Technology
            </span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} 
            animate={isInView ? { opacity: 1, y: 0 } : {}} 
            transition={{ delay: 0.1 }} 
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[0.95] text-white"
          >
            Enterprise-Grade
          </motion.h2>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }} 
            animate={isInView ? { opacity: 1, y: 0 } : {}} 
            transition={{ delay: 0.15 }} 
            className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[0.95] mt-2"
          >
            <span className="italic text-white/40 font-light">Privacy</span>{" "}
            <span className="text-primary">Infrastructure</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={isInView ? { opacity: 1 } : {}} 
            transition={{ delay: 0.2 }} 
            className="mt-6 text-white/60 text-lg max-w-2xl mx-auto"
          >
            Built on proven, battle-tested technology for maximum security and scalability.
          </motion.p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {techStats.map((stat, i) => (
            <motion.div 
              key={stat.label} 
              initial={{ opacity: 0, y: 30 }} 
              animate={isInView ? { opacity: 1, y: 0 } : {}} 
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              onHoverStart={() => setHoveredCard(i)}
              onHoverEnd={() => setHoveredCard(null)}
              className="group relative"
            >
              <motion.div
                className="absolute inset-0 rounded-3xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"
                style={{ background: 'linear-gradient(135deg, #0001ff / 0.3, #0001ff / 0.1)' }}
              />
              
              <motion.div
                className="relative bg-[#0a0a0a]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 overflow-hidden"
                whileHover={{ 
                  y: -8,
                  boxShadow: "0 25px 50px -12px rgba(139, 92, 246, 0.25)",
                  borderColor: "rgba(139, 92, 246, 0.3)"
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), transparent 60%)' }}
                />

                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <motion.div 
                    className="p-2 bg-white/5 rounded-full border border-white/10 text-primary"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6, type: "spring" }}
                    animate={hoveredCard === i ? { 
                      boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
                      borderColor: "rgba(139, 92, 246, 0.5)"
                    } : {}}
                  >
                    <Icon icon={stat.icon} className="w-5 h-5" />
                  </motion.div>
                  <span className="text-xs font-medium uppercase tracking-widest text-white/40">
                    {stat.label}
                  </span>
                </div>

                <div className="flex items-baseline gap-1 relative z-10">
                  <motion.span 
                    className="text-5xl font-semibold text-white tracking-tight"
                    animate={hoveredCard === i ? { color: "#0001ff" } : { color: "#ffffff" }}
                    transition={{ duration: 0.3 }}
                  >
                    {stat.value}
                  </motion.span>
                  <motion.span 
                    className="text-2xl text-white/40 font-medium"
                    animate={hoveredCard === i ? { color: "#0001ff" } : {}}
                  >
                    {stat.suffix}
                  </motion.span>
                </div>

                <motion.p 
                  className="text-white/50 text-sm mt-2 font-medium relative z-10"
                  animate={hoveredCard === i ? { color: "rgba(255,255,255,0.7)" } : {}}
                >
                  {stat.description}
                </motion.p>

                <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
                  <motion.div 
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={isInView ? { width: "100%" } : {}}
                    transition={{ delay: 0.5 + i * 0.15, duration: 1, ease: "easeOut" }}
                    style={{ boxShadow: hoveredCard === i ? "0 0 15px rgba(139, 92, 246, 0.6)" : "none" }}
                  />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* ULTRA PREMIUM Architecture Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="relative mb-20"
        >
          {/* Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <motion.span 
                initial={{ opacity: 0 }} 
                animate={isInView ? { opacity: 1 } : {}} 
                className="mb-4 block text-xs font-semibold uppercase tracking-[0.2em] text-primary"
              >
                Architecture
              </motion.span>
              <motion.h3 
                initial={{ opacity: 0, y: 20 }} 
                animate={isInView ? { opacity: 1, y: 0 } : {}} 
                className="text-3xl md:text-4xl font-semibold text-white"
              >
                Layered <span className="italic text-white/40 font-light">Design</span>
              </motion.h3>
            </div>
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={isInView ? { opacity: 1 } : {}} 
              className="text-white/50 text-sm max-w-md"
            >
              A modular architecture that abstracts complexity while maintaining security.
            </motion.p>
          </div>

          {/* Premium Dashboard Card */}
          <div className="relative bg-gradient-to-b from-[#0a0a0a]/90 to-[#050505]/95 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
            {/* Dashboard Header Bar */}
            <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-red-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-yellow-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-green-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10">
                  <Icon icon="ph:terminal-bold" className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40 font-mono">ORB402://protocol/architecture/live</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs text-emerald-400 font-medium">LIVE</span>
                </div>
                <div className="flex items-center gap-1">
                  <motion.button
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Icon icon="ph:pause-bold" className="w-3 h-3" /> : <Icon icon="ph:play-bold" className="w-3 h-3" />}
                  </motion.button>
                  <motion.button
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors"
                    whileHover={{ scale: 1.05, rotate: -180 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon icon="ph:arrow-counter-clockwise-bold" className="w-3 h-3" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Main Dashboard Content */}
            <div className="grid lg:grid-cols-[280px_1fr] min-h-[400px]">
              {/* Left Sidebar - Layer Navigation */}
              <div className="relative p-4 border-r border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">

                <div className="space-y-2">
                  {layers.map((layer, i) => (
                    <motion.button
                      key={layer.name}
                      onClick={() => setActiveLayer(i)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.6 + i * 0.1 }}
                      className={`w-full group relative flex items-center gap-3 p-4 rounded-xl transition-all duration-300 text-left ${
                        activeLayer === i 
                          ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30' 
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-white/10'
                      }`}
                    >
                      {/* Active glow */}
                      {activeLayer === i && (
                        <motion.div
                          className="absolute inset-0 rounded-xl opacity-50"
                          style={{ 
                            boxShadow: "inset 0 0 30px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.1)" 
                          }}
                          layoutId="activeLayerGlow"
                        />
                      )}

                      {/* Layer number indicator */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(50%-2px)] z-10">
                        <motion.div
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            activeLayer === i 
                              ? 'bg-primary text-white shadow-lg shadow-primary/50' 
                              : 'bg-white/10 text-white/40'
                          }`}
                          animate={activeLayer === i ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {i + 1}
                        </motion.div>
                      </div>

                      <motion.div 
                        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                          activeLayer === i 
                            ? `bg-gradient-to-br ${layer.color} text-white shadow-lg` 
                            : 'bg-white/5 text-white/40 group-hover:text-white/60 border border-white/10'
                        }`}
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        animate={activeLayer === i ? { rotate: [0, 3, -3, 0] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon icon={layer.icon} className="w-5 h-5" />
                      </motion.div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-medium truncate ${activeLayer === i ? 'text-white' : 'text-white/70'}`}>
                            {layer.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs truncate ${activeLayer === i ? 'text-white/60' : 'text-white/40'}`}>
                            {layer.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          layer.statusColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          layer.statusColor === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          layer.statusColor === 'cyan' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                          layer.statusColor === 'teal' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                          'bg-primary/20 text-primary border border-primary/30'
                        }`}>
                          {layer.status}
                        </span>
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Icon icon="ph:caret-right-bold" className={`w-4 h-4 ${activeLayer === i ? 'text-primary' : 'text-white/20'}`} />
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* System status */}
                <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-white/40 uppercase tracking-wider">System Health</span>
                    <span className="text-xs text-emerald-400">Optimal</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "CPU", value: 23 },
                      { label: "Memory", value: 45 },
                      { label: "Network", value: 78 },
                    ].map((metric) => (
                      <div key={metric.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-12">{metric.label}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${metric.value}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                          />
                        </div>
                        <span className="text-[10px] text-white/60 w-8">{metric.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Panel - Layer Visualization */}
              <div className="relative p-6 lg:p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeLayer}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="h-full flex flex-col"
                  >
                    {/* Layer Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <motion.div 
                          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${layers[activeLayer].color} text-white shadow-2xl`}
                          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.02, 1] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <Icon icon={layers[activeLayer].icon} className="w-8 h-8" />
                        </motion.div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-2xl font-semibold text-white">{layers[activeLayer].name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/60 font-mono">
                              LAYER {activeLayer + 1}/5
                            </span>
                          </div>
                          <p className="text-white/50">{layers[activeLayer].description}</p>
                        </div>
                      </div>
                      <motion.button
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm border border-primary/30 hover:bg-primary/20 transition-colors"
                        whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Icon icon="ph:eye-bold" className="w-4 h-4" />
                        <span>View Docs</span>
                        <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {Object.entries(layers[activeLayer].metrics).map(([key, value], i) => (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative bg-white/[0.03] rounded-xl p-4 border border-white/5 overflow-hidden group hover:border-primary/30 transition-colors"
                        >
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                          <div className="relative z-10">
                            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{key}</div>
                            <motion.div 
                              className="text-2xl font-bold text-white"
                              animate={{ opacity: [1, 0.8, 1] }}
                              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                            >
                              {value}
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Visualization Area */}
                    <div className="flex-1 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl border border-white/5 overflow-hidden">
                      {renderLayerVisualization(activeLayer)}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom status bar */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:hard-drives-bold" className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40">Base Mainnet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="ph:database-bold" className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/40">256-bit ZK</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="ph:wifi-high-bold" className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Connected</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="ph:git-branch-bold" className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/40 font-mono">v2.4.0-mainnet</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tech Stack Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-white/5" />
          
          <div className="relative z-10 p-8 lg:p-10">
            <h3 className="text-2xl font-semibold text-white mb-8 text-center">
              Powered By Leading Technologies
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {techStack.map((tech, i) => (
                <motion.div 
                  key={tech.name} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={isInView ? { opacity: 1, y: 0 } : {}} 
                  transition={{ delay: 0.7 + i * 0.1 }}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 10px 40px -10px rgba(139, 92, 246, 0.2)"
                  }}
                  className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <motion.div 
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 group-hover:border-primary/30 group-hover:bg-primary/10 transition-all"
                      whileHover={{ rotate: 5 }}
                    >
                      <Icon icon={tech.icon} className="h-5 w-5 text-white/60 group-hover:text-primary transition-colors" />
                    </motion.div>
                    <div>
                      <span className="text-xs text-primary">{tech.category}</span>
                      <h4 className="font-bold text-white">{tech.name}</h4>
                      <p className="text-xs text-white/50 font-light">{tech.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TechStackSection;