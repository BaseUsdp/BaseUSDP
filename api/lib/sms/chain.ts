/**
 * Server-side chain helpers for the SMS layer.
 *
 * Used by /api/sms/dispatch to verify an on-chain deposit exists before
 * sending an SMS. We talk to Base via a public RPC (or BASE_RPC_URL if set);
 * no private key is held server-side for this path — the contract is the
 * source of truth, the server is only a notification dispatcher.
 */

import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
} from "viem";
import { base } from "viem/chains";

export const USDC_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// The SMSEscrow address on Base is hardcoded as a fallback so this works
// even if the env var pipeline is misbehaving (Vercel has, on at least one
// occasion, lost a piped value silently). Env var still takes precedence so
// future redeploys can point at a new address without a code change.
const FALLBACK_SMS_ESCROW: Address =
  "0x0Ffa490E8747341dc707d7cFADC74076e0E125E0";

export function getEscrowAddress(): Address {
  const a = process.env.SMS_ESCROW_ADDRESS;
  if (a && /^0x[a-fA-F0-9]{40}$/.test(a)) return a as Address;
  return FALLBACK_SMS_ESCROW;
}

const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

export const SMS_ESCROW_ABI = [
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "claimToken", type: "bytes32" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "expiresAt", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "recipient", type: "address" },
    ],
  },
] as const;

export type OnChainStatus = "none" | "pending" | "claimed" | "refunded";
const STATUS_MAP: OnChainStatus[] = ["none", "pending", "claimed", "refunded"];

export interface ChainEscrow {
  sender: Address;
  amount: bigint;
  amountUsdc: string;
  expiresAt: number;
  status: OnChainStatus;
  recipient: Address;
}

export async function readEscrow(
  claimToken: `0x${string}`
): Promise<ChainEscrow | null> {
  const [sender, amount, expiresAt, status, recipient] =
    (await publicClient.readContract({
      address: getEscrowAddress(),
      abi: SMS_ESCROW_ABI,
      functionName: "getEscrow",
      args: [claimToken],
    } as any)) as readonly [Address, bigint, bigint, number, Address];

  const s = STATUS_MAP[status] ?? "none";
  if (s === "none") return null;
  return {
    sender,
    amount,
    amountUsdc: formatUnits(amount, 6),
    expiresAt: Number(expiresAt),
    status: s,
    recipient,
  };
}
