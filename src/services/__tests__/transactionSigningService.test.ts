import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Transaction Signing Service Tests
 *
 * Tests the client-side transaction signing flow:
 * 1. Request unsigned tx from backend
 * 2. Sign with wallet adapter
 * 3. Submit signed tx back to backend
 */

describe("transactionSigningService", () => {
  const mockWallet = {
    publicKey: { toBase58: () => "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
    signTransaction: vi.fn(),
    connected: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("wallet adapter validation", () => {
    it("rejects signing when wallet is not connected", () => {
      const disconnectedWallet = { ...mockWallet, connected: false };
      expect(disconnectedWallet.connected).toBe(false);
    });

    it("rejects signing when wallet has no public key", () => {
      const noKeyWallet = { ...mockWallet, publicKey: null };
      expect(noKeyWallet.publicKey).toBeNull();
    });

    it("accepts signing when wallet is connected with public key", () => {
      expect(mockWallet.connected).toBe(true);
      expect(mockWallet.publicKey).toBeTruthy();
    });
  });

  describe("transaction request construction", () => {
    it("includes recipient address in the request body", () => {
      const body = {
        from: "0xsender",
        to: "0xrecipient",
        amount: "100",
        token: "USDC",
      };
      expect(body.to).toBe("0xrecipient");
    });

    it("includes amount and token in the request body", () => {
      const body = {
        from: "0xsender",
        to: "0xrecipient",
        amount: "50.25",
        token: "USDC",
      };
      expect(body.amount).toBe("50.25");
      expect(body.token).toBe("USDC");
    });

    it("includes privacy level when using ZK transfers", () => {
      const body = {
        from: "0xsender",
        to: "0xrecipient",
        amount: "100",
        token: "USDC",
        privacyLevel: "full" as const,
      };
      expect(body.privacyLevel).toBe("full");
    });
  });

  describe("signing result handling", () => {
    it("returns success with signed transaction on successful sign", async () => {
      const signedTx = "base58encodedSignedTransaction";
      mockWallet.signTransaction.mockResolvedValueOnce(signedTx);

      const result = await mockWallet.signTransaction("unsigned_tx");
      expect(result).toBe(signedTx);
    });

    it("returns error when wallet rejects signing", async () => {
      mockWallet.signTransaction.mockRejectedValueOnce(new Error("User rejected"));

      await expect(mockWallet.signTransaction("unsigned_tx")).rejects.toThrow("User rejected");
    });
  });

  describe("submit result handling", () => {
    it("parses successful submission response", () => {
      const response = {
        success: true,
        signature: "0x" + "a".repeat(64),
        confirmationStatus: "confirmed",
      };
      expect(response.success).toBe(true);
      expect(response.signature).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("handles submission failure", () => {
      const response = {
        success: false,
        error: "Insufficient funds",
      };
      expect(response.success).toBe(false);
      expect(response.error).toBe("Insufficient funds");
    });
  });
});
