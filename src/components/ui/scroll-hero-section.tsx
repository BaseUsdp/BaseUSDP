'use client';

import React from 'react';
import { Icon } from '@iconify/react';

interface ScrollHeroProps {
  items?: string[];
  prefix?: string;
  startVh?: number;
  spaceVh?: number;
}

export function ScrollHeroSection({
  items = ['encrypt.', 'shield.', 'transact.', 'verify.', 'protect.', 'scale.', 'pay.'],
  prefix = 'you can ',
  startVh = 50,
  spaceVh = 50,
}: ScrollHeroProps) {
  const navigate = useNavigate();

  return (
    <div className="word-hero">
      {/* Grid background */}
      <div className="word-hero-grid" />

      {/* Centered logo that fades on scroll */}
      <div className="word-hero-logo">
        <AltisLogo size={64} className="text-foreground" />
        <span className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          BASEUSDP
        </span>
      </div>

      <header
        className="word-hero-header"
        style={{ '--count': items.length, '--wh-start': `${startVh}vh`, '--wh-space': `${spaceVh}vh` } as React.CSSProperties}
      >
        {/* Sticky prefix */}
        <div className="word-hero-prefix">
          <h1 className="word-hero-title">
            <span className="sr-only">{prefix}{items[items.length - 1]}</span>
            <span aria-hidden="true">{prefix}</span>
          </h1>
        </div>

        {/* Scrolling word list */}
        <ul className="word-hero-list" aria-hidden="true">
          {items.map((word, i) => (
            <li key={i} className="word-hero-word">{word}</li>
          ))}
        </ul>
      </header>

      {/* Dark card section */}
      <div className="word-hero-main">
        <div className="word-hero-main-inner">
          <div className="word-hero-content">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-8"
              style={{ border: '1px solid hsl(0 0% 30%)', color: 'hsl(0 0% 60%)' }}
            >
              Privacy-First Protocol
            </span>
            <h2
              className="font-serif"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 'clamp(2.5rem, 8vw, 6rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                color: 'hsl(0 0% 100%)',
              }}
            >
              The Confidential
              <br />
              <em style={{ color: 'hsl(0 0% 50%)' }}>Payment Layer</em>
            </h2>
            <p className="mt-8 text-base leading-relaxed max-w-lg" style={{ color: 'hsl(0 0% 50%)' }}>
              Privacy-first payments for the Web 4.0 autonomous economy.
              Powered by ZK Proofs and the x402 protocol on Base L2.
            </p>

            {/* Stats + CTA bar */}
            <div className="w-full max-w-3xl mt-16 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-8" style={{ borderTop: '1px solid hsl(0 0% 20%)' }}>
              <div className="flex items-center gap-8">
                {[
                  { label: 'Protocol', value: 'x402' },
                  { label: 'Privacy', value: 'ZK Proofs' },
                  { label: 'Network', value: 'Base L2' },
                ].map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    {i > 0 && <div className="w-px h-8" style={{ background: 'hsl(0 0% 20%)' }} />}
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'hsl(0 0% 45%)' }}>{stat.label}</p>
                      <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 90%)' }}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'hsl(0 0% 100%)',
                    color: 'hsl(0 0% 0%)',
                  }}
                >
                  <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                  Dashboard
                </button>
                <a
                  href="#about"
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'hsl(0 0% 45%)' }}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span>Explore</span>
                  <Icon icon="ph:arrow-down" className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .word-hero {
          position: relative;
        }

        /* Subtle grid background */
        .word-hero-grid {
          --size: 45px;
          --line: hsl(0 0% 0% / 0.05);
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, var(--line) 1px, transparent 1px var(--size))
              calc(var(--size) * 0.36) 50% / var(--size) var(--size),
            linear-gradient(var(--line) 1px, transparent 1px var(--size))
              0% calc(var(--size) * 0.32) / var(--size) var(--size);
          mask: linear-gradient(-20deg, transparent 50%, white);
        }

        /* Logo — centered, fades out on scroll */
        .word-hero-logo {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 0;
          pointer-events: none;
          animation: logo-fade-out both linear;
          animation-timeline: scroll();
          animation-range: 0px 300px;
        }

        @keyframes logo-fade-out {
          from { opacity: 1; scale: 1; filter: blur(0px); }
          to   { opacity: 0; scale: 0.85; filter: blur(8px); }
        }

        /* Fallback for browsers without scroll-timeline */
        @supports not (animation-timeline: scroll()) {
          .word-hero-logo {
            animation: logo-fade-out-fallback 0.01s both;
            animation-delay: 0s;
          }
          @keyframes logo-fade-out-fallback {
            to { opacity: 0; }
          }
        }

        /* Header: sticky with negative offset to create scrollable word area */
        .word-hero-header {
          font-size: clamp(2.5rem, 8vw, 6rem);
          line-height: 1.2;
          position: sticky;
          top: calc((var(--count, 7) - 1) * -1lh);
          width: 100%;
          margin-bottom: var(--wh-space, 50vh);
          z-index: 1;
        }

        /* Prefix "you can " — stays sticky at viewport center */
        .word-hero-prefix {
          display: flex;
          width: 100%;
          align-items: start;
          justify-content: center;
          padding-top: calc(var(--wh-start, 50vh) - 0.5lh);
        }

        .word-hero-title {
          position: sticky;
          top: calc(var(--wh-start, 50vh) - 0.5lh);
          margin: 0;
          font-weight: 600;
          font-family: 'DM Serif Display', serif;
          color: hsl(0 0% 0%);
          letter-spacing: -0.03em;
        }

        /* Word list */
        .word-hero-list {
          font-weight: 600;
          list-style: none;
          padding: 0;
          margin: 0;
          font-family: 'DM Serif Display', serif;
          text-align: center;
          letter-spacing: -0.03em;
        }

        /* Each word: gradient text with fixed highlight band */
        .word-hero-word {
          --dimmed: hsl(0 0% 82%);
          --accent: hsl(0 0% 0%);
          background:
            linear-gradient(
              180deg,
              var(--dimmed) 0 calc(var(--wh-start, 50vh) - 0.55lh),
              var(--accent) calc(var(--wh-start, 50vh) - 0.6lh) calc(var(--wh-start, 50vh) + 0.6lh),
              var(--dimmed) calc(var(--wh-start, 50vh) + 0.55lh)
            );
          background-attachment: fixed;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
        }

        /* Dark card section — NOT min-height:100vh so page scrolls past */
        .word-hero-main {
          width: 100%;
          position: relative;
          z-index: 2;
        }

        .word-hero-main-inner {
          background: hsl(0 0% 5%);
          border-radius: 1.5rem 1.5rem 0 0;
        }

        .word-hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 1400px;
          margin: 0 auto;
          padding: 6rem 2rem;
        }

        /* Progressive enhancement: view-timeline entry animation */
        @supports (animation-timeline: view()) {
          .word-hero-main {
            view-timeline: --wh-section;
          }
          .word-hero-main-inner {
            transform-origin: 50% 100%;
            scale: 0.92;
            animation: wh-grow both ease-in-out;
            animation-timeline: --wh-section;
            animation-range: entry 50%;
          }
          @keyframes wh-grow {
            to { scale: 1; border-radius: 0; }
          }
        }
      `}</style>
    </div>
  );
}
