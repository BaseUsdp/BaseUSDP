/**
 * Privacy-Safe Embed Image Generator
 * GET /api/farcaster/embed-image?id={paymentId}
 *
 * Returns a dynamically generated SVG image for cast embeds.
 * NEVER reveals: amount, recipient, wallet address, sender identity.
 * Shows only: "Payment Request on ORB402" + service name (if provided).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const paymentId = req.query.id as string;

  let serviceName = "Private Payment";

  // If payment ID provided, look up service name only (no financial data)
  if (paymentId && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("payment_requests")
        .select("service_name")
        .eq("payment_id", paymentId)
        .single();

      if (data?.service_name) {
        serviceName = data.service_name;
      }
    } catch {
      // Ignore — use default label
    }
  }

  // Generate SVG (1200×630 for OG image standard)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="url(#accent)"/>
  <!-- Shield icon -->
  <g transform="translate(540, 160)">
    <path d="M60 10 L110 35 L110 80 C110 120 85 155 60 170 C35 155 10 120 10 80 L10 35 Z"
          fill="none" stroke="#6366f1" stroke-width="3" opacity="0.8"/>
    <path d="M45 85 L55 95 L75 70"
          fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Title -->
  <text x="600" y="380" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
        font-size="36" font-weight="700" fill="#ffffff">${escapeXml(serviceName)}</text>
  <text x="600" y="430" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
        font-size="20" fill="#a1a1aa">on ORB402</text>
  <!-- Footer -->
  <text x="600" y="560" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
        font-size="16" fill="#52525b">Privacy-First Payments</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return res.status(200).send(svg);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
