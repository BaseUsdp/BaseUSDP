import { cn } from "@/lib/utils";

interface SectionCounterProps {
  current: number;
  total: number;
  className?: string;
}

const SectionCounter = ({ current, total, className }: SectionCounterProps) => {
  const formatNumber = (num: number) => num.toString().padStart(3, "0");

  return (
    <div className={cn("section-counter", className)}>
      <span className="text-primary">{formatNumber(current)}</span>
      <span className="text-muted-foreground/50">—</span>
      <span className="text-muted-foreground">{formatNumber(total)}</span>
    </div>
  );
};

export default SectionCounter;
