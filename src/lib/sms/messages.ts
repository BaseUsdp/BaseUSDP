/**
 * Mirror of api/lib/sms/messages.ts kept in lockstep with the server.
 *
 * The sender signs buildSendCommitment(...) at send time; the recipient
 * signs buildClaimCommitment(...) at claim time. Both are EIP-191 personal
 * sign messages — no wallets need to support typed data.
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
