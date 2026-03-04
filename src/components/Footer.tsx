import { Link } from "react-router-dom";
import { useState } from "react";
import usdpLogoWhite from "@/assets/usdp-logo-white.png";
import { Icon } from "@iconify/react";

const Footer = () => {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const footerLinks = {
    Platform: [
      { name: "Dashboard", href: "/dashboard", isRoute: true },
      { name: "Technology", href: "#features" },
      { name: "Applications", href: "#use-cases" },
      { name: "Future Path", href: "#roadmap" },
    ],
    Company: [
      { name: "About USDP", href: "#about" },
    ],
    Legal: [
      { name: "Privacy Policy", href: "/privacy-policy", isRoute: true },
      { name: "Terms of Service", href: "/terms-and-conditions", isRoute: true },
    ],
  };

  const socialLinks = [
     { name: "Twitter", href: "https://x.com/BaseUSDP", icon: "simple-icons:twitter" },
     { name: "GitHub", href: "https://github.com/ORB402/ORB402", icon: "simple-icons:github" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.getElementById(href.replace('#', ''));
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-foreground text-background border-t border-background/10">
      <div className="max-w-[1400px] mx-auto px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tighter text-background mb-4">
            <img src={usdpLogoWhite} alt="USDP" className="w-5 h-5 object-contain" />
            <span>USDP</span>
          </Link>
          <p className="text-sm text-background/40 leading-relaxed max-w-xs">
            The Private Agentic Wallet for Web4.
            Autonomous by design. Invisible by default.
          </p>
          <div className="flex items-center gap-3 mt-6">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              >
                <Icon icon={social.icon} className="w-4 h-4 text-background" />
              </a>
            ))}
          </div>
        </div>

        {Object.entries(footerLinks).map(([category, links]) => (
          <div key={category}>
            <p className="text-xs font-semibold text-background/30 uppercase tracking-wider mb-5">{category}</p>
            <ul className="space-y-3">
              {links.map((link) => (
                <li key={link.name}>
                  {'isRoute' in link && link.isRoute ? (
                    <Link
                      to={link.href}
                      className="text-sm text-background/50 hover:text-background transition-colors"
                    >
                      {link.name}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="text-sm text-background/50 hover:text-background transition-colors"
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

      <div className="max-w-[1400px] mx-auto px-8 pb-8 border-t border-background/10 pt-7 flex items-center justify-between">
        <p className="text-xs text-background/30">© 2026 USDP. All rights reserved.</p>
        <p className="text-xs text-background/30">Designed with intent.</p>
      </div>
    </footer>
  );
};

export default Footer;
