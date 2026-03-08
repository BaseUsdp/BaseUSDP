/**
 * Tweet Payment Parser
 * Pure function that extracts payment commands from tweet text.
 *
 * Supported formats:
 *   @BaseUSDPbot send 5 USDC to @alice
 *   @BaseUSDPbot pay @bob 10
 *   @BaseUSDPbot tip @charlie 2.50
 *   @BaseUSDPbot send @alice 5 USDT
 */

export interface ParsedTweetPayment {
  recipientUsername: string;
  amount: number;
  token: "USDC" | "USDT";
}

const SUPPORTED_TOKENS = ["USDC", "USDT"] as const;
const MAX_AMOUNT = 10000;

/**
 * Parse a tweet text for a payment command.
 * Returns null if the text is not a valid payment command.
 */
export function parseTweetPayment(text: string): ParsedTweetPayment | null {
  if (!text) return null;

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();

  // Pattern 1: @BaseUSDPbot send 5 USDC to @alice
  //            @BaseUSDPbot pay 10 USDT to @bob
  //            @BaseUSDPbot tip 2.50 to @charlie
  const patternAmountFirst =
    /(?:^|\s)@BaseUSDPbot\s+(?:send|pay|tip)\s+(\d+(?:\.\d{1,2})?)\s*(USDC|USDT)?\s+to\s+@(\w+)/i;

  // Pattern 2: @BaseUSDPbot pay @bob 10
  //            @BaseUSDPbot send @alice 5 USDT
  //            @BaseUSDPbot tip @charlie 2.50 USDC
  const patternRecipientFirst =
    /(?:^|\s)@BaseUSDPbot\s+(?:send|pay|tip)\s+@(\w+)\s+(\d+(?:\.\d{1,2})?)\s*(USDC|USDT)?/i;

  let recipientUsername: string;
  let amountStr: string;
  let tokenStr: string | undefined;

  const match1 = normalized.match(patternAmountFirst);
  if (match1) {
    amountStr = match1[1];
    tokenStr = match1[2];
    recipientUsername = match1[3];
  } else {
    const match2 = normalized.match(patternRecipientFirst);
    if (match2) {
      recipientUsername = match2[1];
      amountStr = match2[2];
      tokenStr = match2[3];
    } else {
      return null;
    }
  }

  // Default to USDC if no token specified
  const token = tokenStr
    ? (tokenStr.toUpperCase() as "USDC" | "USDT")
    : "USDC";

  if (!SUPPORTED_TOKENS.includes(token)) {
    return null;
  }

  const amount = parseFloat(amountStr);

  // Validate amount
  if (isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return null;
  }

  // Ensure max 2 decimal places
  if (amountStr.includes(".") && amountStr.split(".")[1].length > 2) {
    return null;
  }

  return {
    recipientUsername: recipientUsername.toLowerCase(),
    amount,
    token,
  };
}
