"use client";

import { cn } from "@/lib/utils";
import { Link, LinkProps } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface SidebarLink {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebarNav = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarNav must be used within a SidebarNavProvider");
  }
  return context;
};

export const SidebarNavProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const SidebarNav = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarNavProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarNavProvider>
  );
};

export const SidebarNavBody = ({
  children,
  className,
  ...props
}: { children: React.ReactNode } & Omit<React.ComponentProps<typeof motion.div>, 'children'>) => {
  return (
    <>
      <DesktopSidebarNav className={className} {...props}>{children}</DesktopSidebarNav>
      <MobileSidebarNav>{children}</MobileSidebarNav>
    </>
  );
};

export const DesktopSidebarNav = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebarNav();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col flex-shrink-0 border-r border-border bg-card",
        className
      )}
      animate={{
        width: animate ? (open ? "220px" : "68px") : "220px",
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebarNav = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebarNav();
  return (
    <div
      className={cn(
        "h-14 flex flex-row md:hidden items-center justify-between bg-card border-b border-border w-full px-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center z-20">
        <Menu
          className="h-5 w-5 text-foreground cursor-pointer"
          onClick={() => setOpen(!open)}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed h-full w-full inset-0 bg-card z-[100] flex flex-col justify-between p-6"
            )}
          >
            <div
              className="absolute right-6 top-6 z-50 text-foreground cursor-pointer"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarNavLink = ({
  link,
  className,
}: {
  link: SidebarLink;
  className?: string;
}) => {
  const { open, animate } = useSidebarNav();

  // If link has onClick, use a button/anchor pattern
  if (link.onClick) {
    return (
      <a
        href={link.href}
        onClick={link.onClick}
        className={cn(
          "flex items-center gap-3 py-2.5 px-2 rounded-lg group/sidebar text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200",
          className
        )}
      >
        <span className="flex-shrink-0">{link.icon}</span>
        <motion.span
          animate={{
            display: animate ? (open ? "inline-block" : "none") : "inline-block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="text-sm whitespace-pre group-hover/sidebar:translate-x-0.5 transition-transform duration-150"
        >
          {link.label}
        </motion.span>
      </a>
    );
  }

  return (
    <Link
      to={link.href}
      className={cn(
        "flex items-center gap-3 py-2.5 px-2 rounded-lg group/sidebar text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200",
        className
      )}
    >
      <span className="flex-shrink-0">{link.icon}</span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm whitespace-pre group-hover/sidebar:translate-x-0.5 transition-transform duration-150"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
