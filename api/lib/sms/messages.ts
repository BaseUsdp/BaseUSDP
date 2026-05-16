/**
 * Canonical EIP-191 messages used by the SMS layer.
 *
 * Both sender (at send time) and recipient (at claim time) sign a structured
 * plaintext message that includes everything that matters for the operation.
 * Keeping the format here keeps client + server in sync.
 */

export function buildSendCommitment(args: {
  phoneHash: string;
  amount: string;
  claimToken: string;
}): string {
  return [
    "BASEUSDP SMS Send v1",
    `PhoneHash: ${args.phoneHash.toLowerCase()}`,
    `Amount: ${args.amount}`,
    `ClaimToken: ${args.claimToken.toLowerCase()}`,
  ].join("\n");
}

export function buildClaimCommitment(args: {
  claimToken: string;
  recipient: string;
}): string {
  return [
    "BASEUSDP SMS Claim v1",
    `ClaimToken: ${args.claimToken.toLowerCase()}`,
    `Recipient: ${args.recipient.toLowerCase()}`,
  ].join("\n");
}
