/**
 * POST /api/agents/agentkit-wallet
 * Provision a Coinbase CDP smart wallet for an agent (Bearer auth)
 * Gives the agent a gasless wallet on Base.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { createSmartWallet } from "../lib/agentkit.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
  return "https://www.orb402.com";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken)
    return res.status(401).json({ error: "Authentication required" });

  const { wallet, agent_id } = req.body || {};
  if (!wallet || !agent_id) {
    return res
      .status(400)
      .json({ error: "wallet and agent_id are required" });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: "Invalid authentication" });
  }

  if (!supabase)
    return res.status(500).json({ error: "Database not configured" });

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from("agent_profiles")
    .select("id, owner_wallet, cdp_wallet_address, agentkit_enabled")
    .eq("id", agent_id)
    .single();

  if (agentError || !agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  if (agent.owner_wallet.toLowerCase() !== wallet.toLowerCase()) {
    return res.status(403).json({ error: "Not the agent owner" });
  }

  // Check if already provisioned
  if (agent.agentkit_enabled && agent.cdp_wallet_address) {
    return res.status(200).json({
      success: true,
      already_provisioned: true,
      wallet_address: agent.cdp_wallet_address,
    });
  }

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    return res
      .status(500)
      .json({ error: "CDP API keys not configured" });
  }

  try {
    // Create a new CDP smart wallet via CDP SDK
    const walletData = await createSmartWallet(agent_id);

    // Store in agent profile
    const { error: updateError } = await supabase
      .from("agent_profiles")
      .update({
        cdp_wallet_id: walletData.ownerAddress,
        cdp_wallet_address: walletData.smartAccountAddress,
        agentkit_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent_id);

    if (updateError) {
      console.error("[AgentKit Wallet] DB update error:", updateError.message);
      return res
        .status(500)
        .json({ error: "Failed to save wallet" });
    }

    return res.status(201).json({
      success: true,
      wallet_address: walletData.smartAccountAddress,
      wallet_id: walletData.ownerAddress,
    });
  } catch (err: any) {
    console.error("[AgentKit Wallet] Error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to provision wallet: " + err.message });
  }
}
