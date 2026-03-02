/**
 * AI Tool Executor
 * Handles execution of tool calls from Claude's tool_use API.
 * Read-only tools execute directly; transactional tools return
 * action objects for the frontend to handle with user confirmation.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface UserContext {
  walletAddress?: string | null;
  balance?: string | number | null;
  chain?: string;
  isConnected?: boolean;
}

// Known tokens on Base
const BASE_TOKENS: Record<
  string,
  { name: string; address: string; decimals: number }
> = {
  USDC: {
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
  },
  USDT: {
    name: "Tether USD",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
  },
  ETH: {
    name: "Ethereum",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
  },
  WETH: {
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
  },
  DAI: {
    name: "Dai Stablecoin",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
  },
  cbETH: {
    name: "Coinbase Wrapped Staked ETH",
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
  },
};

/**
 * Execute a tool call and return the result as a string.
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: UserContext
): Promise<string> {
  switch (toolName) {
    case "check_balance":
      return handleCheckBalance(context);

    case "send_payment":
      return handleSendPayment(toolInput);

    case "deposit":
      return handleDeposit(toolInput);

    case "withdraw":
      return handleWithdraw(toolInput);

    case "get_transaction_history":
      return handleGetHistory(toolInput, context);

    case "get_token_info":
      return handleGetTokenInfo(toolInput);

    case "create_payment":
      return handleCreatePayment(toolInput);

    case "navigate":
      return handleNavigate(toolInput);

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ── Read-only tools (execute directly) ──────────────────────────

async function handleCheckBalance(context: UserContext): Promise<string> {
  if (!context.walletAddress) {
    return JSON.stringify({
      balances: { USDC: 0, USDT: 0 },
      note: "Wallet not connected",
    });
  }

  // Try Supabase query for per-token breakdown
  if (supabase) {
    try {
      const [usdcBalance, usdtBalance] = await Promise.all([
        calculateBalance(context.walletAddress, "USDC"),
        calculateBalance(context.walletAddress, "USDT"),
      ]);

      const total = usdcBalance + usdtBalance;
      // If DB returned a non-zero result, use it
      if (total > 0) {
        return JSON.stringify({
          balances: {
            USDC: parseFloat(usdcBalance.toFixed(2)),
            USDT: parseFloat(usdtBalance.toFixed(2)),
          },
          total: parseFloat(total.toFixed(2)),
        });
      }
    } catch {
      // Fall through to context balance
    }
  }

  // Fallback: use the balance from frontend context (already authenticated)
  const contextBalance =
    context.balance != null &&
    context.balance !== "hidden" &&
    context.balance !== "unknown"
      ? parseFloat(String(context.balance))
      : NaN;

  if (!isNaN(contextBalance) && contextBalance > 0) {
    return JSON.stringify({
      balances: { total: contextBalance },
      total: contextBalance,
      note: "Balance from your authenticated session. Use the dashboard for a per-token breakdown.",
    });
  }

  // If truly no balance data available
  return JSON.stringify({
    balances: { USDC: 0, USDT: 0 },
    total: 0,
  });
}

async function handleGetHistory(
  input: Record<string, unknown>,
  context: UserContext
): Promise<string> {
  if (!context.walletAddress || !supabase) {
    return JSON.stringify({
      transactions: [],
      note: "Wallet not connected or database unavailable",
    });
  }

  const limit = Math.min(
    typeof input.limit === "number" ? input.limit : 5,
    10
  );

  try {
    const { data: transactions } = await supabase
      .from("zk_transactions")
      .select(
        "amount, token_symbol, transaction_type, status, created_at, sender_wallet, recipient_wallet"
      )
      .or(
        `sender_wallet.eq.${context.walletAddress},recipient_wallet.eq.${context.walletAddress}`
      )
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!transactions || transactions.length === 0) {
      return JSON.stringify({
        transactions: [],
        note: "No transactions found",
      });
    }

    const formatted = transactions.map((tx: any) => {
      let type = "transfer";
      if (tx.transaction_type === "withdraw") type = "withdraw";
      else if (
        tx.transaction_type === "deposit" ||
        (tx.sender_wallet === context.walletAddress &&
          tx.recipient_wallet === context.walletAddress)
      )
        type = "deposit";
      else if (tx.sender_wallet === context.walletAddress) type = "sent";
      else type = "received";

      return {
        type,
        amount: tx.amount,
        token: tx.token_symbol || "USDC",
        date: tx.created_at,
      };
    });

    return JSON.stringify({ transactions: formatted });
  } catch {
    return JSON.stringify({
      transactions: [],
      note: "Error fetching history",
    });
  }
}

function handleGetTokenInfo(input: Record<string, unknown>): string {
  const symbol = (
    typeof input.symbol === "string" ? input.symbol : ""
  ).toUpperCase();
  const token = BASE_TOKENS[symbol];

  if (!token) {
    return JSON.stringify({
      error: `Token "${symbol}" not found in our Base token list`,
      available_tokens: Object.keys(BASE_TOKENS),
    });
  }

  return JSON.stringify({
    symbol,
    name: token.name,
    address: token.address,
    decimals: token.decimals,
    network: "Base (Ethereum L2)",
  });
}

// ── Transactional tools (return action for frontend) ────────────

function handleSendPayment(input: Record<string, unknown>): string {
  const params: Record<string, string> = {};
  if (input.recipient) params.recipient = String(input.recipient);
  if (input.amount) params.amount = String(input.amount);
  if (input.token) params.token = String(input.token);

  return JSON.stringify({
    action: "send_payment",
    params,
    message: "Opening the send payment form for you.",
  });
}

function handleDeposit(input: Record<string, unknown>): string {
  const params: Record<string, string> = {};
  if (input.amount) params.amount = String(input.amount);
  if (input.token) params.token = String(input.token);

  return JSON.stringify({
    action: "deposit",
    params,
    message: "Opening the deposit form for you.",
  });
}

function handleWithdraw(input: Record<string, unknown>): string {
  const params: Record<string, string> = {};
  if (input.amount) params.amount = String(input.amount);
  if (input.token) params.token = String(input.token);

  return JSON.stringify({
    action: "withdraw",
    params,
    message: "Opening the withdraw form for you.",
  });
}

function handleCreatePayment(input: Record<string, unknown>): string {
  const params: Record<string, string> = {};
  if (input.amount) params.amount = String(input.amount);

  return JSON.stringify({
    action: "create_payment",
    params,
    message: "Opening the payment request form.",
  });
}

function handleNavigate(input: Record<string, unknown>): string {
  const section = typeof input.section === "string" ? input.section : "overview";

  return JSON.stringify({
    action: "navigate",
    params: { tab: section },
    message: `Navigating to ${section}.`,
  });
}

// ── Balance calculation (reused from api/agents/balance.ts) ─────

async function calculateBalance(
  wallet: string,
  token: string
): Promise<number> {
  if (!supabase) return 0;

  const { data: transactions, error } = await supabase
    .from("zk_transactions")
    .select(
      "id, status, sender_wallet, recipient_wallet, amount, fee_percentage, token_symbol, transaction_type"
    )
    .or(`sender_wallet.eq.${wallet},recipient_wallet.eq.${wallet}`)
    .eq("status", "completed")
    .eq("token_symbol", token)
    .order("created_at", { ascending: true });

  if (error || !transactions) return 0;

  let balance = 0;
  for (const tx of transactions) {
    const amount = parseFloat(tx.amount || 0);
    const feePercent =
      tx.fee_percentage != null ? parseFloat(tx.fee_percentage) : 0;

    if (tx.transaction_type === "withdraw") {
      balance -= amount;
    } else if (
      tx.sender_wallet === wallet &&
      tx.recipient_wallet === wallet
    ) {
      // Deposit
      const amountAfterFees =
        feePercent > 0 ? amount * (1 - feePercent / 100) : amount;
      balance += amountAfterFees;
    } else if (
      tx.recipient_wallet === wallet &&
      tx.sender_wallet !== wallet
    ) {
      // Received transfer
      const amountAfterFees =
        feePercent > 0 ? amount * (1 - feePercent / 100) : amount;
      balance += amountAfterFees;
    } else if (
      tx.sender_wallet === wallet &&
      tx.recipient_wallet !== wallet
    ) {
      // Sent transfer
      balance -= amount;
    }
  }

  return Math.max(0, balance);
}
