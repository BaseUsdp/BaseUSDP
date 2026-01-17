import { useEffect, useRef, ReactNode } from "react";
import { motion, useInView, useAnimation, Variants } from "framer-motion";

interface AuraRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  blur?: boolean;
  direction?: "up" | "down" | "left" | "right";
  once?: boolean;
}

const AuraReveal = ({
  children,
  className = "",
  delay = 0,
  duration = 0.8,
  blur = true,
  direction = "up",
  once = true,
}: AuraRevealProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: "-100px" });
  const controls = useAnimation();

  const getInitialPosition = () => {
    switch (direction) {
      case "up": return { y: 40 };
      case "down": return { y: -40 };
      case "left": return { x: 40 };
      case "right": return { x: -40 };
      default: return { y: 40 };
    }
  };

  const variants: Variants = {
    hidden: {
      opacity: 0,
      filter: blur ? "blur(10px)" : "blur(0px)",
      ...getInitialPosition(),
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default AuraReveal;
