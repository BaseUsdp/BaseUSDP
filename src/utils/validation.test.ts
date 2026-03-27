import { describe, it, expect } from "vitest";
import {
  isValidSolanaAddress,
  isValidBaseAddress,
  formatAddress,
  isValidAmount,
  isValidPaymentId,
  isValidTransactionSignature,
  getAddressError,
  getAmountError,
} from "./validation";

describe("isValidSolanaAddress", () => {
  it("accepts a valid 44-character base58 address", () => {
    expect(isValidSolanaAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(true);
  });

  it("accepts a valid 32-character base58 address", () => {
    expect(isValidSolanaAddress("11111111111111111111111111111111")).toBe(true);
  });

  it("rejects addresses with forbidden characters (0, O, I, l)", () => {
    expect(isValidSolanaAddress("0xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosg")).toBe(false);
    expect(isValidSolanaAddress("OxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosg")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSolanaAddress("")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isValidSolanaAddress(null as any)).toBe(false);
    expect(isValidSolanaAddress(undefined as any)).toBe(false);
  });

  it("rejects addresses that are too short", () => {
    expect(isValidSolanaAddress("abc")).toBe(false);
  });
});

describe("isValidBaseAddress", () => {
  it("accepts a valid checksummed Base address", () => {
    expect(isValidBaseAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe(true);
  });

  it("accepts a lowercase Base address", () => {
    expect(isValidBaseAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd18")).toBe(true);
  });

  it("rejects addresses without 0x prefix", () => {
    expect(isValidBaseAddress("742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe(false);
  });

  it("rejects addresses with wrong length", () => {
    expect(isValidBaseAddress("0x742d35")).toBe(false);
    expect(isValidBaseAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18ff")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidBaseAddress("0xZZZd35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe(false);
  });
});

describe("formatAddress", () => {
  it("truncates a long address with default params", () => {
    expect(formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe("0x74...bD18");
  });

  it("uses custom start and end lengths", () => {
    expect(formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", 6, 6)).toBe("0x742d...f2bD18");
  });

  it("returns full address if shorter than truncation", () => {
    expect(formatAddress("0x1234", 4, 4)).toBe("0x1234");
  });

  it("handles empty string", () => {
    expect(formatAddress("")).toBe("");
  });

  it("handles null", () => {
    expect(formatAddress(null as any)).toBe("");
  });
});

describe("isValidAmount", () => {
  it("accepts positive number", () => {
    expect(isValidAmount(100)).toBe(true);
  });

  it("accepts positive string", () => {
    expect(isValidAmount("0.001")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidAmount(0)).toBe(false);
  });

  it("rejects negative", () => {
    expect(isValidAmount(-5)).toBe(false);
  });

  it("rejects NaN string", () => {
    expect(isValidAmount("abc")).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(isValidAmount(Infinity)).toBe(false);
  });
});

describe("isValidPaymentId", () => {
  it("accepts x402-prefixed payment IDs", () => {
    expect(isValidPaymentId("x402_abc123def456")).toBe(true);
  });

  it("accepts long generic payment IDs", () => {
    expect(isValidPaymentId("abcd1234efgh5678")).toBe(true);
  });

  it("rejects short strings", () => {
    expect(isValidPaymentId("abc")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isValidPaymentId("")).toBe(false);
  });
});

describe("isValidTransactionSignature", () => {
  it("accepts EVM tx hash", () => {
    const hash = "0x" + "a".repeat(64);
    expect(isValidTransactionSignature(hash)).toBe(true);
  });

  it("rejects short EVM hash", () => {
    expect(isValidTransactionSignature("0xabc")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isValidTransactionSignature("")).toBe(false);
  });
});

describe("getAddressError", () => {
  it("returns null for valid Base address", () => {
    expect(getAddressError("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", "base")).toBeNull();
  });

  it("returns error for empty address", () => {
    expect(getAddressError("")).toBe("Address is required");
  });

  it("returns error for invalid Base address", () => {
    expect(getAddressError("0xinvalid", "base")).toContain("Invalid Base address");
  });
});

describe("getAmountError", () => {
  it("returns null for valid amount", () => {
    expect(getAmountError("100.50")).toBeNull();
  });

  it("returns error for empty amount", () => {
    expect(getAmountError("")).toBe("Amount is required");
  });

  it("returns error for non-numeric", () => {
    expect(getAmountError("abc")).toBe("Please enter a valid number");
  });

  it("returns error for zero", () => {
    expect(getAmountError("0")).toBe("Amount must be greater than 0");
  });

  it("returns error for negative amount", () => {
    expect(getAmountError("-5")).toBe("Amount must be greater than 0");
  });
});
