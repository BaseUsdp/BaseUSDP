'use client';

import React from 'react';
import { useNavigate } from 'react-router-dom';
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
          <video
            className="word-hero-video-bg"
            src="/hero-bg-new.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="word-hero-content">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-8"
              style={{ border: '1px solid hsl(0 0% 70%)', color: 'hsl(0 0% 10%)' }}
            >
              Web4 Ready · Agentic Economy Optimized
            </span>
            <h2
              className="font-serif"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 'clamp(2.5rem, 8vw, 6rem)',
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                color: 'hsl(0 0% 0%)',
              }}
            >
              The Private Agentic
              <br />
              <em className="not-italic" style={{ background: 'linear-gradient(135deg, hsl(270 80% 65%), hsl(320 80% 60%), hsl(30 90% 60%), hsl(50 95% 55%), hsl(80 90% 55%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', paddingBottom: '0.15em', paddingRight: '0.08em', lineHeight: 1.3 }}>Wallet for Web4</em>
            </h2>
            <p className="mt-8 text-base leading-relaxed max-w-lg" style={{ color: 'hsl(0 0% 20%)' }}>
              USDP pioneers the confidential infrastructure for the Web4 agentic economy. Our ZK-powered platform empowers institutions, developers, and AI agents to transact on Base with unparalleled privacy, ushering in an era of secure, autonomous commerce.
            </p>

            {/* Stats + CTA bar */}
            <div className="w-full max-w-3xl mt-16 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pt-8" style={{ borderTop: '1px solid hsl(0 0% 70%)' }}>
              <div className="flex items-center gap-8">
                {[
                  { label: 'x402 Payments', value: 'Autonomous Exchange' },
                  { label: 'ZK Privacy', value: 'Guaranteed' },
                  { label: 'Base L2', value: 'High-Speed Settlement' },
                ].map((stat, i) => (
                  <div key={stat.label} className="flex items-center gap-8">
                     {i > 0 && <div className="w-px h-8" style={{ background: 'hsl(0 0% 70%)' }} />}
                     <div>
                       <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'hsl(0 0% 30%)' }}>{stat.label}</p>
                       <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 0%)' }}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 hover:scale-[1.02]"
                  style={{
                     background: 'hsl(0 0% 0%)',
                     color: 'hsl(0 0% 100%)',
                  }}
                >
                  <Icon icon="ph:arrow-right-bold" className="w-4 h-4" />
                  Launch Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .word-hero {
          position: relative;
        }

        /* Global dot background - behind all content */
        .word-hero-grid {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image: radial-gradient(circle, hsl(0 0% 0% / 0.10) 1.2px, transparent 1.2px);
          background-size: 20px 20px;
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
          line-height: 1.15;
          position: sticky;
          top: calc((var(--count, 7) - 1) * -1lh);
          width: 100%;
          margin-bottom: var(--wh-space, 50vh);
          z-index: 1;
          overflow: visible;
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
          overflow: visible;
        }

        /* Each word: gradient text with fixed highlight band */
        .word-hero-word {
          --dimmed: hsl(0 0% 82%);
          padding: 0.05em 0;
          background:
            linear-gradient(
              180deg,
              var(--dimmed) 0 calc(var(--wh-start, 50vh) - 0.55lh),
              hsl(270 80% 65%) calc(var(--wh-start, 50vh) - 0.6lh),
              hsl(320 80% 60%) calc(var(--wh-start, 50vh) - 0.1lh),
              hsl(30 90% 60%) calc(var(--wh-start, 50vh) + 0.1lh),
              hsl(50 95% 55%) calc(var(--wh-start, 50vh) + 0.4lh),
              hsl(80 90% 55%) calc(var(--wh-start, 50vh) + 0.6lh),
              var(--dimmed) calc(var(--wh-start, 50vh) + 0.55lh)
            );
          background-attachment: fixed;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
        }

        /* Dark card section — NOT min-height:100vh so page scrolls past */
        .word-hero-main {
          width: 100%;
          position: relative;
          z-index: 2;
        }

        .word-hero-main-inner {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem 1.5rem 0 0;
        }

        .word-hero-main-inner::before {
          content: '';
          position: absolute;
          inset: 0;
           background: hsl(0 0% 100% / 0.1);
           backdrop-filter: blur(12px);
          z-index: 1;
        }

        .word-hero-video-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .word-hero-content {
          position: relative;
          z-index: 2;
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
