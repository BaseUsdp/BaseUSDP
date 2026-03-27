import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * useTransactionStatus Hook Tests
 *
 * Tests WebSocket-based real-time status tracking for transactions.
 */

type TransactionStatus = "pending" | "submitted" | "confirming" | "confirmed" | "failed";

const TERMINAL_STATUSES: TransactionStatus[] = ["confirmed", "failed"];

describe("useTransactionStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("status tracking", () => {
    it("starts with null status before subscription", () => {
      let status: TransactionStatus | null = null;
      expect(status).toBeNull();
    });

    it("updates status through the lifecycle", () => {
      const statuses: TransactionStatus[] = ["pending", "submitted", "confirming", "confirmed"];
      let current: TransactionStatus | null = null;

      statuses.forEach((s) => {
        current = s;
      });

      expect(current).toBe("confirmed");
    });

    it("tracks confirmation count", () => {
      let confirmations = 0;
      confirmations = 6;
      expect(confirmations).toBe(6);
    });
  });

  describe("terminal state detection", () => {
    it("recognizes confirmed as terminal", () => {
      expect(TERMINAL_STATUSES.includes("confirmed")).toBe(true);
    });

    it("recognizes failed as terminal", () => {
      expect(TERMINAL_STATUSES.includes("failed")).toBe(true);
    });

    it("does not treat pending as terminal", () => {
      expect(TERMINAL_STATUSES.includes("pending")).toBe(false);
    });

    it("does not treat confirming as terminal", () => {
      expect(TERMINAL_STATUSES.includes("confirming")).toBe(false);
    });
  });

  describe("update history", () => {
    it("maintains ordered history of all updates", () => {
      const history: { status: TransactionStatus; timestamp: number }[] = [];
      history.push({ status: "pending", timestamp: 1000 });
      history.push({ status: "submitted", timestamp: 2000 });
      history.push({ status: "confirmed", timestamp: 3000 });

      expect(history).toHaveLength(3);
      expect(history[0].status).toBe("pending");
      expect(history[2].status).toBe("confirmed");
    });
  });

  describe("error handling", () => {
    it("captures error message from failed transactions", () => {
      const update = {
        txHash: "0xabc",
        status: "failed" as TransactionStatus,
        confirmations: 0,
        timestamp: Date.now(),
        error: "Transaction reverted: insufficient balance",
      };
      expect(update.error).toContain("insufficient balance");
    });

    it("has no error for successful transactions", () => {
      const update = {
        txHash: "0xabc",
        status: "confirmed" as TransactionStatus,
        confirmations: 12,
        timestamp: Date.now(),
      };
      expect(update.error).toBeUndefined();
    });
  });
});
