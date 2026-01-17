import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlobeGlowProps {
  children: ReactNode;
  className?: string;
  intensity?: "low" | "medium" | "high";
  color?: "primary" | "accent";
}

const GlobeGlow = ({
  children,
  className = "",
  intensity = "medium",
  color = "primary",
}: GlobeGlowProps) => {
  const intensityMap = {
    low: { size: "80%", opacity: "0.1" },
    medium: { size: "120%", opacity: "0.15" },
    high: { size: "150%", opacity: "0.2" },
  };

  const colorMap = {
    primary: "240 100% 50%",
    accent: "240 100% 50%",
  };

  const { size, opacity } = intensityMap[intensity];
  const glowColor = colorMap[color];

  return (
    <div className={cn("relative", className)}>
      {/* Glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at center, hsl(${glowColor} / ${opacity}) 0%, hsl(${glowColor} / 0.05) 40%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      {children}
    </div>
  );
};

export default GlobeGlow;
