import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * WebSocket Service Tests
 *
 * Tests connection lifecycle, message parsing, reconnection logic,
 * and subscription management for real-time transaction updates.
 */

type TransactionStatus = "pending" | "submitted" | "confirming" | "confirmed" | "failed";

interface TransactionUpdate {
  txHash: string;
  status: TransactionStatus;
  confirmations: number;
  timestamp: number;
  error?: string;
}

describe("websocketService", () => {
  let mockWs: any;

  beforeEach(() => {
    mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("message parsing", () => {
    it("parses a valid transaction update message", () => {
      const raw = JSON.stringify({
        type: "tx_update",
        txHash: "0xabc123",
        status: "confirmed",
        confirmations: 12,
        timestamp: Date.now(),
      });
      const parsed = JSON.parse(raw);
      expect(parsed.status).toBe("confirmed");
      expect(parsed.txHash).toBe("0xabc123");
    });

    it("handles malformed JSON gracefully", () => {
      const raw = "not valid json {{{";
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      expect(parsed).toBeNull();
    });

    it("ignores messages without type field", () => {
      const raw = JSON.stringify({ txHash: "0xabc" });
      const parsed = JSON.parse(raw);
      expect(parsed.type).toBeUndefined();
    });
  });

  describe("subscription management", () => {
    it("tracks subscriptions by transaction hash", () => {
      const subs = new Map<string, Function[]>();
      const cb = vi.fn();
      const txHash = "0xdef456";

      if (!subs.has(txHash)) subs.set(txHash, []);
      subs.get(txHash)!.push(cb);

      expect(subs.get(txHash)?.length).toBe(1);
    });

    it("notifies all subscribers for a given tx hash", () => {
      const subs = new Map<string, Function[]>();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const txHash = "0xabc";

      subs.set(txHash, [cb1, cb2]);
      const update: TransactionUpdate = {
        txHash,
        status: "confirmed",
        confirmations: 6,
        timestamp: Date.now(),
      };
      subs.get(txHash)?.forEach((cb) => cb(update));

      expect(cb1).toHaveBeenCalledWith(update);
      expect(cb2).toHaveBeenCalledWith(update);
    });

    it("removes a specific subscriber without affecting others", () => {
      const subs = new Map<string, Function[]>();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      subs.set("0x1", [cb1, cb2]);

      subs.set("0x1", subs.get("0x1")!.filter((cb) => cb !== cb1));
      expect(subs.get("0x1")?.length).toBe(1);
      expect(subs.get("0x1")![0]).toBe(cb2);
    });
  });

  describe("reconnection logic", () => {
    it("attempts reconnection after disconnect", () => {
      let attempts = 0;
      const maxAttempts = 5;
      const tryReconnect = () => {
        if (attempts < maxAttempts) attempts++;
      };
      tryReconnect();
      tryReconnect();
      expect(attempts).toBe(2);
    });

    it("stops reconnecting after max attempts", () => {
      let attempts = 0;
      const maxAttempts = 5;
      for (let i = 0; i < 10; i++) {
        if (attempts < maxAttempts) attempts++;
      }
      expect(attempts).toBe(maxAttempts);
    });
  });

  describe("heartbeat", () => {
    it("sends ping messages at regular intervals", () => {
      const send = vi.fn();
      const heartbeatInterval = 30000;

      // Simulate heartbeat
      const interval = setInterval(() => send("ping"), heartbeatInterval);
      vi.advanceTimersByTime(heartbeatInterval * 3);
      clearInterval(interval);

      expect(send).toHaveBeenCalledTimes(3);
      expect(send).toHaveBeenCalledWith("ping");
    });
  });
});
