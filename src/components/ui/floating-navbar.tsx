"use client";
import React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      setScrolled(current > 0.02);
    }
  });

  React.useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
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
              <span className="hidden sm:block">{navItem.name}</span>
            </Link>
          );
        })}
        {rightElement}
      </motion.div>

      <div className="md:hidden fixed top-4 right-4 z-[5000]">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="h-11 w-11 rounded-full border border-border bg-background/90 backdrop-blur-md flex items-center justify-center"
        >
          <span className="sr-only">Toggle menu</span>
          <span className="relative block h-4 w-5">
            <span
              className={cn(
                "absolute left-0 top-0 block h-[2px] w-5 rounded-full bg-foreground transition-all duration-300",
                isMobileMenuOpen && "translate-y-[7px] rotate-45"
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-[7px] block h-[2px] w-5 rounded-full bg-foreground transition-all duration-300",
                isMobileMenuOpen && "opacity-0"
              )}
            />
            <span
              className={cn(
                "absolute left-0 top-[14px] block h-[2px] w-5 rounded-full bg-foreground transition-all duration-300",
                isMobileMenuOpen && "-translate-y-[7px] -rotate-45"
              )}
            />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-[4900] bg-background/60 backdrop-blur-sm"
              onClick={closeMobileMenu}
            />

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="md:hidden fixed top-16 inset-x-4 z-[5000] rounded-2xl border border-border bg-background shadow-lg"
            >
              <div className="px-4 py-3 flex flex-col">
                {navItems.map((navItem, idx) => {
                  if (navItem.onClick) {
                    return (
                      <a
                        key={idx}
                        href={navItem.link}
                        onClick={(e) => {
                          navItem.onClick?.(e);
                          closeMobileMenu();
                        }}
                        className="py-3 text-sm text-foreground border-b border-border/60 last:border-b-0"
                      >
                        {navItem.name}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={idx}
                      to={navItem.link}
                      onClick={closeMobileMenu}
                      className="py-3 text-sm text-foreground border-b border-border/60 last:border-b-0"
                    >
                      {navItem.name}
                    </Link>
                  );
                })}

                {rightElement ? <div className="pt-3 mt-2 border-t border-border">{rightElement}</div> : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
