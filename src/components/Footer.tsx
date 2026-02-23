import { Link } from "react-router-dom";
import void402Logo from "@/assets/void402-logo.png";

const Footer = () => {
  const footerLinks = {
    Product: [
      { name: "Dashboard", href: "/dashboard", isRoute: true },
      { name: "Technology", href: "#features" },
      { name: "Use Cases", href: "#use-cases" },
      { name: "Roadmap", href: "#roadmap" },
      { name: "About", href: "#about" },
    ],
    Legal: [
      { name: "Privacy Policy", href: "/privacy-policy", isRoute: true },
      { name: "Terms and Conditions", href: "/terms-and-conditions", isRoute: true },
    ],
  };

  const socialLinks = [
    {
      name: "Twitter",
      href: "https://x.com/orb402",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: "GitHub",
      href: "https://github.com/ORB402/ORB402",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      )
    },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.replace('#', '');
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="relative bg-[#020202] border-t border-white/10">
      {/* Diagonal Stripes Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            rgba(255, 255, 255, 0.01) 40px,
            rgba(255, 255, 255, 0.01) 41px
          )`,
        }}
      />

      {/* Social Links Bar */}
      <div className="relative border-b border-white/10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-center gap-8">
            {socialLinks.map((social) => (
              <a 
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/50 hover:text-primary transition-colors"
              >
                {social.icon}
                <span className="text-sm font-medium">{social.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Links Grid */}
      <div className="container relative mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white/40 font-medium text-xs uppercase tracking-wider mb-6">{category}</h4>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.name}>
                    {'isRoute' in link && link.isRoute ? (
                      <Link 
                        to={link.href} 
                        className="text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.name}
                      </Link>
                    ) : (
                      <a 
                        href={link.href}
                        onClick={(e) => handleNavClick(e, link.href)}
                        className="text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 pt-8 border-t border-white/10">
          {/* Logo & Description */}
          <div className="max-w-md">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center">
                <img src={void402Logo} alt="ORB402" className="h-8 w-8 object-contain" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">ORB<span className="text-primary">402</span>.</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              The Confidential Payment Layer for the Agentic Economy. 
              Privacy-first transactions powered by ZK Proofs and x402.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-xs text-white/30">© 2026 ORB402 Protocol. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
