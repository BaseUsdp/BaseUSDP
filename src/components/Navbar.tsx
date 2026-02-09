import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import WalletConnectButton from "@/components/WalletConnectButton";
import void402Logo from "@/assets/void402-logo.png";

const Navbar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
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
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 py-4 px-6"
    >
      <div className="max-w-[1400px] mx-auto">
        {/* Glass pill container */}
        <div className={`flex h-14 items-center justify-between px-4 rounded-full transition-all duration-500 ${
          scrolled 
            ? "bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg" 
            : "bg-black/30 backdrop-blur-md border border-white/5"
        }`}>
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <img src={void402Logo} alt="Void402" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-base font-semibold text-white tracking-tight">Void<span className="text-primary">402</span></span>
          </Link>

          {/* Desktop Links - Centered */}
          <div className="hidden items-center gap-1 lg:flex absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link, index) => (
              <motion.a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="relative px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white rounded-full hover:bg-white/5"
              >
                {link.name}
              </motion.a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 lg:flex">
            <WalletConnectButton variant="navbar" />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                className="group gap-2 bg-primary text-white px-4 py-2 text-sm font-medium rounded-full hover:bg-primary/90"
                onClick={() => navigate("/dashboard")}
              >
                Dashboard
                <Icon icon="ph:arrow-right-bold" className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
          {isOpen ? (
              <Icon icon="ph:x-bold" className="h-5 w-5 text-white" />
            ) : (
              <Icon icon="ph:list-bold" className="h-5 w-5 text-white" />
            )}
          </button>
        </div>

      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-2 mx-auto max-w-[1400px] lg:hidden"
          >
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className="flex flex-col gap-2">
                {navLinks.map((link, index) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className="px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:text-white hover:bg-white/5 rounded-lg"
                  >
                    {link.name}
                  </motion.a>
                ))}
                <div className="pt-2 mt-2 border-t border-white/10 flex flex-col gap-3">
                  <WalletConnectButton variant="navbar" />
                  <Button 
                    className="w-full gap-2 bg-primary text-white rounded-full hover:bg-primary/90"
                    onClick={() => { setIsOpen(false); navigate("/dashboard"); }}
                  >
                    Dashboard
                    <Icon icon="ph:arrow-right-bold" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
