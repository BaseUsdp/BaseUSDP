/**
 * POST /api/agents/agentkit-transfer
 * Gasless transfer via Coinbase CDP smart wallet (AgentKey auth)
 * Uses CDP SDK user operations for gasless Base transactions.
 * Spending policy enforcement is applied on top.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractAgentKey, verifyAgentKey } from "../lib/agent-auth.js";
import {
  checkSpendingPolicy,
  logSpendingAttempt,
} from "../lib/agent-policy.js";
import { sendSmartAccountTransfer } from "../lib/agentkit.js";
import { isValidBaseAddress } from "../lib/void402-base.js";

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

// Token addresses on Base mainnet
const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Agent-Key"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Agent key auth
  const agentKey = extractAgentKey(req);
  if (!agentKey)
    return res.status(401).json({ error: "Agent API key required" });

  const auth = await verifyAgentKey(agentKey);
  if (!auth.valid || !auth.agentId || !auth.ownerWallet) {
    return res
      .status(403)
      .json({ error: auth.error || "Invalid agent key" });
  }

  if (!auth.scopes?.includes("transfer")) {
    return res
      .status(403)
      .json({ error: "API key does not have transfer scope" });
  }

  const {
    recipient_wallet,
    recipient_username,
    to,
    amount,
    token,
  } = req.body || {};

  // "to" shorthand: address -> wallet, otherwise -> username
  const resolvedRecipientWallet =
    recipient_wallet || (to && to.startsWith("0x") ? to : undefined);
  const resolvedRecipientUsername =
    recipient_username || (to && !to.startsWith("0x") ? to : undefined);

  if (!amount || !token) {
    return res
      .status(400)
      .json({ error: "amount and token are required" });
  }

  if (!["USDC", "USDT"].includes(token)) {
    return res
      .status(400)
      .json({ error: "Token must be USDC or USDT" });
  }

  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  // Check spending policy
  const policyCheck = await checkSpendingPolicy(
    auth.agentId,
    transferAmount,
    token,
    resolvedRecipientWallet
  );

  if (!policyCheck.allowed) {
    await logSpendingAttempt(
      auth.agentId,
      "transfer",
      transferAmount,
      token,
      "blocked",
      resolvedRecipientWallet,
      policyCheck.reason
    );
    return res
      .status(403)
      .json({ error: policyCheck.reason || "Policy violation" });
  }

  await logSpendingAttempt(
    auth.agentId,
    "transfer",
    transferAmount,
    token,
    "allowed",
    resolvedRecipientWallet
  );

  if (!supabase)
    return res.status(500).json({ error: "Database not configured" });

  // Get agent's AgentKit wallet
  const { data: agent, error: agentError } = await supabase
    .from("agent_profiles")
    .select("id, owner_wallet, cdp_wallet_id, cdp_wallet_address, agentkit_enabled")
    .eq("id", auth.agentId)
    .single();

  if (agentError || !agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  if (!agent.agentkit_enabled || !agent.cdp_wallet_address || !agent.cdp_wallet_id) {
    return res.status(400).json({
      error:
        "AgentKit wallet not provisioned. Use the dashboard to enable AgentKit for this agent.",
    });
  }

  // Resolve recipient
  let resolvedRecipient = resolvedRecipientWallet;
  if (!resolvedRecipient && resolvedRecipientUsername) {
    const cleanUsername = resolvedRecipientUsername.startsWith("@")
      ? resolvedRecipientUsername.substring(1)
      : resolvedRecipientUsername;
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("wallet_address")
      .ilike("username", cleanUsername)
      .maybeSingle();
    if (!userProfile) {
      return res.status(404).json({
        error: `Username "${resolvedRecipientUsername}" not found`,
      });
    }
    resolvedRecipient = userProfile.wallet_address;
  }

  if (!resolvedRecipient) {
    return res.status(400).json({
      error:
        '"to" (username or 0x address), "recipient_wallet", or "recipient_username" is required',
    });
  }

  if (!isValidBaseAddress(resolvedRecipient)) {
    return res.status(400).json({ error: "Invalid recipient address" });
  }

  try {
    const tokenAddress = TOKEN_ADDRESSES[token];
    // USDC/USDT are 6 decimals
    const amountInUnits = BigInt(Math.round(transferAmount * 1_000_000));

    // Execute gasless transfer via CDP smart account user operation
    const result = await sendSmartAccountTransfer({
      smartAccountAddress: agent.cdp_wallet_address,
      ownerAddress: agent.cdp_wallet_id,
      tokenAddress,
      recipientAddress: resolvedRecipient,
      amount: amountInUnits,
    });

    // Log to zk_transactions
    try {
      await supabase.from("zk_transactions").insert({
        sender_wallet: auth.ownerWallet,
        recipient_wallet: resolvedRecipient,
        amount: transferAmount,
        fee_percentage: 0,
        token_symbol: token,
        tx_hash: result.userOpHash,
        status: "completed",
        privacy_level: "public",
        transaction_type: "transfer",
        agent_id: auth.agentId,
      });
    } catch (logErr: any) {
      console.warn("Failed to log agentkit transfer:", logErr.message);
    }

    await logSpendingAttempt(
      auth.agentId,
      "transfer",
      transferAmount,
      token,
      "completed",
      resolvedRecipient,
      undefined,
      result.userOpHash
    );

    return res.status(200).json({
      success: true,
      signature: result.userOpHash,
      amount: transferAmount,
      token,
      recipient: resolvedRecipient,
      gasless: true,
    });
  } catch (err: any) {
    console.error("[AgentKit Transfer] Error:", err.message);
    await logSpendingAttempt(
      auth.agentId,
      "transfer",
      transferAmount,
      token,
      "failed",
      resolvedRecipient,
      err.message
    );
    return res
      .status(500)
      .json({ error: "Transfer failed: " + err.message });
  }
}
