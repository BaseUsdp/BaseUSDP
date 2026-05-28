/**
 * Shared business logic for the BASEUSDP MCP tools.
 *
 * Used by the MCP JSON-RPC server (api/mcp/server.ts). Each function
 * enforces the per-user `mcp_enabled` opt-in gate so a handle is only
 * resolvable / tippable when its owner has turned on AI assistant access.
 *
 * Functions throw `ToolError` with a user-safe message on failure; the
 * server maps that to an MCP tool error result.
 */

import { createClient } from "@supabase/supabase-js";
import { encodeFunctionData, isAddress, parseUnits, type Address } from "viem";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const TOKEN_ADDRESSES = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
} as const;
const TOKEN_DECIMALS = { USDC: 6, USDT: 6 } as const;
type Token = keyof typeof TOKEN_ADDRESSES;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export class ToolError extends Error {}

function db() {
  if (!supabaseUrl || !supabaseKey) throw new ToolError("Database not configured");
  return createClient(supabaseUrl, supabaseKey);
}

function normalizeToken(raw: unknown): Token {
  const t = typeof raw === "string" ? raw.toUpperCase() : "USDC";
  if (t !== "USDC" && t !== "USDT") throw new ToolError("token must be USDC or USDT");
  return t as Token;
}

interface ResolvedRecipient {
  address: Address;
  handle: string | null;
}

/**
 * Resolve a recipient string (either an @handle or a raw 0x address) to an
 * address. Handles are gated on mcp_enabled; raw addresses pass through
 * because the caller already holds the address.
 */
async function resolveRecipient(recipient: string): Promise<ResolvedRecipient> {
  const trimmed = recipient.trim();
  if (isAddress(trimmed)) return { address: trimmed as Address, handle: null };
  const handle = trimmed.replace(/^@/, "");
  if (!handle) throw new ToolError("recipient is empty");
  const supabase = db();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("wallet_address, username, mcp_enabled")
    .ilike("username", handle)
    .single();
  if (error || !data || !data.mcp_enabled) {
    throw new ToolError(`Handle @${handle} not found`);
  }
  return { address: data.wallet_address as Address, handle: `@${data.username}` };
}

export async function resolveHandle(handle: string): Promise<{
  handle: string;
  address: string;
  profilePicture: string | null;
}> {
  const clean = (handle ?? "").trim().replace(/^@/, "");
  if (!clean) throw new ToolError("handle is required");
  const supabase = db();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("wallet_address, username, profile_picture, mcp_enabled")
    .ilike("username", clean)
    .single();
  if (error || !data || !data.mcp_enabled) {
    throw new ToolError("Handle not found");
  }
  return {
    handle: `@${data.username}`,
    address: data.wallet_address as string,
    profilePicture: (data.profile_picture as string | null) ?? null,
  };
}

export async function buildTipCalldata(args: {
  recipient: string;
  amount: string;
  token?: string;
}): Promise<{
  chain: "base";
  calls: { to: string; value: string; data: string }[];
  recipient: ResolvedRecipient;
  amountWei: string;
  token: Token;
}> {
  if (!args.recipient) throw new ToolError("recipient is required");
  const amountNum = Number(args.amount);
  if (!args.amount || !Number.isFinite(amountNum) || amountNum <= 0) {
    throw new ToolError("amount must be a positive decimal string");
  }
  const token = normalizeToken(args.token);
  const resolved = await resolveRecipient(args.recipient);
  const amountWei = parseUnits(args.amount, TOKEN_DECIMALS[token]);
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [resolved.address, amountWei],
  });
  return {
    chain: "base",
    calls: [{ to: TOKEN_ADDRESSES[token], value: "0x0", data }],
    recipient: resolved,
    amountWei: amountWei.toString(),
    token,
  };
}

export async function createPaymentRequest(args: {
  recipient: string;
  amount: string;
  token?: string;
  service_name?: string;
  description?: string;
  origin?: string;
}): Promise<{
  paymentId: string;
  shareableUrl: string;
  recipient: ResolvedRecipient;
  amount: number;
  token: Token;
}> {
  if (!args.recipient) throw new ToolError("recipient is required");
  const amount = parseFloat(args.amount);
  if (!args.amount || !Number.isFinite(amount) || amount <= 0) {
    throw new ToolError("amount must be a positive decimal");
  }
  if (amount > 999999.99) throw new ToolError("amount exceeds maximum (999,999.99)");
  const token = normalizeToken(args.token);
  const serviceName =
    args.service_name && args.service_name.trim()
      ? args.service_name.trim()
      : "BASEUSDP payment request";
  const description = args.description?.trim() ?? "";

  const resolved = await resolveRecipient(args.recipient);
  const supabase = db();
  const paymentId = `x402_${Math.random().toString(36).slice(2, 11)}`;
  const { createHash } = await import("node:crypto");
  const paymentHash = createHash("sha256")
    .update(paymentId + amount.toString() + resolved.address + Date.now().toString())
    .digest("hex");

  const row = {
    payment_id: paymentId,
    user_wallet: resolved.address,
    recipient: resolved.address,
    amount,
    token,
    nonce: Date.now(),
    payment_hash: paymentHash,
    status: "pending" as const,
  };
  const { error: err1 } = await supabase
    .from("payment_requests")
    .insert({ ...row, service_name: serviceName, description });
  if (err1) {
    const { error: err2 } = await supabase.from("payment_requests").insert(row);
    if (err2) throw new ToolError("Failed to create payment request");
  }

  const origin = (args.origin || "https://baseusdp.com").replace(/\/$/, "");
  return {
    paymentId,
    shareableUrl: `${origin}/pay/${paymentId}`,
    recipient: resolved,
    amount,
    token,
  };
}

export async function listRecentTips(args: {
  handle: string;
  limit?: number;
}): Promise<{
  handle: string | null;
  tips: {
    sender_handle: string | null;
    sender_address: string | null;
    amount: number | null;
    token: string;
    memo: string | null;
    created_at: string;
  }[];
}> {
  const handleRaw = (args.handle ?? "").trim();
  if (!handleRaw) throw new ToolError("handle is required");
  const limit = Number.isFinite(args.limit)
    ? Math.max(1, Math.min(50, Math.floor(args.limit as number)))
    : 10;
  const clean = handleRaw.startsWith("@") ? handleRaw.slice(1) : handleRaw;
  const supabase = db();

  let wallet: string;
  let displayHandle: string | null = null;
  if (ADDRESS_RE.test(clean)) {
    wallet = clean.toLowerCase();
  } else {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("wallet_address, username, mcp_enabled")
      .ilike("username", clean)
      .maybeSingle();
    if (error || !profile?.wallet_address || !profile.mcp_enabled) {
      throw new ToolError("Handle not found");
    }
    wallet = (profile.wallet_address as string).toLowerCase();
    displayHandle = `@${profile.username}`;
  }

  const { data: txs, error: txErr } = await supabase
    .from("zk_transactions")
    .select("*")
    .eq("recipient_wallet", wallet)
    .neq("sender_wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (txErr) throw new ToolError("Failed to load tips");

  const incoming = (txs ?? []).filter(
    (t: any) =>
      (t.transaction_type ?? "transfer") !== "withdraw" &&
      (t.transaction_type ?? "transfer") !== "deposit",
  );
  const senderWallets = Array.from(
    new Set(
      incoming
        .map((t: any) => (t.sender_wallet as string | null)?.toLowerCase())
        .filter((s): s is string => !!s),
    ),
  );
  const walletToUsername: Record<string, string> = {};
  if (senderWallets.length > 0) {
    const { data: senders } = await supabase
      .from("user_profiles")
      .select("wallet_address, username")
      .in("wallet_address", senderWallets);
    for (const s of senders ?? []) {
      if (s?.wallet_address && s?.username) {
        walletToUsername[(s.wallet_address as string).toLowerCase()] = s.username as string;
      }
    }
  }

  const tips = incoming.map((t: any) => {
    const sw = (t.sender_wallet as string | null)?.toLowerCase() ?? null;
    const senderUsername = sw ? walletToUsername[sw] ?? null : null;
    return {
      sender_handle: senderUsername ? `@${senderUsername}` : null,
      sender_address: sw,
      amount:
        typeof t.amount === "string" ? Number(t.amount) : (t.amount as number | null),
      token: (t.token_symbol as string | null) ?? "USDC",
      memo: (t.memo as string | null) ?? (t.description as string | null) ?? null,
      created_at: t.created_at as string,
    };
  });

  return { handle: displayHandle, tips };
}
