"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import usdpLogo from "@/assets/usdp-logo.png";
import usdpLogoWhite from "@/assets/usdp-logo-white.png";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Shield, Lock, Fingerprint, Eye, KeyRound, FileKey,
  Cpu, Blocks, Wallet, CreditCard, Globe, Network,
  Zap, Code, Database, Server, Binary, Layers, ShieldCheck, Bot
} from "lucide-react";

// --- Types ---
export type AnimationPhase = "scatter" | "line" | "circle" | "bottom-strip";

const CARD_ICONS = [
  Shield, Lock, Fingerprint, Eye, KeyRound, FileKey,
  Cpu, Blocks, Wallet, CreditCard, Globe, Network,
  Zap, Code, Database, Server, Binary, Layers, ShieldCheck, Bot
];

interface FlipCardProps {
  src: string;
  gradientIndex: number;
  index: number;
  total: number;
  phase: AnimationPhase;
  target: { x: number; y: number; rotation: number; scale: number; opacity: number };
  morphProgress: number;
}

// --- FlipCard Component ---
const IMG_WIDTH = 60;
const IMG_HEIGHT = 85;

function FlipCard({ src, gradientIndex, index, total, phase, target, morphProgress }: FlipCardProps) {
  const IconComponent = CARD_ICONS[index % CARD_ICONS.length];
  const iconOpacity = Math.max(0.4, Math.min(1, 0.4 + (morphProgress * 0.6)));
  const gradientOpacity = Math.max(0, Math.min(1, (morphProgress - 0.2) / 0.5));
  const angle = (gradientIndex / total) * 360;
  const gradient = `linear-gradient(${angle}deg, hsl(270 80% 65%), hsl(320 80% 60%), hsl(30 90% 60%), hsl(50 95% 55%), hsl(80 90% 55%))`;
  return (
    <motion.div
      className="absolute"
      style={{
        width: IMG_WIDTH,
        height: IMG_HEIGHT,
        left: "50%",
        top: "50%",
        marginLeft: -IMG_WIDTH / 2,
        marginTop: -IMG_HEIGHT / 2,
        perspective: 800,
        zIndex: index,
      }}
      animate={{
        x: target.x,
        y: target.y,
        rotate: target.rotation,
        scale: target.scale,
        opacity: target.opacity,
      }}
      transition={{
        type: "spring",
        stiffness: 60,
        damping: 18,
        mass: 1,
      }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        whileHover={{ rotateY: 180 }}
        transition={{ duration: 0.6 }}
      >
        <div
          className="absolute inset-0 rounded-lg overflow-hidden shadow-lg flex items-center justify-center"
          style={{ backfaceVisibility: "hidden", background: 'hsl(0 0% 100%)' }}
        >
          {/* Gradient overlay that fades in */}
          <div
            className="absolute inset-0"
            style={{
              background: gradient,
              opacity: gradientOpacity,
              transition: 'opacity 0.5s ease',
            }}
          />
          <IconComponent
            size={24}
            strokeWidth={1.5}
            className="relative z-10"
            style={{
              color: gradientOpacity > 0.5 ? 'white' : 'hsl(0 0% 20%)',
              opacity: iconOpacity,
              transition: 'opacity 0.4s ease, color 0.5s ease',
              filter: gradientOpacity > 0.5 ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none',
            }}
          />
        </div>
        <div
          className="absolute inset-0 rounded-lg overflow-hidden shadow-lg flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "linear-gradient(135deg, hsl(var(--foreground)), hsl(var(--foreground) / 0.8))",
          }}
        >
          <div className="text-center p-2">
            <p className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--background))" }}>View</p>
            <p className="text-[7px] mt-0.5" style={{ color: "hsl(var(--background) / 0.6)" }}>Details</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Main Hero Component ---
const TOTAL_IMAGES = 20;
const DESKTOP_MAX_SCROLL = 3000;
const MOBILE_MAX_SCROLL = 520;
const MOBILE_TOUCH_SCROLL_MULTIPLIER = 10;
const MOBILE_TOUCH_DEADZONE = 2;
const MOBILE_MIN_FORWARD_DELTA = 18;
const MOBILE_REVERSE_DEADZONE = 8;
const MOBILE_REVERSE_DAMPING = 0.1;
const MOBILE_FLICK_BOOST_THRESHOLD = 18;
const MOBILE_COMPLETE_PROGRESS = 0.9;
const MOBILE_REENTER_INTENT_THRESHOLD = 16;

const CARD_COLORS = Array.from({ length: TOTAL_IMAGES }, (_, i) => i);

const IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&q=80",
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=300&q=80",
  "https://images.unsplash.com/photo-1563986768609-322da13575f2?w=300&q=80",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&q=80",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=300&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&q=80",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=300&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&q=80",
  "https://images.unsplash.com/photo-1560732488-6b0df240254a?w=300&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=80",
  "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=300&q=80",
  "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=300&q=80",
  "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=300&q=80",
  "https://images.unsplash.com/photo-1488229297570-58520851e868?w=300&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&q=80",
];

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

const isMobileInputMode = () =>
  window.innerWidth < 768 ||
  window.matchMedia("(pointer: coarse)").matches ||
  navigator.maxTouchPoints > 0;

const getMaxScroll = (isMobile: boolean) => (isMobile ? MOBILE_MAX_SCROLL : DESKTOP_MAX_SCROLL);

export default function ScrollMorphHero() {
  const { theme } = useTheme();
  const [introPhase, setIntroPhase] = useState<AnimationPhase>("circle");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [animationDone, setAnimationDone] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    setContainerSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateDeviceMode = () => {
      setIsMobileViewport(isMobileInputMode());
    };

    updateDeviceMode();
    window.addEventListener("resize", updateDeviceMode);

    return () => window.removeEventListener("resize", updateDeviceMode);
  }, []);

  // --- Virtual Scroll Logic ---
  const virtualScroll = useMotionValue(0);
  const scrollRef = useRef(0);
  const mobileAutoAnimating = useRef(false);
  const mobileAnimFrame = useRef<number | null>(null);

  // Mobile tap-to-animate: smoothly drives virtualScroll from current to max
  const startMobileAutoAnimate = () => {
    if (mobileAutoAnimating.current || animationDone) return;
    mobileAutoAnimating.current = true;
    const maxScroll = getMaxScroll(true);
    const duration = 1200; // ms
    const startVal = scrollRef.current;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const val = startVal + (maxScroll - startVal) * eased;
      scrollRef.current = val;
      virtualScroll.set(val);

      if (t < 1) {
        mobileAnimFrame.current = requestAnimationFrame(tick);
      } else {
        scrollRef.current = maxScroll;
        virtualScroll.set(maxScroll);
        setAnimationDone(true);
        mobileAutoAnimating.current = false;
      }
    };
    mobileAnimFrame.current = requestAnimationFrame(tick);
  };

  const stopMobileAutoAnimate = () => {
    if (mobileAnimFrame.current) {
      cancelAnimationFrame(mobileAnimFrame.current);
      mobileAnimFrame.current = null;
    }
    mobileAutoAnimating.current = false;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const finishIfNeeded = (nextScroll: number, maxScroll: number, isMobile: boolean) => {
      const completionPoint = isMobile ? maxScroll * MOBILE_COMPLETE_PROGRESS : maxScroll;
      if (nextScroll >= completionPoint) {
        scrollRef.current = maxScroll;
        virtualScroll.set(maxScroll);
        setAnimationDone(true);
      }
    };

    const canReenterAnimation = () => {
      const pageNearTop = window.scrollY <= 10;
      const heroNearTop = Math.abs(container.getBoundingClientRect().top) <= 64;
      return pageNearTop || heroNearTop;
    };

    const handleWheel = (e: WheelEvent) => {
      const isMobile = isMobileInputMode();
      const maxScroll = getMaxScroll(isMobile);

      if (animationDone) {
        if (e.deltaY > 0) return;
        if (!canReenterAnimation()) return;
        setAnimationDone(false);
        scrollRef.current = maxScroll;
        virtualScroll.set(maxScroll);
      }

      e.preventDefault();
      const newScroll = Math.min(Math.max(scrollRef.current + e.deltaY, 0), maxScroll);
      scrollRef.current = newScroll;
      virtualScroll.set(newScroll);
      finishIfNeeded(newScroll, maxScroll, isMobile);
    };

    // Mobile: first upward swipe triggers auto-animate, then page scrolls normally
    let touchStartY = 0;
    let mobileTriggered = false;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      mobileTriggered = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const isMobile = isMobileInputMode();

      // If animation is done on mobile, allow normal page scroll
      if (isMobile && animationDone) return;

      // If auto-animating, block scroll but don't process
      if (isMobile && mobileAutoAnimating.current) {
        e.preventDefault();
        return;
      }

      if (isMobile) {
        const touchY = e.touches[0].clientY;
        const rawDeltaY = touchStartY - touchY;

        // Upward swipe (finger moves up, positive delta) → trigger auto-animate
        if (rawDeltaY > 5 && !mobileTriggered && !animationDone) {
          mobileTriggered = true;
          e.preventDefault();
          startMobileAutoAnimate();
          return;
        }

        // During animation (not done yet), block normal scroll
        if (!animationDone) {
          e.preventDefault();
        }
        return;
      }

      // Desktop: unchanged scroll behavior
      const maxScroll = getMaxScroll(false);
      const touchY = e.touches[0].clientY;
      const rawDeltaY = touchStartY - touchY;
      touchStartY = touchY;

      let adjustedDeltaY = rawDeltaY;

      if (animationDone) {
        if (adjustedDeltaY > 0) return;
        if (!canReenterAnimation()) return;
        setAnimationDone(false);
        scrollRef.current = maxScroll;
        virtualScroll.set(maxScroll);
      }

      e.preventDefault();
      const newScroll = Math.min(Math.max(scrollRef.current + adjustedDeltaY, 0), maxScroll);
      scrollRef.current = newScroll;
      virtualScroll.set(newScroll);
      finishIfNeeded(newScroll, maxScroll, false);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      stopMobileAutoAnimate();
    };
  }, [virtualScroll, animationDone]);

  const maxScrollForViewport = getMaxScroll(isMobileViewport);
  const morphEnd = isMobileViewport ? 260 : 600;
  const morphProgress = useTransform(virtualScroll, [0, morphEnd], [0, 1]);
  const smoothMorph = useSpring(morphProgress, { stiffness: 40, damping: 20 });

  const scrollRotate = useTransform(virtualScroll, [morphEnd, maxScrollForViewport], [0, 360]);
  const smoothScrollRotate = useSpring(scrollRotate, { stiffness: 40, damping: 20 });

  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normalizedX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseX.set(normalizedX * 100);
    };
    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX]);

  // Start directly in circle phase, no scatter/line intro

  const scatterPositions = useMemo(() => {
    return CARD_COLORS.map(() => ({
      x: (Math.random() - 0.5) * 1500,
      y: (Math.random() - 0.5) * 1000,
      rotation: (Math.random() - 0.5) * 180,
      scale: 0.6,
      opacity: 0,
    }));
  }, []);

  const [morphValue, setMorphValue] = useState(0);
  const [rotateValue, setRotateValue] = useState(0);
  const [parallaxValue, setParallaxValue] = useState(0);

  useEffect(() => {
    const u1 = smoothMorph.on("change", setMorphValue);
    const u2 = smoothScrollRotate.on("change", setRotateValue);
    const u3 = smoothMouseX.on("change", setParallaxValue);
    return () => { u1(); u2(); u3(); };
  }, [smoothMorph, smoothScrollRotate, smoothMouseX]);

  // Content fades in as arc forms
  const contentOpacity = useTransform(smoothMorph, [0.7, 1], [0, 1]);
  const contentY = useTransform(smoothMorph, [0.7, 1], [30, 0]);
  // Intro text fades out as morph starts
  const introTextOpacity = useTransform(smoothMorph, [0, 0.25], [1, 0]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background" style={{ zIndex: 1 }}>
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center"
        style={{ touchAction: animationDone ? "auto" : "none" }}
      >

        {/* Intro Text — shows during circle phase, changes to "Institutional Privacy" */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none gap-1 sm:gap-3"
          animate={{ opacity: introPhase === "circle" ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.img
            src={theme === "dark" ? usdpLogoWhite : usdpLogo}
            alt="USDP"
            className="pointer-events-none max-w-[30%] sm:max-w-[clamp(120px,30vw,320px)]"
            style={{
              width: 'clamp(60px, 18vw, 320px)',
              height: 'auto',
              objectFit: 'contain',
              opacity: introTextOpacity as any,
            }}
          />
          <motion.p
            className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em]"
            style={{ opacity: introTextOpacity as any }}
          >
            Scroll to enter
          </motion.p>
        </motion.div>

        {/* Arc Active Content — centered, fades in when arc forms */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-8"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          <span
            className="inline-block text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-6"
            style={{ border: '1px solid hsl(0 0% 30%)', color: 'hsl(0 0% 50%)' }}
          >
            The Core Protocol
          </span>
          <h2
            className="font-serif text-center"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(2rem, 6vw, 4.5rem)',
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: 'hsl(var(--foreground))',
            }}
          >
            Confidentiality
            <br />
             <em
               className="not-italic"
               style={{
                 background: 'linear-gradient(135deg, hsl(270 80% 65%), hsl(320 80% 60%), hsl(30 90% 60%), hsl(50 95% 55%), hsl(80 90% 55%))',
                 WebkitBackgroundClip: 'text',
                 WebkitTextFillColor: 'transparent',
                 backgroundClip: 'text',
                 paddingBottom: '0.15em',
                 paddingRight: '0.08em',
                 lineHeight: 1.3,
               }}
             >by Design</em>
          </h2>
           <p className="mt-6 text-sm leading-relaxed max-w-md text-center text-muted-foreground">
             At the heart of USDP is a protocol engineered for the new internet. We combine Zero-Knowledge cryptography with the x402 payment standard to deliver a truly confidential transaction layer for the autonomous economy on Base.
           </p>
           <div className="pointer-events-auto mt-8 relative group">
             <div
               className="absolute -inset-[1.5px] rounded-full opacity-80 group-hover:opacity-100 transition-opacity duration-300 blur-[1px]"
               style={{
                 background: 'linear-gradient(135deg, hsl(270 80% 65%), hsl(320 80% 60%), hsl(30 90% 60%), hsl(50 95% 55%), hsl(80 90% 55%))',
               }}
             />
             <a
               href="/dashboard"
               className="relative inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold tracking-wide bg-background text-foreground transition-all duration-300 hover:shadow-[0_0_25px_-5px_hsl(270_80%_65%_/_0.5)]"
             >
               Start Now
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
             </a>
           </div>
         </motion.div>

        {/* Cards Container */}
        <div className="absolute inset-0 flex items-center justify-center">
          {CARD_COLORS.map((colorIndex, i) => {
            let target = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };

            if (introPhase === "scatter") {
              target = scatterPositions[i];
            } else if (introPhase === "line") {
              const lineSpacing = 70;
              const lineTotalWidth = TOTAL_IMAGES * lineSpacing;
              const lineX = i * lineSpacing - lineTotalWidth / 2;
              target = { x: lineX, y: 0, rotation: 0, scale: 1, opacity: 1 };
            } else {
              const isMobile = isMobileViewport;
              const minDimension = Math.min(containerSize.width, containerSize.height);
              const circleRadius = Math.min(minDimension * 0.35, 350);
              const circleAngle = (i / TOTAL_IMAGES) * 360;
              const circleRad = (circleAngle * Math.PI) / 180;
              const circlePos = {
                x: Math.cos(circleRad) * circleRadius,
                y: Math.sin(circleRad) * circleRadius,
                rotation: circleAngle + 90,
              };

              const baseRadius = Math.min(containerSize.width, containerSize.height * 1.5);
              const arcRadius = baseRadius * (isMobile ? 1.4 : 1.1);
              const arcApexY = containerSize.height * (isMobile ? 0.35 : 0.25);
              const arcCenterY = arcApexY + arcRadius;
              const spreadAngle = isMobile ? 100 : 130;
              const startAngle = -90 - spreadAngle / 2;
              const step = spreadAngle / (TOTAL_IMAGES - 1);

              const scrollProgress = Math.min(Math.max(rotateValue / 360, 0), 1);
              const maxRotation = spreadAngle * 0.8;
              const boundedRotation = -scrollProgress * maxRotation;
              const currentArcAngle = startAngle + i * step + boundedRotation;
              const arcRad = (currentArcAngle * Math.PI) / 180;

              const arcPos = {
                x: Math.cos(arcRad) * arcRadius + parallaxValue,
                y: Math.sin(arcRad) * arcRadius + arcCenterY,
                rotation: currentArcAngle + 90,
                scale: isMobile ? 1.4 : 1.8,
              };

              target = {
                x: lerp(circlePos.x, arcPos.x, morphValue),
                y: lerp(circlePos.y, arcPos.y, morphValue),
                rotation: lerp(circlePos.rotation, arcPos.rotation, morphValue),
                scale: lerp(1, arcPos.scale, morphValue),
                opacity: 1,
              };
            }

            return (
              <FlipCard key={i} src={IMAGES[i]} gradientIndex={colorIndex} index={i} total={TOTAL_IMAGES} phase={introPhase} target={target} morphProgress={morphValue} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
