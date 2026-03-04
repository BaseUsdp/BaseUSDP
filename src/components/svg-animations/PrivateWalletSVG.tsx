import { motion } from "framer-motion";

const PrivateWalletSVG = ({ inverted = false }: { inverted?: boolean }) => {
  const fg = inverted ? "hsl(0 0% 100%)" : "hsl(0 0% 0%)";
  const fgDim = inverted ? "hsl(0 0% 100% / 0.12)" : "hsl(0 0% 0% / 0.06)";
  const fgMid = inverted ? "hsl(0 0% 100% / 0.25)" : "hsl(0 0% 0% / 0.15)";
  const fgText = inverted ? "hsl(0 0% 100% / 0.5)" : "hsl(0 0% 0% / 0.45)";

  return (
    <svg viewBox="0 0 320 200" fill="none" className="w-full h-auto">
      {/* Card shadow layers (stacked cards effect) */}
      <motion.rect
        x="58" y="42" width="204" height="125" rx="12"
        fill={fgDim}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
      <motion.rect
        x="50" y="36" width="220" height="130" rx="14"
        fill={fgDim}
        stroke={fgMid}
        strokeWidth="1"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      />

      {/* Main card */}
      <motion.g
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <rect x="42" y="30" width="236" height="135" rx="16" fill={fg} />
        
        {/* Card chip */}
        <rect x="62" y="52" width="28" height="20" rx="4" fill={inverted ? "hsl(0 0% 0% / 0.2)" : "hsl(0 0% 100% / 0.15)"} />
        <line x1="62" y1="60" x2="90" y2="60" stroke={inverted ? "hsl(0 0% 0% / 0.15)" : "hsl(0 0% 100% / 0.1)"} strokeWidth="0.5" />
        <line x1="62" y1="65" x2="90" y2="65" stroke={inverted ? "hsl(0 0% 0% / 0.15)" : "hsl(0 0% 100% / 0.1)"} strokeWidth="0.5" />
        <line x1="76" y1="52" x2="76" y2="72" stroke={inverted ? "hsl(0 0% 0% / 0.15)" : "hsl(0 0% 100% / 0.1)"} strokeWidth="0.5" />

        {/* Card number (masked) */}
        <text x="62" y="100" fill={inverted ? "hsl(0 0% 0% / 0.4)" : "hsl(0 0% 100% / 0.4)"} fontSize="8" fontFamily="monospace" letterSpacing="2">
          •••• •••• •••• 4291
        </text>

        {/* Card holder */}
        <text x="62" y="120" fill={inverted ? "hsl(0 0% 0% / 0.3)" : "hsl(0 0% 100% / 0.25)"} fontSize="7" fontFamily="monospace" letterSpacing="1">
          USDP PRIVATE
        </text>

        {/* Expiry */}
        <text x="200" y="120" fill={inverted ? "hsl(0 0% 0% / 0.3)" : "hsl(0 0% 100% / 0.25)"} fontSize="7" fontFamily="monospace">
          12/28
        </text>

        {/* Network logo placeholder */}
        <circle cx="248" cy="55" r="10" fill={inverted ? "hsl(0 0% 0% / 0.15)" : "hsl(0 0% 100% / 0.1)"} />
        <circle cx="240" cy="55" r="10" fill={inverted ? "hsl(0 0% 0% / 0.1)" : "hsl(0 0% 100% / 0.07)"} />

        {/* Lock icon on card */}
        <motion.g
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <rect x="238" y="102" width="24" height="16" rx="4" fill={inverted ? "hsl(0 0% 0% / 0.2)" : "hsl(0 0% 100% / 0.12)"} />
          <path d="M246 108 L246 104 C246 102 248 100 250 100 C252 100 254 102 254 104 L254 108" stroke={inverted ? "hsl(0 0% 0% / 0.3)" : "hsl(0 0% 100% / 0.2)"} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </motion.g>
      </motion.g>

      {/* Floating encrypted data particles */}
      {[
        { x: 30, y: 80, delay: 0 },
        { x: 290, y: 50, delay: 0.5 },
        { x: 25, y: 130, delay: 1 },
        { x: 295, y: 120, delay: 1.5 },
      ].map((p, i) => (
        <motion.text
          key={i}
          x={p.x}
          y={p.y}
          fill={fgMid}
          fontSize="7"
          fontFamily="monospace"
          animate={{
            opacity: [0, 0.6, 0],
            y: [p.y, p.y - 15, p.y - 30],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: p.delay }}
        >
          {["0x7f", "Enc", "ZK", "••"][i]}
        </motion.text>
      ))}

      {/* Bottom stats row */}
      <motion.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        {[
          { label: "Balance", value: "Hidden", x: 72 },
          { label: "APY", value: "4-8%", x: 160 },
          { label: "Status", value: "Active", x: 248 },
        ].map((stat) => (
          <g key={stat.label}>
            <text x={stat.x} y="182" textAnchor="middle" fill={fgMid} fontSize="7" fontWeight="500">{stat.label}</text>
            <text x={stat.x} y="194" textAnchor="middle" fill={fgText} fontSize="9" fontWeight="600">{stat.value}</text>
          </g>
        ))}
      </motion.g>
    </svg>
  );
};

export default PrivateWalletSVG;
