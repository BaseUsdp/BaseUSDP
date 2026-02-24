import { motion } from "framer-motion";

const ZKShieldSVG = ({ inverted = false }: { inverted?: boolean }) => {
  const fg = inverted ? "hsl(0 0% 100%)" : "hsl(0 0% 0%)";
  const fgDim = inverted ? "hsl(0 0% 100% / 0.1)" : "hsl(0 0% 0% / 0.06)";
  const fgMid = inverted ? "hsl(0 0% 100% / 0.3)" : "hsl(0 0% 0% / 0.2)";
  const fgText = inverted ? "hsl(0 0% 100% / 0.5)" : "hsl(0 0% 0% / 0.45)";
  const fgSoft = inverted ? "hsl(0 0% 100% / 0.08)" : "hsl(0 0% 0% / 0.04)";

  return (
    <svg viewBox="0 0 320 200" fill="none" className="w-full h-auto">
      {/* Concentric rings */}
      {[80, 60, 40].map((r, i) => (
        <motion.circle
          key={r}
          cx="160"
          cy="100"
          r={r}
          stroke={fgDim}
          strokeWidth="1"
          fill="none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 * i }}
        />
      ))}

      {/* Rotating data points on outer ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 160 + Math.cos(rad) * 80;
        const cy = 100 + Math.sin(rad) * 80;
        return (
          <motion.g key={angle}>
            <motion.circle
              cx={cx}
              cy={cy}
              r="3"
              fill={fgMid}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
            />
            {/* Connecting line to center */}
            <motion.line
              x1={cx}
              y1={cy}
              x2="160"
              y2="100"
              stroke={fgDim}
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
            />
          </motion.g>
        );
      })}

      {/* Middle ring data nodes */}
      {[30, 150, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 160 + Math.cos(rad) * 60;
        const cy = 100 + Math.sin(rad) * 60;
        return (
          <motion.rect
            key={angle}
            x={cx - 10}
            y={cy - 6}
            width="20"
            height="12"
            rx="3"
            fill={fgSoft}
            stroke={fgMid}
            strokeWidth="0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
          />
        );
      })}

      {/* Center shield */}
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 100, delay: 0.4 }}
      >
        <circle cx="160" cy="100" r="26" fill={fg} />
        {/* Shield icon path */}
        <path
          d="M160 82 L172 88 L172 98 C172 106 167 112 160 115 C153 112 148 106 148 98 L148 88 Z"
          fill={inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"}
          strokeWidth="0"
        />
        {/* Checkmark inside shield */}
        <motion.path
          d="M154 98 L158 102 L166 94"
          stroke={inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        />
      </motion.g>

      {/* Scanning line */}
      <motion.line
        x1="80"
        y1="100"
        x2="240"
        y2="100"
        stroke={fg}
        strokeWidth="0.5"
        strokeOpacity={0.15}
        animate={{
          y1: [60, 140, 60],
          y2: [60, 140, 60],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Bottom ZK badge */}
      <motion.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <rect x="120" y="165" width="80" height="22" rx="11" fill={fgDim} stroke={fgMid} strokeWidth="0.5" />
        <text x="160" y="180" textAnchor="middle" fill={fgText} fontSize="8" fontWeight="600" fontFamily="monospace">ZK VERIFIED</text>
      </motion.g>
    </svg>
  );
};

export default ZKShieldSVG;
