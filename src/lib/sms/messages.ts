/**
 * Canonical claim message — must match SMSEscrow.claimMessage(bytes32,address).
 *
 *   BASEUSDP SMS Claim v1
 *   ClaimToken: 0x<64-hex-lowercase>
 *   Recipient: 0x<40-hex-lowercase>
 *
 * The recipient personal_signs this string; the contract recovers the
 * signer with ECDSA + the EIP-191 prefix and asserts equality with
 * msg.sender. Any drift between this format and the Solidity helper
 * breaks claim — keep them aligned.
 */

export function buildClaimCommitment(args: {
  claimToken: `0x${string}`;
  recipient: `0x${string}`;
}): string {
  return [
    "BASEUSDP SMS Claim v1",
    `ClaimToken: ${args.claimToken.toLowerCase()}`,
    `Recipient: ${args.recipient.toLowerCase()}`,
  ].join("\n");
}
