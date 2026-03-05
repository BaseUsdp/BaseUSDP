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

const SYSTEM_PROMPT = `You are the AI assistant for BASEUSDP — a confidential payment platform on Base (Ethereum L2). You help users manage their wallet, send payments, check balances, and navigate the dashboard.

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
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: BLOCKCHAIN_TOOLS,
        messages,
      });

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

      // Add assistant response and tool results to continue the conversation
      messages.push({ role: "assistant", content: response.content });
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
