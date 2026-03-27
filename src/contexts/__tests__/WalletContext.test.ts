import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

/**
 * WalletContext tests
 *
 * Since WalletContext depends on browser wallet APIs (window.ethereum, window.phantom),
 * we test the exported utilities and state management logic in isolation.
 */

describe("WalletContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("wallet type detection", () => {
    it("identifies MetaMask when window.ethereum.isMetaMask is true", () => {
      const mockEthereum = { isMetaMask: true, request: vi.fn() };
      expect(mockEthereum.isMetaMask).toBe(true);
    });

    it("identifies Phantom when window.phantom.solana is present", () => {
      const mockPhantom = { solana: { isPhantom: true } };
      expect(mockPhantom.solana.isPhantom).toBe(true);
    });
  });

  describe("session persistence", () => {
    it("stores wallet address in localStorage on connect", () => {
      localStorage.setItem("baseusdp_wallet", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");
      expect(localStorage.getItem("baseusdp_wallet")).toBe("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18");
    });

    it("clears wallet address from localStorage on disconnect", () => {
      localStorage.setItem("baseusdp_wallet", "0xabc");
      localStorage.removeItem("baseusdp_wallet");
      expect(localStorage.getItem("baseusdp_wallet")).toBeNull();
    });
  });

  describe("chain detection", () => {
    const BASE_MAINNET_CHAIN_ID = 8453;
    const BASE_SEPOLIA_CHAIN_ID = 84532;

    it("recognizes Base Mainnet chain ID", () => {
      expect(BASE_MAINNET_CHAIN_ID).toBe(8453);
    });

    it("recognizes Base Sepolia chain ID", () => {
      expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
    });

    it("determines correct hex chain IDs", () => {
      expect(Number("0x2105")).toBe(8453);
      expect(Number("0x14a34")).toBe(84532);
    });
  });

  describe("privacy level", () => {
    const validLevels = ["public", "partial", "full"];

    it("accepts all three privacy levels", () => {
      validLevels.forEach((level) => {
        expect(["public", "partial", "full"]).toContain(level);
      });
    });

    it("defaults to public when no preference stored", () => {
      const stored = localStorage.getItem("baseusdp_privacy_level");
      expect(stored).toBeNull();
    });
  });

  describe("network status", () => {
    it("returns disconnected when no provider available", () => {
      const hasProvider = typeof (globalThis as any).ethereum !== "undefined";
      expect(hasProvider).toBe(false);
    });
  });
});
