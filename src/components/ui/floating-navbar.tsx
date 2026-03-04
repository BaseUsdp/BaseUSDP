"use client";
import React, { useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import AltisLogo from "@/components/AltisLogo";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      setScrolled(current > 0.02);
    }
  });

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop: floating pill */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={cn(
          "hidden md:flex max-w-fit fixed top-5 inset-x-0 mx-auto rounded-full z-[5000] px-2 py-2 items-center justify-center space-x-1 transition-all duration-300",
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
                className="relative items-center flex space-x-1 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-secondary/50 text-sm"
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
              className="relative items-center flex space-x-1 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-secondary/50 text-sm"
            >
              <span className="block sm:hidden">{navItem.icon}</span>
              <span className="hidden sm:block">{navItem.name}</span>
            </Link>
          );
        })}
        {rightElement}
      </motion.div>

      {/* Mobile: fixed top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[5000] h-14 flex items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <AltisLogo size={18} className="text-foreground" />
          <span className="text-sm font-semibold tracking-tighter text-foreground">BASEUSDP</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[5001] md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 w-72 bg-background border-r border-border shadow-2xl z-[5002] md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-border">
                <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <AltisLogo size={18} className="text-foreground" />
                  <span className="text-sm font-semibold tracking-tighter text-foreground">BASEUSDP</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
                {navItems.map((navItem, idx) => {
                  const handleClick = (e: React.MouseEvent) => {
                    if (navItem.onClick) {
                      navItem.onClick(e);
                    }
                    setMobileOpen(false);
                  };

                  if (navItem.onClick) {
                    return (
                      <a
                        key={idx}
                        href={navItem.link}
                        onClick={handleClick}
                        className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 py-3 px-3 rounded-lg transition-colors"
                      >
                        {navItem.icon}
                        <span>{navItem.name}</span>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={idx}
                      to={navItem.link}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 py-3 px-3 rounded-lg transition-colors"
                    >
                      {navItem.icon}
                      <span>{navItem.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 border-t border-border">
                {rightElement}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};