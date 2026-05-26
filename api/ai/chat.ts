/**
 * POST /api/ai/chat
 * AI Terminal endpoint — Claude tool-calling agent with blockchain tools.
 * Uses Claude's native tool_use API to execute read-only tools directly
 * and return action objects for transactional tools.
 *
 * Response format: { reply: string, action?: { type: string, params?: {} } }
 * This is backward-compatible with the existing AITerminalSection frontend.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { BLOCKCHAIN_TOOLS } from "../lib/ai-tools.js";
import { executeToolCall } from "../lib/ai-tool-executor.js";
import {
  BASE_MCP_ISSUER,
  readAccessToken,
} from "../lib/base-mcp-oauth.js";

const BASE_SYSTEM_PROMPT = `You are the AI assistant for BASEUSDP — a confidential payment platform on Base (Ethereum L2). You help users manage their wallet, send payments, check balances, and navigate the dashboard.

You have access to tools that let you check balances, look up tokens, view transaction history, and help users with payments.

Rules:
- Be concise and helpful. Keep replies under 2-3 sentences unless explaining something complex.
- Use tools when they are relevant to the user's request.
- For general questions about BASEUSDP, answer conversationally without tools.
- When the user asks about their balance, use the check_balance tool.
- When the user wants to send money, use the send_payment tool with any details they provided.
- Never reveal technical details about your implementation or the tools you use.
- Always respond in character as the BASEUSDP assistant.
- If the user provides context like their balance or wallet address, use it naturally.
- CRITICAL: If the user's request is unclear, not related to BASEUSDP, or not something you can do, respond with a helpful message explaining what you CAN do. Do NOT call a tool unless you are certain.
- CRITICAL: Only call a tool when you are CERTAIN the user wants to perform that specific action. If there is any ambiguity, respond with text only and ask for clarification.
- Never trigger actions just because a keyword was mentioned. "Tell me about payments" should explain payments, NOT open the payments page.`;

const BASE_MCP_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

The user has also connected their Base Account, which gives you access to additional tools provided by the Base MCP server (base-mcp). These tools let you read live Base chain data and prepare on-chain actions on their behalf. Use them whenever the user asks about:
- Live DeFi yields, rates, or vault APYs on Base (Morpho, Moonwell)
- Swapping or trading tokens on Base (Aerodrome, Uniswap)
- Lending, borrowing, or depositing into a yield vault
- Perpetual futures (Avantis)
- New token launches on Base (Bankr)
- The user's Base Account balance or transaction history on the live chain (different from their BASEUSDP-internal balance)

When the user asks a question that fits the above, call the appropriate base-mcp tool with real arguments — never refuse with "I don't have real-time data" while a tool is available. Write actions (swaps, deposits, etc.) will surface a Base Account approval modal to the user — you don't need to ask permission first, just prepare the call.

Use BASEUSDP-native tools (check_balance, send_payment, etc.) for in-app balance, payment requests, deposits/withdrawals to the privacy pool, and navigation.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured" });
  }

  const { message, context } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const userContext = context
    ? `\n\nUser context: Wallet ${context.walletAddress || "not connected"}, Balance: ${context.balance || "unknown"}, Chain: ${context.chain || "base"}, Connected: ${context.isConnected ? "yes" : "no"}`
    : "";

  // Resolve the Base MCP access token from cookies. When present (and the
  // feature flag is on), we ask Claude to call out to mcp.base.org as an
  // additional tool source — swaps, lending, vault yields, etc. become
  // available through the chat. When absent, we keep the existing native
  // tool path exactly as before. Failure to resolve a token is silent —
  // the chat just falls back to the native-only experience.
  const mcpEnabled = process.env.ENABLE_BASE_MCP === "true";
  const baseMcpToken = mcpEnabled ? await readAccessToken(req, res) : null;
  const mcpServers = baseMcpToken
    ? [
        {
          type: "url" as const,
          url: BASE_MCP_ISSUER,
          name: "base-mcp",
          authorization_token: baseMcpToken,
        },
      ]
    : undefined;
  const systemPrompt = mcpServers ? BASE_MCP_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;
  console.log("[AI Chat] base-mcp attached:", !!mcpServers, "mcpEnabled:", mcpEnabled);

  try {
    const client = new Anthropic({ apiKey });

    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: "user",
        content: message + userContext,
      },
    ];

    let finalReply = "";
    let action: { type: string; params?: Record<string, string> } | undefined;
    const MAX_ITERATIONS = 3;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const baseParams = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        tools: BLOCKCHAIN_TOOLS,
        messages,
      } as const;

      const response = mcpServers
        ? await client.beta.messages.create({
            ...baseParams,
            mcp_servers: mcpServers,
            betas: ["mcp-client-2025-11-20"],
          } as any)
        : await client.messages.create(baseParams);

      if (mcpServers) {
        const blockTypes = response.content.map((b: any) => b.type).join(",");
        console.log(
          "[AI Chat] response blocks:",
          blockTypes,
          "stop_reason:",
          response.stop_reason,
        );
      }

      // Collect text blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );
      if (textBlocks.length > 0) {
        finalReply += textBlocks.map((b) => b.text).join(" ");
      }

      // Check for tool_use blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      // If no tool calls or end_turn, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Execute each tool call
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          {
            walletAddress: context?.walletAddress,
            balance: context?.balance,
            chain: context?.chain,
            isConnected: context?.isConnected,
          }
        );

        // Check if the tool returned an action for the frontend
        try {
          const parsed = JSON.parse(result);
          if (parsed.action && !action) {
            action = {
              type: parsed.action,
              params: parsed.params,
            };
          }
        } catch {
          // Not JSON or no action — that's fine
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add assistant response and tool results to continue the conversation.
      // Cast to `any` because the beta response shape may include MCP-specific
      // block types (mcp_tool_use / mcp_tool_result) that the non-beta param
      // types don't know about, but are accepted at runtime.
      messages.push({ role: "assistant", content: response.content as any });
      messages.push({ role: "user", content: toolResults });
    }

    return res.status(200).json({
      reply: finalReply || "I processed your request.",
      ...(action ? { action } : {}),
    });
  } catch (error: any) {
    console.error("[AI Chat] Error:", error.message);
    return res.status(500).json({
      reply: "Sorry, I'm having trouble right now. Please try again.",
      error: error.message,
    });
  }
}
