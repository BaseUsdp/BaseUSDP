import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Icon } from "@iconify/react";

const WhitepaperSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const PDF_HREF = "/BASEUSDP-Whitepaper.pdf";

  const layers = [
    {
      icon: "ph:cube-bold",
      label: "01",
      title: "Settlement",
      body: "Base L2 with native USDC and a small suite of audited Solidity contracts. No proprietary token, no rebasing wrapper.",
      color: "var(--beam-cyan)",
    },
    {
      icon: "ph:shield-check-bold",
      label: "02",
      title: "Privacy",
      body: "An FHE-encrypted token for confidential balances and a ZK shielded pool for unlinkable transfers. Three privacy levels per transaction.",
      color: "var(--beam-violet)",
    },
    {
      icon: "ph:graph-bold",
      label: "03",
      title: "Channels",
      body: "Direct, x402, SMS, Farcaster, Twitter, and an AI Terminal, all five surfaces settle against the same pool with the same guarantees.",
      color: "var(--beam-green)",
    },
  ];

  const channels = [
    { icon: "ph:wallet-bold", label: "Direct", desc: "Wallet or @username" },
    { icon: "ph:globe-bold", label: "x402", desc: "HTTP 402 for browsers and agents" },
    { icon: "ph:device-mobile-bold", label: "SMS", desc: "Any phone, offline-capable" },
    { icon: "ph:broadcast-bold", label: "Farcaster", desc: "Mini App + @baseusdp bot" },
    { icon: "ph:chat-circle-bold", label: "Twitter / X", desc: "Tweet or DM the bot" },
  ];

  const privacyModes = [
    {
      name: "Public",
      number: "01",
      amount: "Visible",
      parties: "Visible",
      desc: "Default ERC-20 transfer. Cheapest gas, no privacy.",
    },
    {
      name: "Partial",
      number: "02",
      amount: "Hidden",
      parties: "Visible",
      desc: "B2B settlement, relationships are known, amounts are sensitive.",
    },
    {
      name: "Full",
      number: "03",
      amount: "Hidden",
      parties: "Hidden",
      desc: "Retail and agent payments. The entire transaction is unlinkable.",
    },
  ];

  const chapters = [
    "Privacy primitives, FHE & ZK proofs",
    "The smart contract suite",
    "x402 HTTP-native payments",
    "SMS & offline payment layer",
    "Autonomous agents & ERC-8004 identity",
    "Security model and trust assumptions",
    "Regulatory and compliance layer",
    "Roadmap through V4",
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
          <span className="tag-pill">Technical Brief</span>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h2 className="display-section font-serif text-foreground">
              What's in the{" "}
              <em
                className="gradient-text"
                style={{
                  background: "var(--gradient-beam)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                whitepaper
              </em>
            </h2>
          </motion.div>
          <motion.div
            className="md:col-span-4 md:col-start-9 flex flex-col justify-end gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <motion.a
                href={PDF_HREF}
                download="BASEUSDP-Whitepaper.pdf"
                className="flex items-center gap-3 bg-foreground text-background rounded-full px-6 py-3.5 text-sm font-semibold hover:bg-foreground/90 transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon icon="ph:download-simple-bold" className="w-4 h-4" />
                Download PDF
                <span className="text-background/50 text-xs font-mono">717 KB</span>
              </motion.a>
              <a
                href={PDF_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View online
                <Icon icon="ph:arrow-up-right-bold" className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              A digest of how BASEUSDP turns Base into a private settlement
              layer for humans, AI agents, and the open web.
            </p>
          </motion.div>
        </div>

        {/* Abstract — large quoted opening paragraph */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="max-w-4xl mb-24"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Abstract
          </p>
          <p className="text-xl md:text-2xl font-serif text-foreground/90 leading-relaxed">
            BASEUSDP combines an{" "}
            <span className="text-foreground font-medium">
              FHE-encrypted USDC token
            </span>
            , a{" "}
            <span className="text-foreground font-medium">
              zero-knowledge privacy pool
            </span>
            , an{" "}
            <span className="text-foreground font-medium">x402 facilitator</span>
            , and an{" "}
            <span className="text-foreground font-medium">
              ERC-8004 agent identity layer
            </span>{" "}
            into a single product that lets humans and autonomous agents move
            USDC privately across wallets, phone numbers, social handles, and
            HTTP endpoints, all settling on Base.
          </p>
        </motion.div>

        {/* Three layers */}
        <div className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              The system in three layers
            </p>
            <span className="text-xs font-mono text-muted-foreground/50">
              §2 · Architecture
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {layers.map((l, i) => (
              <motion.div
                key={l.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.5,
                  delay: 0.5 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group relative border border-border rounded-2xl p-7 hover:border-foreground/30 transition-colors duration-300"
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{
                      backgroundColor: `hsl(${l.color} / 0.12)`,
                      color: `hsl(${l.color})`,
                    }}
                  >
                    <Icon icon={l.icon} className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/40">
                    {l.label}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 tracking-tight">
                  {l.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {l.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Five channels — small grid */}
        <div className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Five ways to address a recipient
            </p>
            <span className="text-xs font-mono text-muted-foreground/50">
              §5 · Channels
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {channels.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.4,
                  delay: 0.7 + i * 0.06,
                }}
                className="border border-border rounded-xl p-5 hover:bg-secondary/40 transition-colors duration-300"
              >
                <Icon
                  icon={c.icon}
                  className="w-5 h-5 mb-3 text-foreground/80"
                />
                <p className="text-sm font-semibold text-foreground mb-1">
                  {c.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {c.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Privacy modes — three-column comparison */}
        <div className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Privacy in three modes
            </p>
            <span className="text-xs font-mono text-muted-foreground/50">
              §3 · Privacy
            </span>
          </div>
          <div className="grid md:grid-cols-3 border border-border rounded-2xl overflow-hidden">
            {privacyModes.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                className={`p-8 ${
                  i > 0 ? "md:border-l border-t md:border-t-0 border-border" : ""
                } ${i === 2 ? "bg-secondary/30" : ""}`}
              >
                <div className="flex items-baseline gap-3 mb-5">
                  <h4 className="text-2xl font-semibold text-foreground tracking-tight">
                    {m.name}
                  </h4>
                  <span className="text-xs font-mono text-muted-foreground/50">
                    {m.number}
                  </span>
                </div>
                <div className="space-y-2 mb-4 pb-4 border-b border-border/60">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Amount</span>
                    <span
                      className={
                        m.amount === "Hidden"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {m.amount}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Counterparties</span>
                    <span
                      className={
                        m.parties === "Hidden"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {m.parties}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {m.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trust quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="border-l-2 pl-6 mb-24 max-w-3xl"
          style={{ borderColor: "hsl(var(--beam-green))" }}
        >
          <p className="text-xl md:text-2xl font-serif text-foreground italic leading-relaxed mb-3">
            "Funds are always controlled by the smart contract. The relay is
            a delivery mechanism, not a custodian. Every off-chain seam has a
            permissionless escape hatch."
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            §12 Trust Model
          </p>
        </motion.div>

        {/* Chapter list + CTA */}
        <div className="grid md:grid-cols-12 gap-10 pt-10 border-t border-border">
          <div className="md:col-span-7">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-5">
              Inside the full document
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {chapters.map((c, i) => (
                <motion.li
                  key={c}
                  initial={{ opacity: 0, x: -8 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 1 + i * 0.04 }}
                  className="flex items-start gap-2.5 text-sm text-foreground/85"
                >
                  <Icon
                    icon="ph:arrow-right-bold"
                    className="w-3.5 h-3.5 mt-1 shrink-0 text-muted-foreground/60"
                  />
                  <span>{c}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 md:col-start-9 flex flex-col justify-end">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-5">
              Document details
            </p>
            <div className="grid grid-cols-3 gap-0 border-y border-border">
              <div className="py-5 pr-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Version
                </p>
                <p className="text-xl font-semibold text-foreground">2.0</p>
              </div>
              <div className="py-5 px-3 border-l border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Pages
                </p>
                <p className="text-xl font-semibold text-foreground">22</p>
              </div>
              <div className="py-5 pl-3 border-l border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Released
                </p>
                <p className="text-xl font-semibold text-foreground">May '26</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhitepaperSection;
