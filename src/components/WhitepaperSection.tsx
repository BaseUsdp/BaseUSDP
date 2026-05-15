import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";

const WhitepaperSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const PDF_HREF = "/BASEUSDP-Whitepaper.pdf";

  const stats = [
    { label: "Version", value: "2.0" },
    { label: "Pages", value: "22" },
    { label: "Released", value: "May 2026" },
    { label: "Sections", value: "15" },
  ];

  const contents = [
    "Privacy primitives — FHE & ZK proofs",
    "The smart contract suite",
    "x402 HTTP-native payments",
    "SMS & offline payment layer",
    "Autonomous agents & ERC-8004 identity",
    "Security model and trust assumptions",
  ];

  return (
    <section
      ref={ref}
      id="whitepaper"
      className="bg-background border-t border-border"
    >
      <div className="max-w-[1400px] mx-auto px-8 py-28">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <span className="tag-pill">Technical Whitepaper</span>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h2 className="display-section font-serif text-foreground">
              Read the full{" "}
              <em
                className="gradient-text"
                style={{
                  background: "var(--gradient-beam)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                technical spec
              </em>
            </h2>
          </motion.div>
          <motion.div
            className="md:col-span-4 md:col-start-9 flex items-end"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <p className="text-base text-muted-foreground leading-relaxed">
              The complete project whitepaper — how BASEUSDP turns Base into a
              private settlement layer for humans, AI agents, and the open web.
            </p>
          </motion.div>
        </div>

        {/* Two-column body: left = copy/CTAs, right = cover mock */}
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          {/* LEFT — contents & CTAs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-7 flex flex-col"
          >
            {/* Stat strip */}
            <div className="grid grid-cols-4 border-y border-border mb-10">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`py-6 px-2 ${
                    i > 0 ? "border-l border-border" : ""
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {s.label}
                  </p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* What's inside */}
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-5">
              What's inside
            </p>
            <ul className="space-y-3 mb-10">
              {contents.map((c, i) => (
                <motion.li
                  key={c}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                  className="flex items-start gap-3 text-sm text-foreground/90"
                >
                  <Icon
                    icon="ph:check-circle-fill"
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: "hsl(var(--beam-green))" }}
                  />
                  <span>{c}</span>
                </motion.li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-auto">
              <motion.a
                href={PDF_HREF}
                download="BASEUSDP-Whitepaper.pdf"
                className="flex items-center justify-center gap-3 bg-foreground text-background rounded-full px-7 py-4 text-sm font-semibold hover:bg-foreground/90 transition-all duration-300 group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon
                  icon="ph:download-simple-bold"
                  className="w-4 h-4"
                />
                Download PDF
                <span className="text-background/50 text-xs font-mono">
                  714 KB
                </span>
              </motion.a>

              <a
                href={PDF_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 rounded-full border border-border px-7 py-4 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4" />
                View online
              </a>
            </div>
          </motion.div>

          {/* RIGHT — styled cover mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="lg:col-span-5"
          >
            <a
              href={PDF_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
              aria-label="Open BASEUSDP whitepaper"
            >
              <div className="whitepaper-cover relative bg-[#0a0a0a] text-white rounded-2xl overflow-hidden shadow-2xl aspect-[3/4] transition-transform duration-500 group-hover:-translate-y-1">
                {/* Green left rail */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00d27a]" />

                {/* Top black band */}
                <div className="relative px-8 pt-8 pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.18em]">
                        BASEUSDP
                      </p>
                      <p className="text-[9px] text-white/50 mt-1">
                        baseusdp.com
                      </p>
                    </div>
                    <span className="text-[8.5px] font-bold tracking-[0.18em] text-[#00d27a] bg-[#1f2937] px-2.5 py-1 rounded-full">
                      CONFIDENTIAL
                    </span>
                  </div>
                </div>

                {/* Green bar separator */}
                <div className="h-[3px] bg-[#00d27a]" />

                {/* Title block */}
                <div className="px-8 pt-10 pb-6">
                  <p className="text-[10px] font-bold tracking-[0.18em] text-[#00d27a] mb-3">
                    PROJECT WHITEPAPER · v2.0
                  </p>
                  <h3
                    className="font-bold text-white leading-[1.05] tracking-tight"
                    style={{ fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)" }}
                  >
                    Confidential
                    <br />
                    USDC for the
                    <br />
                    AI Economy.
                  </h3>
                  <p className="mt-4 text-[11px] text-white/60 leading-relaxed">
                    How BASEUSDP turns Base into a private settlement layer
                    for humans, AI agents, and the open web.
                  </p>
                </div>

                {/* Meta strip */}
                <div className="mx-8 mt-6 grid grid-cols-4 border-y border-white/10">
                  {stats.map((s, i) => (
                    <div
                      key={s.label}
                      className={`py-3 ${
                        i > 0 ? "border-l border-white/10" : ""
                      }`}
                    >
                      <p className="text-[7px] font-bold tracking-[0.18em] text-white/40">
                        {s.label.toUpperCase()}
                      </p>
                      <p className="text-[12px] font-bold text-white mt-1">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Abstract preview */}
                <div className="px-8 mt-5">
                  <p className="text-[9px] font-bold tracking-[0.18em] text-[#00d27a] mb-2">
                    ABSTRACT
                  </p>
                  <p className="text-[9.5px] text-white/55 leading-relaxed line-clamp-5">
                    BASEUSDP is a privacy-first payments platform built on
                    Base. It combines an FHE-encrypted USDC token, a
                    zero-knowledge privacy pool, an x402 facilitator, an
                    ERC-8004 agent identity layer, and a bounded SMS relay
                    into one product that lets humans and autonomous agents
                    move USDC privately to any wallet, phone number,
                    Farcaster handle, or HTTP endpoint.
                  </p>
                </div>

                {/* Bottom black band */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-8 py-3 flex justify-between items-center">
                  <p className="text-[8px] text-white/40">
                    BASEUSDP · Confidential · May 2026
                  </p>
                  <p className="text-[8px] font-bold text-[#00d27a]">
                    baseusdp.com
                  </p>
                </div>

                {/* Hover hint overlay */}
                <div className="absolute inset-0 flex items-end justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <span className="flex items-center gap-2 bg-white text-black text-xs font-semibold rounded-full px-3 py-1.5 shadow-lg">
                    <Icon icon="ph:arrow-up-right-bold" className="w-3 h-3" />
                    Open PDF
                  </span>
                </div>
              </div>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhitepaperSection;
