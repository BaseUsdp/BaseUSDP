/**
 * Content Security Policy (CSP) Configuration
 *
 * Generates CSP headers for BASEUSDP. These policies restrict
 * which resources the browser can load, mitigating XSS attacks.
 *
 * In production, these headers are set by Vercel's vercel.json
 * or middleware. This module provides the policy definitions
 * and a utility to generate the header string.
 */

export interface CSPDirectives {
  "default-src": string[];
  "script-src": string[];
  "style-src": string[];
  "img-src": string[];
  "font-src": string[];
  "connect-src": string[];
  "frame-src": string[];
  "object-src": string[];
  "base-uri": string[];
  "form-action": string[];
  "frame-ancestors": string[];
  "worker-src"?: string[];
  "manifest-src"?: string[];
}

/**
 * Production CSP directives for baseusdp.com.
 */
export const PRODUCTION_CSP: CSPDirectives = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'", // Required for Vite's inline scripts
    "https://cdn.vercel-insights.com",
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind CSS and inline styles
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://basescan.org",
    "https://raw.githubusercontent.com",
  ],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://mainnet.base.org",
    "https://sepolia.base.org",
    "https://api.baseusdp.com",
    "wss://api.baseusdp.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://production.xmtp.network",
    "https://dev.xmtp.network",
    "https://api.0x.org",
    "https://vitals.vercel-insights.com",
  ],
  "frame-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "worker-src": ["'self'", "blob:"],
};

/**
 * Development CSP (more permissive for HMR and dev tools).
 */
export const DEVELOPMENT_CSP: CSPDirectives = {
  ...PRODUCTION_CSP,
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  "connect-src": [
    "'self'",
    "http://localhost:*",
    "ws://localhost:*",
    "https://mainnet.base.org",
    "https://sepolia.base.org",
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ],
};

/**
 * Serialize CSP directives into a header string.
 */
export function buildCSPHeader(directives: CSPDirectives): string {
  return Object.entries(directives)
    .filter(([, values]) => values && values.length > 0)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Get the appropriate CSP directives for the current environment.
 */
export function getCSPDirectives(): CSPDirectives {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return DEVELOPMENT_CSP;
  }
  return PRODUCTION_CSP;
}

/**
 * Generate a nonce for inline scripts (used with strict CSP).
 * In production, this should be generated server-side.
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
