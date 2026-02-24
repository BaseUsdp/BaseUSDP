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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
         <Link to="/" className="flex items-center gap-2 group">
           <motion.div
             animate={{
               rotate: scrolled ? 360 : 0,
               scale: scrolled ? [1, 1.2, 1] : 1,
             }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="relative"
           >
             <AltisLogo size={18} className="text-foreground relative z-10" />
             <motion.div
               className="absolute inset-0 rounded-full blur-md"
               animate={{
                 opacity: scrolled ? [0, 0.6, 0] : 0,
                 scale: scrolled ? [1, 2, 1.5] : 1,
               }}
               transition={{ duration: 1, ease: "easeOut" }}
               style={{
                 background: 'linear-gradient(135deg, hsl(270 80% 65%), hsl(320 80% 60%), hsl(50 95% 55%))',
               }}
             />
           </motion.div>
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
          className="md:hidden p-2 -mr-2 relative w-8 h-8 flex flex-col items-center justify-center gap-[5px]"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-[2px] bg-foreground rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-5 h-[2px] bg-foreground rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-[2px] bg-foreground rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-14 bg-background/60 backdrop-blur-sm md:hidden z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-x-0 top-14 md:hidden bg-background border-b border-border z-50"
            >
              <div className="px-6 py-4 flex flex-col">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-3 border-b border-border/50 last:border-0"
                  >
                    {link.name}
                  </a>
                ))}
                <div className="pt-4 mt-2 flex flex-col gap-3">
                  <WalletConnectButton variant="navbar" />
                  <button
                    onClick={() => { setIsOpen(false); navigate("/dashboard"); }}
                    className="w-full text-sm border border-foreground bg-foreground text-background rounded-full px-5 py-3 font-medium active:scale-[0.98] transition-transform"
                  >
                    Launch Dashboard
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
