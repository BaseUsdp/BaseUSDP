import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { XMTPProvider } from "@/contexts/XMTPContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppSidebarNav from "@/components/AppSidebarNav";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import PaymentPage from "./pages/PaymentPage";
import X402Deposit from "./pages/X402Deposit";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import NotFound from "./pages/NotFound";
import MiniApp from "./miniapp/MiniApp";

const queryClient = new QueryClient();

// Pages that should NOT show the sidebar
const NO_SIDEBAR_ROUTES = ["/dashboard", "/miniapp"];

function AppRoutes() {
  const location = useLocation();
  const hideSidebar = NO_SIDEBAR_ROUTES.some((r) => location.pathname.startsWith(r));

  const routes = (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/pay/:id" element={<PaymentPage />} />
      <Route path="/x402-deposit" element={<X402Deposit />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/miniapp/*" element={<MiniApp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  if (hideSidebar) return routes;

  return <AppSidebarNav>{routes}</AppSidebarNav>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <WalletProvider>
          <XMTPProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </XMTPProvider>
        </WalletProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
