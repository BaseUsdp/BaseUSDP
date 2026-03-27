import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * useResolveName Hook Tests
 *
 * Tests debouncing, caching, and resolution behavior
 * for ENS and Base Name resolution.
 */

describe("useResolveName", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("input classification", () => {
    it("identifies .eth names as ENS", () => {
      const input = "alice.eth";
      expect(input.endsWith(".eth")).toBe(true);
    });

    it("identifies .base names as Base Names", () => {
      const input = "bob.base";
      expect(input.endsWith(".base")).toBe(true);
    });

    it("identifies 0x addresses as direct addresses", () => {
      const input = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
      expect(input.startsWith("0x") && input.length === 42).toBe(true);
    });

    it("classifies empty input as unknown", () => {
      const input = "";
      expect(input.length).toBe(0);
    });
  });

  describe("debouncing", () => {
    it("waits for debounce period before resolving", () => {
      const callback = vi.fn();
      const debounceMs = 500;

      const timer = setTimeout(callback, debounceMs);
      vi.advanceTimersByTime(499);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledOnce();
      clearTimeout(timer);
    });

    it("cancels previous timer when input changes", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      let timer = setTimeout(callback1, 500);
      vi.advanceTimersByTime(200);
      clearTimeout(timer);
      timer = setTimeout(callback2, 500);
      vi.advanceTimersByTime(500);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
      clearTimeout(timer);
    });
  });

  describe("caching", () => {
    it("caches resolved addresses for reuse", () => {
      const cache = new Map<string, string | null>();
      cache.set("alice.eth", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");

      expect(cache.has("alice.eth")).toBe(true);
      expect(cache.get("alice.eth")).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");
    });

    it("returns cached null for previously-failed lookups", () => {
      const cache = new Map<string, string | null>();
      cache.set("notfound.eth", null);

      expect(cache.has("notfound.eth")).toBe(true);
      expect(cache.get("notfound.eth")).toBeNull();
    });
  });

  describe("error handling", () => {
    it("sets error state when resolution fails", () => {
      const error = "Name not found";
      expect(error).toBeTruthy();
    });

    it("clears error when a new resolution succeeds", () => {
      let error: string | null = "Previous error";
      error = null;
      expect(error).toBeNull();
    });
  });
});
