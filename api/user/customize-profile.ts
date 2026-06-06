/**
 * GET + POST /api/user/customize-profile
 *
 * Authenticated.
 *   - GET   returns the current customization fields for the session wallet
 *   - POST  body: { bio?, banner_url?, twitter_handle?, farcaster_handle?, website_url? }
 *           Updates the row. Each field is independently nullable — pass
 *           null or "" to clear; omit to leave alone.
 *
 * Validation:
 *   - bio              ≤ 280 chars (UI keeps it shorter)
 *   - banner_url       must be https:// (or empty)
 *   - website_url      must be http(s):// (or empty)
 *   - twitter_handle   ≤ 15 chars, letters/digits/underscores
 *   - farcaster_handle ≤ 30 chars, lowercase letters/digits/hyphens
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

interface UpdateBody {
  bio?: string | null;
  banner_url?: string | null;
  twitter_handle?: string | null;
  farcaster_handle?: string | null;
  website_url?: string | null;
}

const TWITTER_RE = /^[A-Za-z0-9_]{1,15}$/;
const FARCASTER_RE = /^[a-z0-9-]{1,30}$/;

function clean(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function validate(input: UpdateBody): { ok: true; row: Record<string, any> } | { ok: false; error: string } {
  const row: Record<string, any> = {};

  if ("bio" in input) {
    const v = clean(input.bio);
    if (v && v.length > 280) return { ok: false, error: "Bio must be ≤ 280 characters" };
    row.bio = v;
  }
  if ("banner_url" in input) {
    const v = clean(input.banner_url);
    if (v && !/^https:\/\//i.test(v)) {
      return { ok: false, error: "Banner URL must start with https://" };
    }
    row.banner_url = v;
  }
  if ("website_url" in input) {
    const v = clean(input.website_url);
    if (v && !/^https?:\/\//i.test(v)) {
      return { ok: false, error: "Website URL must start with http(s)://" };
    }
    row.website_url = v;
  }
  if ("twitter_handle" in input) {
    const v = clean(input.twitter_handle)?.replace(/^@/, "") ?? null;
    if (v && !TWITTER_RE.test(v)) {
      return { ok: false, error: "X handle must be letters/digits/underscores, ≤ 15 chars" };
    }
    row.twitter_handle = v;
  }
  if ("farcaster_handle" in input) {
    const v = clean(input.farcaster_handle)?.replace(/^@/, "").toLowerCase() ?? null;
    if (v && !FARCASTER_RE.test(v)) {
      return { ok: false, error: "Farcaster handle must be lowercase letters/digits/hyphens, ≤ 30 chars" };
    }
    row.farcaster_handle = v;
  }

  return { ok: true, row };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ success: false, error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const token = extractBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required" });
  }
  const { data: session } = await supabase
    .from("auth_sessions")
    .select("user_wallet")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session?.user_wallet) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired session" });
  }
  const wallet = session.user_wallet as string;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("bio, banner_url, twitter_handle, farcaster_handle, website_url")
      .ilike("wallet_address", wallet)
      .maybeSingle();
    if (error) {
      console.error("[customize-profile GET] error:", error);
      return res.status(500).json({ success: false, error: "Lookup failed" });
    }
    return res.status(200).json({
      success: true,
      bio: data?.bio ?? null,
      banner_url: data?.banner_url ?? null,
      twitter_handle: data?.twitter_handle ?? null,
      farcaster_handle: data?.farcaster_handle ?? null,
      website_url: data?.website_url ?? null,
    });
  }

  if (req.method === "POST") {
    const result = validate((req.body ?? {}) as UpdateBody);
    if (result.ok !== true) {
      return res.status(400).json({ success: false, error: result.error });
    }
    if (Object.keys(result.row).length === 0) {
      return res.status(400).json({ success: false, error: "Nothing to update" });
    }
    const { error } = await supabase
      .from("user_profiles")
      .update(result.row)
      .ilike("wallet_address", wallet);
    if (error) {
      console.error("[customize-profile POST] error:", error);
      return res.status(500).json({ success: false, error: "Update failed" });
    }
    return res.status(200).json({ success: true, updated: result.row });
  }

  return res
    .status(405)
    .json({ success: false, error: "Method not allowed" });
}
