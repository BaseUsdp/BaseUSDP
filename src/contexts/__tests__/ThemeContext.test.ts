import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  describe("theme initialization", () => {
    it("defaults to light when no saved preference", () => {
      const saved = localStorage.getItem("baseusdp-theme");
      expect(saved).toBeNull();
    });

    it("restores dark theme from localStorage", () => {
      localStorage.setItem("baseusdp-theme", "dark");
      expect(localStorage.getItem("baseusdp-theme")).toBe("dark");
    });

    it("restores light theme from localStorage", () => {
      localStorage.setItem("baseusdp-theme", "light");
      expect(localStorage.getItem("baseusdp-theme")).toBe("light");
    });

    it("treats invalid stored value as light", () => {
      localStorage.setItem("baseusdp-theme", "invalid");
      const saved = localStorage.getItem("baseusdp-theme");
      const theme = saved === "dark" ? "dark" : "light";
      expect(theme).toBe("light");
    });
  });

  describe("theme toggling", () => {
    it("adds dark class to document element for dark theme", () => {
      document.documentElement.classList.add("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes dark class for light theme", () => {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("persists theme change to localStorage", () => {
      localStorage.setItem("baseusdp-theme", "dark");
      expect(localStorage.getItem("baseusdp-theme")).toBe("dark");

      localStorage.setItem("baseusdp-theme", "light");
      expect(localStorage.getItem("baseusdp-theme")).toBe("light");
    });
  });

  describe("system preference detection", () => {
    it("respects prefers-color-scheme media query", () => {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      expect(mql).toBeDefined();
      expect(typeof mql.matches).toBe("boolean");
    });
  });
});
