/**
 * POST /api/user/upload-avatar
 *
 * Authenticated. Accepts a base64 data URL, validates it as an image
 * within size limits, and uploads it to the `profile-avatars` Supabase
 * Storage bucket. Returns the public URL and updates the user's
 * profile_picture field on user_profiles so it shows up on /@handle.
 *
 * Body:
 *   { data_url: "data:image/jpeg;base64,..." }
 *
 * Constraints:
 *   - MIME ∈ { image/jpeg, image/png, image/webp, image/gif }
 *   - Decoded payload ≤ 1 MB (avatars are small)
 *
 * Mirrors api/user/upload-banner.ts; bucket is auto-created on first call.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "profile-avatars";
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function parseDataUrl(
  dataUrl: string,
): { mime: string; buffer: Buffer } | { error: string } {
  const match = /^data:([a-zA-Z0-9/.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { error: "Invalid data URL format" };
  const mime = match[1].toLowerCase();
  if (!MIME_TO_EXT[mime]) {
    return { error: "File must be a JPEG, PNG, WebP, or GIF image" };
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return { error: "Failed to decode image" };
  }
  if (buffer.length > MAX_BYTES) {
    return { error: `Image too large (max ${MAX_BYTES / 1024 / 1024} MB)` };
  }
  if (buffer.length < 100) {
    return { error: "Image data is empty" };
  }
  return { mime, buffer };
}

async function ensureBucket(supabase: any) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(MIME_TO_EXT),
  });
  if (
    error &&
    !/already exists|duplicate/i.test(error.message) &&
    error.message !== "The resource already exists"
  ) {
    throw new Error(`Bucket setup failed: ${error.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

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
  const wallet = (session.user_wallet as string).toLowerCase();

  const body = (req.body ?? {}) as { data_url?: string };
  const dataUrl = body.data_url;
  if (typeof dataUrl !== "string" || !dataUrl) {
    return res
      .status(400)
      .json({ success: false, error: "data_url is required" });
  }

  const parsed = parseDataUrl(dataUrl);
  if ("error" in parsed) {
    return res.status(400).json({ success: false, error: parsed.error });
  }

  try {
    await ensureBucket(supabase);
    const ext = MIME_TO_EXT[parsed.mime];
    const path = `${wallet}/avatar-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true,
      });
    if (uploadErr) {
      console.error("[upload-avatar] upload error:", uploadErr);
      return res
        .status(500)
        .json({ success: false, error: "Upload failed" });
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = pub?.publicUrl;
    if (!avatarUrl) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to resolve public URL" });
    }
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({ profile_picture: avatarUrl })
      .ilike("wallet_address", wallet);
    if (updateErr) {
      console.warn(
        "[upload-avatar] profile update failed (avatar uploaded but not saved):",
        updateErr,
      );
    }
    return res.status(200).json({ success: true, avatar_url: avatarUrl });
  } catch (err: any) {
    console.error("[upload-avatar] error:", err?.message || err);
    return res
      .status(500)
      .json({
        success: false,
        error: err?.message || "Internal server error",
      });
  }
}
