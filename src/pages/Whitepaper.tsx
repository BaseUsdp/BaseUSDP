import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import AltisLogo from "@/components/AltisLogo";
import WhitepaperSection from "@/components/WhitepaperSection";

const Whitepaper = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <AltisLogo size={28} className="text-foreground" />
            <span className="text-xl font-bold text-foreground tracking-tight">
              BASEUSDP
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main>
        <WhitepaperSection />
      </main>

      <Footer />
    </div>
  );
};

export default Whitepaper;
