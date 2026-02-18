import { useEffect } from "react";
import { toast } from "sonner";
import HeroSection from "@/components/HeroSection";
import LogoStrip from "@/components/LogoStrip";
import AboutSection from "@/components/AboutSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import FeaturesSection from "@/components/FeaturesSection";
import UseCasesSection from "@/components/UseCasesSection";
import TechStackSection from "@/components/TechStackSection";
import RoadmapSection from "@/components/RoadmapSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  useEffect(() => {
    const disconnectMessage = sessionStorage.getItem("baseusdp_disconnect_message");
    if (disconnectMessage) {
      sessionStorage.removeItem("baseusdp_disconnect_message");
      toast.info("Wallet Disconnected", {
        description: disconnectMessage,
        duration: 4000,
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main>
        <HeroSection />
        <LogoStrip />
        <AboutSection />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <UseCasesSection />
        <TechStackSection />
        <RoadmapSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
