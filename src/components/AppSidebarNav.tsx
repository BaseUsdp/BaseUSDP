import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Shield,
  AlertTriangle,
  Lightbulb,
  Briefcase,
  Map,
  HelpCircle,
  Wallet,
  ExternalLink,
} from "lucide-react";
import {
  SidebarNav,
  SidebarNavBody,
  SidebarNavLink,
  useSidebarNav,
} from "@/components/ui/sidebar-nav";
import AltisLogo from "@/components/AltisLogo";
import WalletConnectButton from "@/components/WalletConnectButton";

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
};

const sectionLinks = [
  { label: "About", href: "#about", sectionId: "about", icon: <Shield className="h-4 w-4 flex-shrink-0" /> },
  { label: "Problem", href: "#problem", sectionId: "problem", icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" /> },
  { label: "Solution", href: "#features", sectionId: "features", icon: <Lightbulb className="h-4 w-4 flex-shrink-0" /> },
  { label: "Use Cases", href: "#use-cases", sectionId: "use-cases", icon: <Briefcase className="h-4 w-4 flex-shrink-0" /> },
  { label: "Roadmap", href: "#roadmap", sectionId: "roadmap", icon: <Map className="h-4 w-4 flex-shrink-0" /> },
  { label: "FAQ", href: "#faq", sectionId: "faq", icon: <HelpCircle className="h-4 w-4 flex-shrink-0" /> },
];

function SidebarContent() {
  const { open } = useSidebarNav();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const navLinks = sectionLinks.map((link) => ({
    label: link.label,
    href: link.href,
    icon: link.icon,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isHome) {
        navigate("/");
        setTimeout(() => scrollToSection(link.sectionId), 300);
      } else {
        scrollToSection(link.sectionId);
      }
    },
  }));

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col gap-1">
        {/* Logo */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          className="flex items-center gap-2 px-2 py-3 mb-4"
        >
          <AltisLogo size={20} className="text-foreground flex-shrink-0" />
          <motion.span
            animate={{ opacity: open ? 1 : 0, display: open ? "inline" : "none" }}
            className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap"
          >
            BASEUSDP
          </motion.span>
        </a>

        {/* Section Links */}
        <div className="flex flex-col gap-0.5">
          {navLinks.map((link) => (
            <SidebarNavLink key={link.label} link={link} />
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-border" />

        {/* Dashboard link */}
        <SidebarNavLink
          link={{
            label: "Dashboard",
            href: "/dashboard",
            icon: <LayoutDashboard className="h-4 w-4 flex-shrink-0" />,
          }}
        />
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 mt-4">
        <motion.div
          animate={{ opacity: open ? 1 : 0, height: open ? "auto" : 0 }}
          className="overflow-hidden"
        >
          <WalletConnectButton variant="navbar" />
        </motion.div>
        {!open && (
          <div className="flex justify-center">
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppSidebarNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SidebarNav open={open} setOpen={setOpen} animate={true}>
      <div className="flex flex-col md:flex-row min-h-screen w-full bg-background">
        <SidebarNavBody>
          <SidebarContent />
        </SidebarNavBody>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SidebarNav>
  );
}
