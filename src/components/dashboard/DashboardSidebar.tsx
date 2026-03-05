import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import usdpLogo from "@/assets/usdp-logo.png";

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const DashboardSidebar = ({ activeTab, setActiveTab }: DashboardSidebarProps) => {
  const navItems = [
    { id: "overview", icon: "ph:squares-four-bold", label: "Overview" },
    { id: "payments", icon: "ph:paper-plane-tilt-bold", label: "Payments" },
    { id: "yield", icon: "ph:trend-up-bold", label: "Yield Vaults" },
    { id: "governance", icon: "ph:hand-fist-bold", label: "Governance" },
    { id: "settings", icon: "ph:gear-six-bold", label: "Settings" },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/30 hidden lg:flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <img src={usdpLogo} alt="USDP" className="w-9 h-9 rounded-lg object-contain" />
          </div>
          <span className="font-display text-lg font-bold">USDP</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  activeTab === item.id
                    ? "bg-primary/10 text-foreground border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon icon={item.icon} className={cn(
                  "w-5 h-5",
                  activeTab === item.id ? "text-primary" : ""
                )} />
                {item.label}
                {activeTab === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Network Info */}
      <div className="p-4 border-t border-border">
        <div className="rounded-xl bg-secondary/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium">Base</span>
          </div>
          <p className="text-xs text-muted-foreground">Chain ID: 8453</p>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
