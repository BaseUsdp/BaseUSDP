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

  const navLinks = [
    { name: "About", href: "#about" },
    { name: "Problem", href: "#problem" },
    { name: "Solution", href: "#features" },
    { name: "Use Cases", href: "#use-cases" },
    { name: "Roadmap", href: "#roadmap" },
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
      <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
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
            Dashboard
          </motion.button>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <Icon icon={isOpen ? "ph:x-bold" : "ph:list-bold"} className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="px-8 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <WalletConnectButton variant="navbar" />
                <button
                  onClick={() => { setIsOpen(false); navigate("/dashboard"); }}
                  className="w-full text-sm border border-foreground bg-foreground text-background rounded-full px-5 py-2.5 font-normal"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
