/**
 * Health check endpoint
 * GET /api/health
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  return res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    version: "0.2.0"
  });
}
