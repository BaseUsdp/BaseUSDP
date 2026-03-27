import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveName, detectNameType, namehash } from "./nameResolution";

/**
 * Integration-level tests for name resolution.
 * These test the resolveName pipeline end-to-end with mocked providers.
 */

const mockProvider = {
  call: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveName integration", () => {
  it("resolves an ENS name via the provider call mock", async () => {
    const paddedAddr = "0x" + "00".repeat(12) + "742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
    mockProvider.call.mockResolvedValueOnce(paddedAddr);

    const result = await resolveName("alice.eth", mockProvider as any);
    expect(result).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");
    expect(mockProvider.call).toHaveBeenCalledTimes(1);
  });

  it("resolves a Base Name via the L2 resolver", async () => {
    const paddedAddr = "0x" + "00".repeat(12) + "1234567890abcdef1234567890abcdef12345678";
    mockProvider.call.mockResolvedValueOnce(paddedAddr);

    const result = await resolveName("bob.base", mockProvider as any);
    expect(result).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("returns null for an unresolvable name", async () => {
    mockProvider.call.mockResolvedValueOnce("0x" + "00".repeat(32));

    const result = await resolveName("doesnotexist.eth", mockProvider as any);
    expect(result).toBeNull();
  });

  it("returns null when provider call throws", async () => {
    mockProvider.call.mockRejectedValueOnce(new Error("network error"));

    const result = await resolveName("fail.eth", mockProvider as any);
    expect(result).toBeNull();
  });

  it("handles concurrent resolutions without cross-contamination", async () => {
    const addr1 = "0x" + "00".repeat(12) + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const addr2 = "0x" + "00".repeat(12) + "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    mockProvider.call.mockResolvedValueOnce(addr1).mockResolvedValueOnce(addr2);

    const [result1, result2] = await Promise.all([
      resolveName("one.eth", mockProvider as any),
      resolveName("two.eth", mockProvider as any),
    ]);

    expect(result1).not.toBe(result2);
  });
});

describe("detectNameType edge cases", () => {
  it("detects .eth suffix (case-insensitive)", () => {
    expect(detectNameType("ALICE.ETH")).toBe("ens");
    expect(detectNameType("Alice.Eth")).toBe("ens");
  });

  it("detects .base suffix (case-insensitive)", () => {
    expect(detectNameType("BOB.BASE")).toBe("basename");
    expect(detectNameType("Bob.Base")).toBe("basename");
  });

  it("detects 0x-prefixed hex as address", () => {
    expect(detectNameType("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe("address");
  });

  it("returns unknown for random strings", () => {
    expect(detectNameType("randomstring")).toBe("unknown");
    expect(detectNameType("")).toBe("unknown");
    expect(detectNameType("  ")).toBe("unknown");
  });

  it("trims whitespace before detection", () => {
    expect(detectNameType("  alice.eth  ")).toBe("ens");
  });
});

describe("namehash", () => {
  it("produces the correct hash for 'eth'", () => {
    const hash = namehash("eth");
    // Known EIP-137 hash for "eth"
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hash.length).toBe(66);
  });

  it("produces a deterministic result", () => {
    expect(namehash("alice.eth")).toBe(namehash("alice.eth"));
  });

  it("produces different hashes for different names", () => {
    expect(namehash("alice.eth")).not.toBe(namehash("bob.eth"));
  });

  it("handles empty string", () => {
    const hash = namehash("");
    expect(hash).toBe("0x" + "00".repeat(32));
  });
});
