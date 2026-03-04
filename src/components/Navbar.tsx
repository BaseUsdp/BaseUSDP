import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";
import WalletConnectButton from "@/components/WalletConnectButton";
import AltisLogo from "@/components/AltisLogo";

const Navbar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const navLinks = [
    { name: "About USDP", href: "#about" },
    { name: "The Challenge", href: "#problem" },
    { name: "Our Solution", href: "#features" },
    { name: "Applications", href: "#use-cases" },
    { name: "Future Path", href: "#roadmap" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.getElementById(href.replace('#', ''));
    if (element) element.scrollIntoView({ behavior: 'smooth' });
    setIsOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : "bg-background/0"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <AltisLogo size={18} className="text-foreground" />
          <span className="text-sm font-semibold tracking-tighter text-foreground">BASEUSDP</span>
        </Link>

        <div className="hidden md:flex items-center gap-9 text-sm text-muted-foreground font-normal">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.name}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              className="nav-link-underline hover:text-foreground transition-colors"
            >
              {link.name}
            </motion.a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <WalletConnectButton variant="navbar" />
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate("/dashboard")}
            className="text-sm border border-border rounded-full px-5 py-2 text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-300 font-normal"
          >
            Launch Dashboard
          </motion.button>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur -mr-1"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <Icon icon={isOpen ? "ph:x-bold" : "ph:list-bold"} className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Slide-in sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 w-72 md:hidden bg-background border-r border-border shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-border">
                <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                  <AltisLogo size={18} className="text-foreground" />
                  <span className="text-sm font-semibold tracking-tighter text-foreground">BASEUSDP</span>
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close menu"
                >
                  <Icon icon="ph:x-bold" className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 py-3 px-3 rounded-lg transition-colors"
                  >
                    {link.name}
                  </a>
                ))}
              </nav>

              <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 border-t border-border flex flex-col gap-3">
                <WalletConnectButton variant="navbar" />
                <button
                  onClick={() => { setIsOpen(false); navigate("/dashboard"); }}
                  className="w-full text-sm border border-foreground bg-foreground text-background rounded-full px-5 py-3 font-medium active:scale-[0.98] transition-transform"
                >
                  Launch Dashboard
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
