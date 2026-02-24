/**
 * Swap price proxy — forwards requests to Clawncher API to avoid CORS.
 * GET /api/swap/price?chainId=...&sellToken=...&buyToken=...&sellAmount=...
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const CLAWNCH_API = "https://clawn.ch/api/swap/price";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    const response = await fetch(`${CLAWNCH_API}?${query}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch price" });
  }
}
