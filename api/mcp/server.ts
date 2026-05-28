/**
 * POST /api/mcp/server — BASEUSDP MCP server (streamable HTTP, stateless).
 *
 * Implements the Model Context Protocol JSON-RPC surface so any MCP client
 * (Claude, ChatGPT, Cursor, the official MCP registry, etc.) can discover
 * and call BASEUSDP tools with zero setup. Stateless: every request is
 * self-contained, which suits Vercel's serverless model.
 *
 * Supported methods:
 *   - initialize
 *   - notifications/initialized      (notification, 202 no body)
 *   - tools/list
 *   - tools/call
 *   - ping
 *
 * Tools delegate to api/lib/mcp-tools.ts, which enforces the per-user
 * mcp_enabled opt-in. Non-custodial: write tools return unsigned calldata
 * the user's wallet signs elsewhere.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  ToolError,
  buildTipCalldata,
  createPaymentRequest,
  listRecentTips,
  resolveHandle,
} from "../lib/mcp-tools.js";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "baseusdp", version: "1.0.0" };

const TOOLS = [
  {
    name: "resolve_handle",
    description:
      "Resolve a BASEUSDP @handle to its on-chain wallet address on Base. Only works for users who have enabled AI assistant access.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "A BASEUSDP @handle, e.g. @jesse" },
      },
      required: ["handle"],
    },
  },
  {
    name: "send_tip",
    description:
      "Build an unsigned ERC-20 USDC/USDT transfer to tip a BASEUSDP creator on Base. Returns calldata to submit via the wallet's send_calls — non-custodial, the user signs.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "A @handle or a raw 0x address" },
        amount: { type: "string", description: "Decimal amount, e.g. \"5.00\"" },
        token: { type: "string", enum: ["USDC", "USDT"], description: "Default USDC" },
      },
      required: ["recipient", "amount"],
    },
  },
  {
    name: "create_payment_request",
    description:
      "Create a shareable BASEUSDP payment request and return a /pay/:id URL anyone can use to pay the recipient in USDC/USDT on Base.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "A @handle or a raw 0x address" },
        amount: { type: "string", description: "Decimal amount, e.g. \"20.00\"" },
        token: { type: "string", enum: ["USDC", "USDT"] },
        service_name: { type: "string", description: "Label shown on the pay page" },
        description: { type: "string" },
      },
      required: ["recipient", "amount"],
    },
  },
  {
    name: "list_recent_tips",
    description:
      "List recent incoming tips to a BASEUSDP creator: sender handle, amount, token, memo, timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "A @handle or 0x address" },
        limit: { type: "integer", description: "1-50, default 10" },
      },
      required: ["handle"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
function toolResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

async function dispatchTool(
  name: string,
  args: Record<string, any>,
  origin: string,
): Promise<unknown> {
  switch (name) {
    case "resolve_handle":
      return toolResult(await resolveHandle(args.handle));
    case "send_tip":
      return toolResult(
        await buildTipCalldata({
          recipient: args.recipient,
          amount: args.amount,
          token: args.token,
        }),
      );
    case "create_payment_request":
      return toolResult(
        await createPaymentRequest({
          recipient: args.recipient,
          amount: args.amount,
          token: args.token,
          service_name: args.service_name,
          description: args.description,
          origin,
        }),
      );
    case "list_recent_tips":
      return toolResult(
        await listRecentTips({ handle: args.handle, limit: args.limit }),
      );
    default:
      throw new ToolError(`Unknown tool: ${name}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    // Streamable HTTP GET (server-initiated SSE) is not supported — stateless.
    return res.status(405).json(rpcError(null, -32601, "Only POST is supported"));
  }

  const host = req.headers.host || "baseusdp.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const message = req.body;
  if (!message || typeof message !== "object") {
    return res.status(400).json(rpcError(null, -32700, "Parse error"));
  }

  const { id, method, params } = message as {
    id?: unknown;
    method?: string;
    params?: any;
  };

  // Notifications (no id) — acknowledge with 202, no body.
  if (method && method.startsWith("notifications/")) {
    return res.status(202).end();
  }

  try {
    switch (method) {
      case "initialize":
        return res.status(200).json(
          rpcResult(id, {
            protocolVersion:
              typeof params?.protocolVersion === "string"
                ? params.protocolVersion
                : PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          }),
        );

      case "ping":
        return res.status(200).json(rpcResult(id, {}));

      case "tools/list":
        return res.status(200).json(rpcResult(id, { tools: TOOLS }));

      case "tools/call": {
        const name = params?.name as string;
        const args = (params?.arguments ?? {}) as Record<string, any>;
        if (!name) {
          return res
            .status(200)
            .json(rpcError(id, -32602, "Missing tool name"));
        }
        try {
          const result = await dispatchTool(name, args, origin);
          return res.status(200).json(rpcResult(id, result));
        } catch (err: any) {
          // Tool-level errors are returned as a successful JSON-RPC result
          // with isError:true so the model sees them, per MCP convention.
          const msg =
            err instanceof ToolError
              ? err.message
              : "Internal error executing tool";
          if (!(err instanceof ToolError)) {
            console.error("[mcp/server] tool error:", err?.message || err);
          }
          return res
            .status(200)
            .json(rpcResult(id, toolResult({ error: msg }, true)));
        }
      }

      default:
        return res
          .status(200)
          .json(rpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (err: any) {
    console.error("[mcp/server] fatal:", err?.message || err);
    return res.status(200).json(rpcError(id, -32603, "Internal error"));
  }
}
