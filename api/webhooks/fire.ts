/**
 * Client-triggered webhook fire (for events whose tx is signed in the
 * browser, e.g. Veil deposit/withdraw). Server-driven events fire
 * fireWebhooks() directly from their handler — they don't need this
 * route.
 *
 * POST /api/webhooks/fire
 * Body: { wallet, event_type, payload? }
 *
 * Bearer-authed: only the authenticated wallet can fire its own webhooks,
 * so a stranger can't impersonate someone else and flood their endpoint.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { fireWebhooks, type WebhookEventType } from "../lib/webhook-notify.js";

const ALLOWED_ORIGINS = [
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

const ALLOWED_CLIENT_EVENTS: WebhookEventType[] = ["deposit", "withdraw"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const bearer = extractBearerToken(req);
  if (!bearer) return res.status(401).json({ error: "Authentication required" });

  const { wallet, event_type, payload } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!ALLOWED_CLIENT_EVENTS.includes(event_type)) {
    return res
      .status(400)
      .json({ error: `event_type must be one of: ${ALLOWED_CLIENT_EVENTS.join(", ")}` });
  }

  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const result = await fireWebhooks(
    wallet,
    event_type as WebhookEventType,
    (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  );

  return res.status(200).json({ success: true, ...result });
}
