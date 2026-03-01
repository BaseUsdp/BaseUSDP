/**
 * Bottom Navigation Bar for Mini App
 * 4 tabs: Home, Send, History, Settings
 * Uses Lucide icons, matches ORB402 dark theme
 */

import { useLocation, useNavigate } from "react-router-dom";
import { Home, Send, Clock, ArrowDownToLine, Settings } from "lucide-react";

const NAV_ITEMS = [
  { path: "/miniapp", label: "Home", icon: Home },
  { path: "/miniapp/send", label: "Send", icon: Send },
  { path: "/miniapp/deposit", label: "Deposit", icon: ArrowDownToLine },
  { path: "/miniapp/history", label: "History", icon: Clock },
  { path: "/miniapp/settings", label: "Settings", icon: Settings },
] as const;

export function MiniAppNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center justify-around px-2 py-2 border-t border-zinc-800/50 bg-[#0a0a0a]">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive =
          path === "/miniapp"
            ? location.pathname === "/miniapp" || location.pathname === "/miniapp/"
            : location.pathname.startsWith(path);

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive
                ? "text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
