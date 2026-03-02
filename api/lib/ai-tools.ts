/**
 * Claude tool definitions for the AI Terminal
 * These are passed to Claude's tool_use API so the terminal can
 * interact with ORB402 and Base blockchain features.
 */
import type Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Messages.Tool;

export const BLOCKCHAIN_TOOLS: Tool[] = [
  {
    name: "check_balance",
    description:
      "Check the user's ORB402 privacy pool balance. Returns USDC and USDT balances.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: {
          type: "string",
          enum: ["USDC", "USDT"],
          description:
            "Optional specific token to check. If omitted, returns both.",
        },
      },
      required: [],
    },
  },
  {
    name: "send_payment",
    description:
      "Open the send payment form pre-filled with details. The user will still confirm before sending.",
    input_schema: {
      type: "object" as const,
      properties: {
        recipient: {
          type: "string",
          description: "Username (@user) or 0x wallet address",
        },
        amount: {
          type: "string",
          description: "Amount to send (e.g. '50')",
        },
        token: {
          type: "string",
          enum: ["USDC", "USDT"],
          description: "Token to send. Default USDC.",
        },
      },
      required: [],
    },
  },
  {
    name: "deposit",
    description:
      "Open the deposit form so the user can deposit funds into the ORB402 privacy pool.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "string",
          description: "Amount to deposit",
        },
        token: {
          type: "string",
          enum: ["USDC", "USDT"],
          description: "Token to deposit. Default USDC.",
        },
      },
      required: [],
    },
  },
  {
    name: "withdraw",
    description:
      "Open the withdraw form so the user can withdraw from the ORB402 privacy pool.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "string",
          description: "Amount to withdraw",
        },
        token: {
          type: "string",
          enum: ["USDC", "USDT"],
          description: "Token to withdraw. Default USDC.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_transaction_history",
    description:
      "Get the user's recent ORB402 transaction history (deposits, withdrawals, transfers).",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of transactions to return (max 10, default 5)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_token_info",
    description:
      "Get basic info about a token on Base network, including its contract address.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description:
            "Token symbol (e.g. USDC, USDT, ETH, WETH, DAI)",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "create_payment",
    description:
      "Open the x402 payment request form so the user can create a payment link.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "string",
          description: "Requested payment amount",
        },
      },
      required: [],
    },
  },
  {
    name: "navigate",
    description:
      "Navigate the user to a specific section of the ORB402 dashboard.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "overview",
            "payments",
            "history",
            "settings",
            "agents",
            "withdraw",
          ],
          description: "Dashboard section to navigate to",
        },
      },
      required: ["section"],
    },
  },
];
