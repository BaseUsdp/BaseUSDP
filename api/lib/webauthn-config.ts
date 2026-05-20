/**
 * Relying-party config + allowed origins for WebAuthn.
 *
 * @simplewebauthn/server requires us to know the expected RP ID and origin
 * up front so it can validate the assertion came from a trusted page. We
 * derive both from the request Origin so the same code works in localhost
 * dev, Vercel previews, and production.
 */

import type { VercelRequest } from "@vercel/node";

const PROD_RP_ID = "baseusdp.com";

const ALLOWED_ORIGINS = [
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

export interface WebAuthnRpContext {
  rpID: string;
  rpName: string;
  expectedOrigin: string;
}

export function getRpContext(req: VercelRequest): WebAuthnRpContext {
  const rawOrigin = (req.headers.origin as string | undefined) ?? "https://baseusdp.com";
  let expectedOrigin = "https://baseusdp.com";
  if (ALLOWED_ORIGINS.includes(rawOrigin)) {
    expectedOrigin = rawOrigin;
  } else if (rawOrigin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) {
    expectedOrigin = rawOrigin;
  } else if (rawOrigin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) {
    expectedOrigin = rawOrigin;
  }

  let rpID = PROD_RP_ID;
  try {
    const url = new URL(expectedOrigin);
    // localhost gets bare "localhost", everything else uses bare hostname (no port).
    rpID = url.hostname;
  } catch {
    /* keep default */
  }

  return {
    rpID,
    rpName: "BASEUSDP",
    expectedOrigin,
  };
}

export function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

export function setCors(req: VercelRequest, res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(req.headers.origin as string | undefined));
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}
