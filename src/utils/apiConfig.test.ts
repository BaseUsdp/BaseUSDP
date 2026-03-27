import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("apiConfig", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
  });

  it("returns empty string in production for same-origin API", async () => {
    Object.assign(import.meta.env, { PROD: true, VITE_API_URL: undefined });
    const { getApiUrl } = await import("./apiConfig");
    expect(getApiUrl()).toBe("");
  });

  it("returns localhost in development when no env override", async () => {
    Object.assign(import.meta.env, { PROD: false, DEV: true, VITE_API_URL: undefined });
    const { getApiUrl } = await import("./apiConfig");
    expect(getApiUrl()).toBe("http://localhost:3000");
  });

  it("uses VITE_API_URL when explicitly set", async () => {
    Object.assign(import.meta.env, { PROD: false, DEV: true, VITE_API_URL: "http://custom:4000" });
    const { getApiUrl } = await import("./apiConfig");
    expect(getApiUrl()).toBe("http://custom:4000");
  });

  it("ignores old Vercel URL in production to force same-origin", async () => {
    Object.assign(import.meta.env, {
      PROD: true,
      VITE_API_URL: "https://baseusdp.vercel.app/api",
    });
    const { getApiUrl } = await import("./apiConfig");
    expect(getApiUrl()).toBe("");
  });

  describe("getApiEndpoint", () => {
    it("appends endpoint to base URL", async () => {
      Object.assign(import.meta.env, { PROD: false, DEV: true, VITE_API_URL: "http://localhost:3000" });
      const { getApiEndpoint } = await import("./apiConfig");
      expect(getApiEndpoint("/api/auth/nonce")).toBe("http://localhost:3000/api/auth/nonce");
    });

    it("strips leading slash to avoid double slash", async () => {
      Object.assign(import.meta.env, { PROD: true, VITE_API_URL: undefined });
      const { getApiEndpoint } = await import("./apiConfig");
      expect(getApiEndpoint("/api/auth/nonce")).toBe("/api/auth/nonce");
    });

    it("works with no leading slash", async () => {
      Object.assign(import.meta.env, { PROD: true, VITE_API_URL: undefined });
      const { getApiEndpoint } = await import("./apiConfig");
      expect(getApiEndpoint("api/auth/nonce")).toBe("/api/auth/nonce");
    });
  });
});
