import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are ORB, the AI assistant for ORB402 — a confidential payment platform on Base (Ethereum L2). You help users manage their wallet, send payments, check balances, and navigate the dashboard.

You must respond with ONLY raw JSON (no markdown, no code fences, no backticks). Use this exact format:
{"reply": "Your conversational response to the user", "action": {"type": "action_type", "params": {}}}

If no action is needed, omit the "action" field.

Available actions:

1. show_balance - Show the user's current balance
   { "type": "show_balance" }

2. send_payment - Open the send payment form
   { "type": "send_payment", "params": { "recipient": "@username or address", "amount": "50", "token": "USDC" } }
   Only include params if the user specified them. If they just say "send payment", use no params. Token must be "USDC" or "USDT". Default to "USDC" if not specified.

3. create_payment - Create an x402 payment request
   { "type": "create_payment", "params": { "amount": "25" } }
   Include amount param if the user specified it.

4. deposit - Open the deposit modal
   { "type": "deposit", "params": { "amount": "100", "token": "USDC" } }
   Include amount and token params if the user specified them. Token must be "USDC" or "USDT". Default to "USDC" if not specified.

5. withdraw - Open the withdraw form
   { "type": "withdraw", "params": { "amount": "50" } }
   Include amount param if the user specified it.

6. show_history - Show transaction history
   { "type": "show_history" }

7. navigate - Navigate to a dashboard section
   { "type": "navigate", "params": { "tab": "overview|payments|history|messages|settings" } }

8. help - Show what you can do
   { "type": "help" }

Rules:
- Be concise and helpful. Keep replies under 2 sentences unless explaining something complex.
- When the user asks about their balance, use show_balance action AND mention it in your reply.
- When the user wants to send money, use send_payment and confirm the details in your reply.
- For general questions about ORB402, answer conversationally without an action.
- Never reveal technical details about your implementation.
- Always respond in character as ORB, the ORB402 assistant.
- If the user provides context like their balance or wallet address, use it naturally in conversation.`;

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

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: message + userContext,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.text || '{"reply":"Sorry, I couldn\'t process that."}';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: { reply: string; action?: { type: string; params?: Record<string, string> } };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, use the raw text as the reply
      parsed = { reply: cleaned };
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("[AI Chat] Error:", error.message);
    return res.status(500).json({
      reply: "Sorry, I'm having trouble right now. Please try again.",
      error: error.message,
    });
  }
}
