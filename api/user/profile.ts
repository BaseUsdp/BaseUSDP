/**
 * Void402 User Profile API (1:1 with Nolvipay)
 * GET /api/user/profile?wallet=... - Get user profile
 * POST /api/user/profile - Create/update user profile
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    if (req.method === "GET") {
      // Get user profile by wallet address
      const wallet = req.query.wallet as string;
      if (!wallet || wallet.length < 32) {
        return res.status(400).json({ success: false, error: "Valid wallet address required" });
      }

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("wallet_address", wallet)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch profile" });
      }

      if (!profile) {
        // Create default profile if doesn't exist
        const defaultUsername = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
        const { data: newProfile, error: createError } = await supabase
          .from("user_profiles")
          .insert({
            wallet_address: wallet,
            username: defaultUsername,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return res.status(200).json({
            success: true,
            profile: {
              wallet_address: wallet,
              username: defaultUsername,
              has_custom_username: false,
            },
          });
        }

        return res.status(200).json({
          success: true,
          profile: {
            ...newProfile,
            has_custom_username: false,
          },
        });
      }

      // Check if username is default (contains ...)
      const isDefaultUsername = profile.username?.includes("...");

      return res.status(200).json({
        success: true,
        profile: {
          ...profile,
          has_custom_username: !isDefaultUsername,
        },
      });
    }

    if (req.method === "POST") {
      // Create or update user profile
      const { wallet_address, username } = req.body || {};

      if (!wallet_address || wallet_address.length < 32) {
        return res.status(400).json({ success: false, error: "Valid wallet address required" });
      }

      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ success: false, error: "Username must be 3-20 characters" });
      }

      // Validate username format (letters, numbers, underscores, hyphens only)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(username)) {
        return res.status(400).json({
          success: false,
          error: "Username must start with letter/number and contain only letters, numbers, underscores, or hyphens",
        });
      }

      // Check if username is already taken by another wallet
      const { data: existingUser, error: checkError } = await supabase
        .from("user_profiles")
        .select("wallet_address")
        .ilike("username", username)
        .neq("wallet_address", wallet_address)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking username:", checkError);
        return res.status(500).json({ success: false, error: "Failed to check username availability" });
      }

      if (existingUser) {
        return res.status(400).json({ success: false, error: "Username is already taken" });
      }

      // Upsert profile
      const { data: profile, error: upsertError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            wallet_address,
            username,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" }
        )
        .select()
        .single();

      if (upsertError) {
        console.error("Error upserting profile:", upsertError);
        return res.status(500).json({ success: false, error: "Failed to save profile" });
      }

      console.log(`✅ Updated username for wallet ${wallet_address.slice(0, 8)}... to ${username}`);

      return res.status(200).json({
        success: true,
        profile: {
          ...profile,
          has_custom_username: true,
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Error in profile API:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
