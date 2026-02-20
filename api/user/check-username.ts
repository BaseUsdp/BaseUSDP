/**
 * Void402 Check Username API (1:1 with Nolvipay)
 * GET /api/user/check-username?username=...
 * Returns whether username exists and the associated wallet address
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Normalize username - remove @ if present
    const inputUsername = (username as string).trim();
    const cleanUsername = inputUsername.startsWith("@") ? inputUsername.substring(1) : inputUsername;
    const withAt = `@${cleanUsername}`;

    // Check if username exists in user_profiles (case-insensitive)
    // Try both with and without @ prefix since storage format may vary
    const { data, error } = await supabase
      .from("user_profiles")
      .select("username, wallet_address, profile_picture")
      .or(`username.ilike.${cleanUsername},username.ilike.${withAt}`)
      .maybeSingle();

    if (error) {
      console.error("Error checking username:", error);
      return res.status(500).json({ error: "Failed to check username", message: error.message });
    }

    if (!data) {
      return res.status(200).json({
        exists: false,
        message: "Username not found",
      });
    }

    return res.status(200).json({
      exists: true,
      username: data.username,
      wallet_address: data.wallet_address,
      profile_picture: data.profile_picture || null,
    });
  } catch (error: any) {
    console.error("Error in check username:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}
