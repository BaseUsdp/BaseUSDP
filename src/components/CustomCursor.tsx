import { useEffect, useRef } from "react";

const CustomCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px)`;
    };

    const animate = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.transform = `translate(${ringX - 20}px, ${ringY - 20}px)`;
      requestAnimationFrame(animate);
    };

    const onEnterInteractive = () => {
      ring.style.width = "60px";
      ring.style.height = "60px";
      ring.style.marginLeft = "-10px";
      ring.style.marginTop = "-10px";
      dot.style.opacity = "0";
    };

    const onLeaveInteractive = () => {
      ring.style.width = "40px";
      ring.style.height = "40px";
      ring.style.marginLeft = "0";
      ring.style.marginTop = "0";
      dot.style.opacity = "1";
    };

    window.addEventListener("mousemove", onMove);
    animate();

    const interactives = document.querySelectorAll("a, button, [role='button']");
    interactives.forEach((el) => {
      el.addEventListener("mouseenter", onEnterInteractive);
      el.addEventListener("mouseleave", onLeaveInteractive);
    });

    return () => {
      window.removeEventListener("mousemove", onMove);
      interactives.forEach((el) => {
        el.removeEventListener("mouseenter", onEnterInteractive);
        el.removeEventListener("mouseleave", onLeaveInteractive);
      });
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-[10px] h-[10px] bg-foreground rounded-full pointer-events-none z-[9999] mix-blend-difference transition-opacity duration-150 hidden lg:block"
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-[40px] h-[40px] border border-foreground/40 rounded-full pointer-events-none z-[9998] hidden lg:block"
        style={{ transition: "width 0.25s ease, height 0.25s ease, margin 0.25s ease" }}
      />
    </>
  );
};

export default CustomCursor;
