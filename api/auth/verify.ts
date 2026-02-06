/**
 * Void402 Verify Signature API (1:1 with Nolvipay - uses Supabase)
 * POST /api/auth/verify
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    // Verify nonce from Supabase (like Nolvipay)
    let nonceValid = false;
    if (supabase) {
      const { data: storedNonce, error } = await supabase
        .from("auth_nonces")
        .select("*")
        .eq("user_wallet", walletAddress)
        .eq("nonce", nonce)
        .single();

      if (error || !storedNonce) {
        console.error("Nonce lookup failed:", error?.message || "not found");
        return res.status(401).json({ success: false, error: "Invalid or expired nonce" });
      }

      // Check expiration
      if (new Date(storedNonce.expires_at) < new Date()) {
        await supabase.from("auth_nonces").delete().eq("nonce", nonce);
        return res.status(401).json({ success: false, error: "Nonce expired" });
      }

      // Delete nonce (one-time use)
      await supabase.from("auth_nonces").delete().eq("nonce", nonce);
      nonceValid = true;
    } else {
      // No Supabase - can't verify nonce properly
      return res.status(500).json({ success: false, error: "Database not configured" });
    }

    if (!nonceValid) {
      return res.status(401).json({ success: false, error: "Invalid nonce" });
    }

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
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    // Store session in Supabase
    if (supabase) {
      await supabase.from("auth_sessions").upsert({
        session_token: sessionToken,
        user_wallet: walletAddress,
        expires_at: expiresAt.toISOString(),
      });
    }

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
