import { cn } from "@/lib/utils";

interface StripeBackgroundProps {
  className?: string;
  variant?: "subtle" | "purple" | "gradient";
}

const StripeBackground = ({ className = "", variant = "subtle" }: StripeBackgroundProps) => {
  const variantStyles = {
    subtle: "bg-stripes",
    purple: "bg-stripes-purple",
    gradient: "bg-stripes bg-gradient-to-b from-transparent via-primary/5 to-transparent",
  };

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        variantStyles[variant],
        className
      )}
    />
  );
};

export default StripeBackground;
