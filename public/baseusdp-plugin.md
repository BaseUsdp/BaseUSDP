# BASEUSDP — Base MCP plugin

**Summary.** BASEUSDP is a confidential payments app on Base focused on
USDC/USDT tips, payment requests, and streamer-friendly tip overlays. This
plugin exposes BASEUSDP's public surface to AI agents connected via Base
MCP — letting them resolve @handles, tip creators, create shareable
payment requests, and read recent tip activity, all in natural language.

**Maintainer.** baseusdp@proton.me
**Site.** https://baseusdp.com
**Endpoint base.** https://baseusdp.com/api/mcp

This plugin is **non-custodial**. Write tools return unsigned ERC-20
calldata for the user's wallet to broadcast via `send_calls`. The user's
funds never touch BASEUSDP servers.

---

## Tools

### `baseusdp.resolve_handle`

Resolve a BASEUSDP @handle to its on-chain wallet address.

- **Method.** `GET /api/mcp/resolve-handle?handle=<handle>`
- **Use when.** The user references a creator by @handle and you need the
  wallet behind it to look up balances, history, or to construct another
  tx.
- **Response.**
  ```json
  {
    "success": true,
    "handle": "@jesse",
    "address": "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1",
    "profilePicture": "https://..."
  }
  ```
- **Errors.** `404` if the handle is not registered.

### `baseusdp.send_tip` (write)

Build an unsigned ERC-20 transfer to a BASEUSDP creator. Returns
calldata to feed into `send_calls`; the user signs in their Base Account.

- **Method.** `POST /api/mcp/send-tip`
- **Body.**
  ```json
  {
    "recipient": "@jesse"            // or a raw 0x address
    "amount":    "5.00",             // decimal string in token units
    "token":     "USDC"              // optional, default "USDC", also accepts "USDT"
  }
  ```
- **Response.**
  ```json
  {
    "success": true,
    "chain":   "base",
    "calls": [
      {
        "to":    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "value": "0x0",
        "data":  "0xa9059cbb..."
      }
    ],
    "recipient": { "handle": "@jesse", "address": "0x849151..." },
    "amountWei": "5000000",
    "token":     "USDC"
  }
  ```
- **Plugin flow.**
  1. Resolve the recipient (`baseusdp.send_tip` does this internally).
  2. Forward the returned `chain` + `calls` directly to Base MCP's
     `send_calls` tool.
  3. Wait for the user to approve in Base Account.
  4. Poll `wallet_getCallsStatus` until the transfer confirms.

### `baseusdp.create_payment_request`

Create a shareable BASEUSDP `/pay/:id` link. Useful for "give me a link
so I can collect $20 from someone" or "build me an invoice for X".

- **Method.** `POST /api/mcp/create-payment-request`
- **Body.**
  ```json
  {
    "recipient":    "@jesse"        // or a raw 0x address
    "amount":       "20.00",
    "token":        "USDC",          // optional
    "service_name": "Consulting hour", // optional, shown on the pay page
    "description":  "1h call"
  }
  ```
- **Response.**
  ```json
  {
    "success":      true,
    "paymentId":    "x402_abc123def",
    "shareableUrl": "https://baseusdp.com/pay/x402_abc123def",
    "recipient":    { "handle": "@jesse", "address": "0x849151..." },
    "amount":       20.00,
    "token":        "USDC"
  }
  ```
- **Plugin flow.** Return the `shareableUrl` to the user so they can paste
  it into chat, email, or a social post. The link's recipient can pay it
  in-app at baseusdp.com or via an embedded paywall.

### `baseusdp.list_recent_tips`

Read recent incoming tips to a BASEUSDP creator. Returns sender handle
(when known), amount, token, memo, and timestamp.

- **Method.** `GET /api/mcp/list-recent-tips?handle=<handle>&limit=<n>`
- **Params.** `handle` (required), `limit` (optional, 1-50, default 10).
- **Response.**
  ```json
  {
    "success": true,
    "handle":  "@jesse",
    "tips": [
      {
        "sender_handle":  "@alice",
        "sender_address": "0x...",
        "amount":          5.0,
        "token":           "USDC",
        "memo":            "great stream!",
        "created_at":      "2026-05-27T01:23:45.000Z"
      }
    ]
  }
  ```

---

## Example prompts

- *"Tip @jesse 5 USDC for the talk."* → `baseusdp.send_tip` → user approves
  in Base Account → done.
- *"Make me a $50 payment link for the consulting hour with description
  'website review'."* → `baseusdp.create_payment_request` → return URL.
- *"Who tipped me in the last hour?"* → `baseusdp.list_recent_tips`.
- *"What's @jesse's wallet?"* → `baseusdp.resolve_handle`.

## Approval & custody

- All writes return unsigned calldata; the user's wallet signs and
  broadcasts via Base MCP's `send_calls`.
- Reads are public — no authentication is required and no PII is
  surfaced beyond the data already shown on the public OBS overlay
  endpoint (`/api/overlay/recent`).

## Rate limits

This plugin is currently unmetered. The endpoints are co-located with the
rest of the BASEUSDP backend and inherit its general rate posture.
Heavy automated callers should email baseusdp@proton.me to discuss a
higher tier if needed.
