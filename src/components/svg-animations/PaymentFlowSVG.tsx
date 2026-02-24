import { motion } from "framer-motion";

const PaymentFlowSVG = ({ inverted = false }: { inverted?: boolean }) => {
  const fg = inverted ? "hsl(0 0% 100%)" : "hsl(0 0% 0%)";
  const fgDim = inverted ? "hsl(0 0% 100% / 0.15)" : "hsl(0 0% 0% / 0.08)";
  const fgMid = inverted ? "hsl(0 0% 100% / 0.4)" : "hsl(0 0% 0% / 0.25)";
  const fgText = inverted ? "hsl(0 0% 100% / 0.6)" : "hsl(0 0% 0% / 0.5)";

  return (
    <svg viewBox="0 0 320 200" fill="none" className="w-full h-auto">
      {/* Grid dots background */}
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 12 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={20 + col * 26}
            cy={15 + row * 25}
            r="1"
            fill={fgDim}
          />
        ))
      )}

      {/* Agent Node Left */}
      <motion.g
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <rect x="30" y="60" width="72" height="80" rx="12" fill={fgDim} stroke={fgMid} strokeWidth="1" />
        <circle cx="66" cy="85" r="14" fill={fg} />
        <text x="66" y="89" textAnchor="middle" fill={inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"} fontSize="10" fontWeight="700">AI</text>
        <text x="66" y="115" textAnchor="middle" fill={fgText} fontSize="8" fontWeight="500">Agent A</text>
        <motion.rect
          x="44" y="125" width="44" height="6" rx="3"
          fill={fgMid}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.g>

      {/* Agent Node Right */}
      <motion.g
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <rect x="218" y="60" width="72" height="80" rx="12" fill={fgDim} stroke={fgMid} strokeWidth="1" />
        <circle cx="254" cy="85" r="14" fill={fg} />
        <text x="254" y="89" textAnchor="middle" fill={inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"} fontSize="10" fontWeight="700">AI</text>
        <text x="254" y="115" textAnchor="middle" fill={fgText} fontSize="8" fontWeight="500">Agent B</text>
        <motion.rect
          x="232" y="125" width="44" height="6" rx="3"
          fill={fgMid}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      </motion.g>

      {/* Center x402 badge */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6, type: "spring" }}
      >
        <rect x="130" y="78" width="60" height="28" rx="14" fill={fg} />
        <text x="160" y="96" textAnchor="middle" fill={inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"} fontSize="10" fontWeight="700" fontFamily="monospace">x402</text>
      </motion.g>

      {/* Animated payment line left to center */}
      <motion.line
        x1="102" y1="92" x2="130" y2="92"
        stroke={fg}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      />

      {/* Animated payment line center to right */}
      <motion.line
        x1="190" y1="92" x2="218" y2="92"
        stroke={fg}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1.0 }}
      />

      {/* Traveling payment dot */}
      <motion.circle
        r="4"
        fill={fg}
        animate={{
          cx: [102, 160, 218],
          cy: [92, 92, 92],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 1,
          ease: "easeInOut",
        }}
      />

      {/* Bottom status bar */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <rect x="95" y="160" width="130" height="24" rx="12" fill={fgDim} stroke={fgMid} strokeWidth="0.5" />
        <motion.circle
          cx="110" cy="172" r="4"
          fill="hsl(142 70% 45%)"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <text x="120" y="176" fill={fgText} fontSize="8" fontWeight="500">Payment Confirmed</text>
      </motion.g>
    </svg>
  );
};

export default PaymentFlowSVG;
