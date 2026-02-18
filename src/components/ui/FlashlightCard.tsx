import { useRef, useState, ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface FlashlightCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

const FlashlightCard = ({ children, className, glowColor = "240 100% 50%" }: FlashlightCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card/50 border border-border/50 transition-all duration-300 hover:border-primary/30",
        className
      )}
      style={{
        "--mouse-x": `${mousePosition.x}%`,
        "--mouse-y": `${mousePosition.y}%`,
      } as React.CSSProperties}
    >
      {/* Flashlight gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, hsl(${glowColor} / 0.1), transparent 40%)`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default FlashlightCard;
