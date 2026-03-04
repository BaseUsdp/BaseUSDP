"use client";
import React from "react";
import {
  motion,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export const FloatingNav = ({
  navItems,
  className,
  rightElement,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }[];
  className?: string;
  rightElement?: React.ReactNode;
}) => {
  const { scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = React.useState(false);

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      setScrolled(current > 0.02);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={cn(
        "flex max-w-fit fixed top-5 inset-x-0 mx-auto rounded-full z-[5000] px-2 py-2 items-center justify-center space-x-1 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border border-border shadow-lg"
          : "bg-background/60 backdrop-blur-md border border-border/50",
        className
      )}
    >
      {navItems.map((navItem, idx) => {
        if (navItem.onClick) {
          return (
            <a
              key={idx}
              href={navItem.link}
              onClick={navItem.onClick}
              className={cn(
                "relative items-center flex space-x-1 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-secondary/50 text-sm"
              )}
            >
              <span className="block sm:hidden">{navItem.icon}</span>
              <span className="hidden sm:block">{navItem.name}</span>
            </a>
          );
        }
        return (
          <Link
            key={idx}
            to={navItem.link}
            className={cn(
              "relative items-center flex space-x-1 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-secondary/50 text-sm"
            )}
          >
            <span className="block sm:hidden">{navItem.icon}</span>
            <span className="hidden sm:block">{navItem.name}</span>
          </Link>
        );
      })}
      {rightElement}
    </motion.div>
  );
};
