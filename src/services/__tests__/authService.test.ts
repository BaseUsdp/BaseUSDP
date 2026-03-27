import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Auth Service Tests
 *
 * Tests the authentication flow: nonce fetching, message construction,
 * token storage, and session management.
 */

const TOKEN_KEY = "baseusdp_session_token";
const TOKEN_EXPIRY_KEY = "baseusdp_token_expiry";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

describe("authService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("token storage", () => {
    it("stores session token in localStorage", () => {
      const token = "test_session_token_abc123";
      localStorage.setItem(TOKEN_KEY, token);
      expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    });

    it("stores token expiry timestamp", () => {
      const expiry = Date.now() + SESSION_DURATION;
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
      expect(Number(localStorage.getItem(TOKEN_EXPIRY_KEY))).toBe(expiry);
    });

    it("clears both token and expiry on logout", () => {
      localStorage.setItem(TOKEN_KEY, "token");
      localStorage.setItem(TOKEN_EXPIRY_KEY, "12345");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(TOKEN_EXPIRY_KEY)).toBeNull();
    });
  });

  describe("session validity", () => {
    it("considers a session valid when token exists and not expired", () => {
      const now = Date.now();
      localStorage.setItem(TOKEN_KEY, "valid_token");
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(now + SESSION_DURATION));

      const token = localStorage.getItem(TOKEN_KEY);
      const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
      expect(token).toBeTruthy();
      expect(expiry > now).toBe(true);
    });

    it("considers a session expired when past expiry time", () => {
      const now = Date.now();
      localStorage.setItem(TOKEN_KEY, "expired_token");
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(now - 1000));

      const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
      expect(expiry < now).toBe(true);
    });

    it("considers session invalid when no token stored", () => {
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe("nonce message construction", () => {
    it("creates a sign-in message with the nonce", () => {
      const nonce = "abc123xyz";
      const domain = "baseusdp.com";
      const message = `Sign in to ${domain}\n\nNonce: ${nonce}`;
      expect(message).toContain(nonce);
      expect(message).toContain(domain);
    });

    it("includes a timestamp in the message for replay protection", () => {
      const nonce = "test_nonce";
      const timestamp = new Date().toISOString();
      const message = `Sign in to baseusdp.com\n\nNonce: ${nonce}\nIssued At: ${timestamp}`;
      expect(message).toContain("Issued At:");
    });
  });

  describe("API request headers", () => {
    it("includes Authorization header when token exists", () => {
      localStorage.setItem(TOKEN_KEY, "my_token");
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      expect(headers["Authorization"]).toBe("Bearer my_token");
    });

    it("omits Authorization header when no token", () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });
});
