import { ScrollHeroSection } from "@/components/ui/scroll-hero-section";

const HeroSection = () => {
  return (
    <section className="relative bg-background">
      <ScrollHeroSection
        items={['encrypt.', 'shield.', 'transact.', 'verify.', 'protect.', 'scale.', 'pay.']}
        prefix="you can "
        startVh={50}
        spaceVh={50}
      />
    </section>
  );
};

export default HeroSection;
