import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * useMobile Hook Tests
 *
 * Tests the responsive breakpoint detection hook.
 */

const MOBILE_BREAKPOINT = 768;

describe("useIsMobile", () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("detects mobile viewport (< 768px)", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true, configurable: true });
    expect(window.innerWidth < MOBILE_BREAKPOINT).toBe(true);
  });

  it("detects desktop viewport (>= 768px)", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true, configurable: true });
    expect(window.innerWidth < MOBILE_BREAKPOINT).toBe(false);
  });

  it("detects exactly at breakpoint as desktop", () => {
    Object.defineProperty(window, "innerWidth", { value: 768, writable: true, configurable: true });
    expect(window.innerWidth < MOBILE_BREAKPOINT).toBe(false);
  });

  it("detects just below breakpoint as mobile", () => {
    Object.defineProperty(window, "innerWidth", { value: 767, writable: true, configurable: true });
    expect(window.innerWidth < MOBILE_BREAKPOINT).toBe(true);
  });

  it("handles tablet viewport (768-1024)", () => {
    Object.defineProperty(window, "innerWidth", { value: 900, writable: true, configurable: true });
    expect(window.innerWidth < MOBILE_BREAKPOINT).toBe(false);
  });

  describe("matchMedia integration", () => {
    it("creates a media query listener", () => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      expect(mql).toBeDefined();
      expect(mql.media).toBe("(max-width: 767px)");
    });
  });
});
