import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";
import { ScrollHeroSection } from "@/components/ui/scroll-hero-section";
import { DotPattern } from "@/components/ui/dot-pattern";

const ProblemSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const risks = [
    {
      num: "01",
      title: "Competitive Risk",
      description: "Exposing financial strategies and trading patterns to competitors",
      year: "Ongoing",
    },
    {
      num: "02",
      title: "Privacy Breach",
      description: "Client data transparency visible to competitors and public",
      year: "Critical",
    },
    {
      num: "03",
      title: "Institutional Adoption",
      description: "Blocked by transparency requirements of public blockchains",
      year: "Barrier",
    },
  ];

  const riskMetrics = [
    { label: "Tx Visibility", value: 100 },
    { label: "Data Exposure", value: 87 },
    { label: "Pattern Leakage", value: 94 },
    { label: "Competitive Risk", value: 85 },
    { label: "Privacy Breach", value: 92 },
    { label: "Institutional Adoption", value: 78 },
  ];

  return (
    <section id="problem">
      {/* Word-cycling scroll intro for the problem section */}
      <ScrollHeroSection
        items={['Exposed.', 'Tracked.', 'Leaked.', 'Exploited.', 'Vulnerable.', 'Transparent.', 'Broken.']}
        prefix="Your Data Is "
        startVh={50}
        spaceVh={50}
      />

      {/* Problem content continues below the scroll animation */}
      <div ref={ref} className="relative border-t border-border overflow-hidden">
        

        <div className="relative max-w-[1400px] mx-auto px-8 py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <span className="tag-pill">The Challenge</span>
          </motion.div>

          <div className="grid md:grid-cols-12 gap-10 mb-16">
            <motion.div
              className="md:col-span-6"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <h2 className="display-section font-serif text-foreground">
                The Blockchain{" "}
                <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Confidentiality</em> Crisis
              </h2>
            </motion.div>
            <motion.div
              className="md:col-span-4 md:col-start-9 flex flex-col justify-end"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <p className="text-base text-muted-foreground leading-relaxed">
                Public blockchains expose everything by default. In the Web4 era, this transparency is a critical dealbreaker for institutions, AI agents, and any entity that values strategic privacy.
              </p>
            </motion.div>
          </div>

          {/* Experience-row style risks */}
          <div className="divide-y divide-border">
            {risks.map((risk, i) => (
              <motion.div
                key={risk.title}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="exp-row py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-6 flex-1">
                  <span className="tag-pill shrink-0">{risk.num}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{risk.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-md">{risk.description}</p>
                  </div>
                </div>
                <p className="font-serif text-3xl md:text-5xl tracking-tight text-muted-foreground/30 group-hover:text-foreground transition-colors duration-300 shrink-0" style={{ letterSpacing: "-0.03em" }}>
                  {risk.year}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Risk metrics */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 rounded-3xl border border-border p-8 bg-background"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-sm font-medium text-foreground">Risk Dashboard</div>
                <div className="text-xs text-muted-foreground">Real-time exposure analysis</div>
              </div>
              <span className="tag-pill">critical</span>
            </div>
            <div className="space-y-4">
              {riskMetrics.map((item, i) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-mono text-foreground">{item.value}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={isInView ? { width: `${item.value}%` } : {}}
                      transition={{ duration: 1, delay: 0.6 + i * 0.1 }}
                      className="h-full rounded-full"
                      style={{
                        background: i % 3 === 0
                          ? 'hsl(var(--beam-orange))'
                          : i % 3 === 1
                          ? 'hsl(var(--beam-magenta))'
                          : 'hsl(var(--beam-violet))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Case study */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Real-World Case Study</div>
              <h4 className="text-foreground font-medium mb-3">BlackRock × JP Morgan TCN</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                BlackRock used JP Morgan Chase's Tokenized Collateral Network (TCN) to tokenize shares in a money market fund. This transaction used a <span className="text-foreground underline decoration-dotted underline-offset-2">private blockchain</span>— demonstrating the critical need for confidentiality in institutional finance.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
