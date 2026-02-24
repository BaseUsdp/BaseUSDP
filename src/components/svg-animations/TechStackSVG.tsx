import { motion } from "framer-motion";

const TechStackSVG = ({ inverted = false }: { inverted?: boolean }) => {
  const fg = inverted ? "hsl(0 0% 100%)" : "hsl(0 0% 0%)";
  const fgDim = inverted ? "hsl(0 0% 100% / 0.1)" : "hsl(0 0% 0% / 0.05)";
  const fgMid = inverted ? "hsl(0 0% 100% / 0.25)" : "hsl(0 0% 0% / 0.15)";
  const fgText = inverted ? "hsl(0 0% 100% / 0.5)" : "hsl(0 0% 0% / 0.4)";

  const layers = [
    { y: 30, label: "Agent Layer", width: 260 },
    { y: 65, label: "Coordination", width: 220 },
    { y: 100, label: "x402 Protocol", width: 180 },
    { y: 135, label: "Base L2", width: 140 },
  ];

  return (
    <svg viewBox="0 0 320 200" fill="none" className="w-full h-auto">
      {/* Stacked layers - pyramid style */}
      {layers.map((layer, i) => {
        const x = (320 - layer.width) / 2;
        return (
          <motion.g
            key={layer.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <rect
              x={x}
              y={layer.y}
              width={layer.width}
              height="28"
              rx="8"
              fill={i === layers.length - 1 ? fg : fgDim}
              stroke={fgMid}
              strokeWidth="0.5"
            />
            <text
              x="160"
              y={layer.y + 18}
              textAnchor="middle"
              fill={i === layers.length - 1 ? (inverted ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)") : fgText}
              fontSize="9"
              fontWeight="600"
              fontFamily="monospace"
            >
              {layer.label}
            </text>

            {/* Animated connection dots between layers */}
            {i < layers.length - 1 && (
              <>
                <motion.circle
                  cx="160"
                  cy={layer.y + 28 + 4}
                  r="2"
                  fill={fg}
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
                <line
                  x1="160"
                  y1={layer.y + 28}
                  x2="160"
                  y2={layer.y + 35}
                  stroke={fgMid}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </>
            )}
          </motion.g>
        );
      })}

      {/* Side data streams */}
      {[
        { startX: 30, endX: 50, y: 44 },
        { startX: 290, endX: 270, y: 79 },
        { startX: 30, endX: 70, y: 114 },
        { startX: 290, endX: 250, y: 149 },
      ].map((stream, i) => (
        <motion.line
          key={i}
          x1={stream.startX}
          y1={stream.y}
          x2={stream.endX}
          y2={stream.y}
          stroke={fgMid}
          strokeWidth="1"
          strokeDasharray="3 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.8 + i * 0.15 }}
        />
      ))}

      {/* Bottom metrics */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {[
          { label: "Latency", value: "<2s", x: 80 },
          { label: "Uptime", value: "99.9%", x: 160 },
          { label: "Encryption", value: "256-bit", x: 240 },
        ].map((m) => (
          <g key={m.label}>
            <text x={m.x} y="182" textAnchor="middle" fill={fgMid} fontSize="7">{m.label}</text>
            <text x={m.x} y="194" textAnchor="middle" fill={fgText} fontSize="9" fontWeight="700" fontFamily="monospace">{m.value}</text>
          </g>
        ))}
      </motion.g>
    </svg>
  );
};

export default TechStackSVG;
