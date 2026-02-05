/**
 * Void402 Verify Signature API (1:1 with Nolvipay)
 * POST /api/auth/verify
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";

// Session store (per serverless instance)
const sessions = new Map<string, { walletAddress: string; expiresAt: number }>();

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Import nonces from nonce.ts (same serverless bundle)
import { nonces } from "./nonce.js";

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { walletAddress, signature, nonce } = req.body || {};

    if (!walletAddress || !signature || !nonce) {
      return res.status(400).json({ success: false, error: "walletAddress, signature, nonce are required" });
    }

    // Verify nonce exists and is not expired
    const storedNonce = nonces.get(walletAddress);
    if (!storedNonce || storedNonce.nonce !== nonce || storedNonce.expiresAt < Date.now()) {
      return res.status(401).json({ success: false, error: "Invalid or expired nonce" });
    }
    nonces.delete(walletAddress); // consume nonce

    // Verify signature
    const message = `Sign this message to authenticate with Void402.\n\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction.`;
    const messageBytes = new TextEncoder().encode(message);
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signature);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid signature format" });
    }
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid signature" });
    }

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    sessions.set(sessionToken, { walletAddress, expiresAt: Date.now() + SESSION_DURATION_MS });

    console.log(`✅ Verified signature for wallet ${walletAddress.slice(0, 8)}...`);

    return res.status(200).json({
      success: true,
      sessionToken,
      expiresIn: SESSION_DURATION_MS / 1000,
      walletAddress,
    });
  } catch (error: any) {
    console.error("Error in verify API:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}

// Export sessions for other routes that need auth
export { sessions };
