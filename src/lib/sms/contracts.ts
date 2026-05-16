/**
 * Frontend chain bindings for the SMS layer.
 *
 * Contract addresses are pinned to Base mainnet. The escrow address is
 * read from a build-time env var so it can change per environment without
 * a code edit.
 *
 * Build marker: v2 (2026-05-16) — Vercel cache buster.
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  maxUint256,
  type Address,
} from "viem";
import { base } from "viem/chains";

export const USDC_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Hardcoded fallback so this works even if Vercel's build env pipeline
// drops the VITE_SMS_ESCROW_ADDRESS value (it has, more than once).
const FALLBACK_SMS_ESCROW: Address =
  "0x0Ffa490E8747341dc707d7cFADC74076e0E125E0";
const envEscrow = import.meta.env.VITE_SMS_ESCROW_ADDRESS as string | undefined;
export const SMS_ESCROW_ADDRESS: Address =
  envEscrow && /^0x[a-fA-F0-9]{40}$/.test(envEscrow)
    ? (envEscrow as Address)
    : FALLBACK_SMS_ESCROW;

export const USDC_DECIMALS = 6;

/** Public RPC for reads. For writes the user's wallet provider does the RPC. */
export const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// ---------------------------------------------------------------------------
// Minimal ABIs (only the entry points we touch)
// ---------------------------------------------------------------------------

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const SMS_ESCROW_ABI = [
  {
    type: "function",
    name: "depositFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimToken", type: "bytes32" },
      { name: "amount", type: "uint96" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimToken", type: "bytes32" },
      { name: "recipientSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "claimToken", type: "bytes32" }],
    outputs: [],
  },
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
  {
    type: "function",
    name: "EXPIRY_SECONDS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

export type OnChainStatus = "none" | "pending" | "claimed" | "refunded";

const STATUS_MAP: OnChainStatus[] = [
  "none",
  "pending",
  "claimed",
  "refunded",
];

export interface ChainEscrow {
  sender: Address;
  amount: bigint;
  amountUsdc: string;
  expiresAt: number; // unix seconds
  status: OnChainStatus;
  recipient: Address;
}

export async function readEscrow(claimToken: `0x${string}`): Promise<ChainEscrow | null> {
  if (!SMS_ESCROW_ADDRESS) throw new Error("VITE_SMS_ESCROW_ADDRESS not set");
  const [sender, amount, expiresAt, status, recipient] =
    (await publicClient.readContract({
      address: SMS_ESCROW_ADDRESS,
      abi: SMS_ESCROW_ABI,
      functionName: "getEscrow",
      args: [claimToken],
    } as any)) as readonly [Address, bigint, bigint, number, Address];

  const s = STATUS_MAP[status] ?? "none";
  if (s === "none") return null;
  return {
    sender,
    amount,
    amountUsdc: formatUnits(amount, USDC_DECIMALS),
    expiresAt: Number(expiresAt),
    status: s,
    recipient,
  };
}

export async function readAllowance(owner: Address): Promise<bigint> {
  if (!SMS_ESCROW_ADDRESS) throw new Error("VITE_SMS_ESCROW_ADDRESS not set");
  return (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, SMS_ESCROW_ADDRESS],
  } as any)) as bigint;
}

export async function readUsdcBalance(owner: Address): Promise<bigint> {
  return (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  } as any)) as bigint;
}

// ---------------------------------------------------------------------------
// Calldata encoders for wallet eth_sendTransaction
// ---------------------------------------------------------------------------

export function encodeApprove(spender: Address, amount: bigint = maxUint256) {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
}

export function encodeDepositFor(claimToken: `0x${string}`, amount: bigint) {
  return encodeFunctionData({
    abi: SMS_ESCROW_ABI,
    functionName: "depositFor",
    args: [claimToken, amount],
  });
}

export function encodeClaim(claimToken: `0x${string}`, sig: `0x${string}`) {
  return encodeFunctionData({
    abi: SMS_ESCROW_ABI,
    functionName: "claim",
    args: [claimToken, sig],
  });
}

export function encodeRefund(claimToken: `0x${string}`) {
  return encodeFunctionData({
    abi: SMS_ESCROW_ABI,
    functionName: "refund",
    args: [claimToken],
  });
}

/** Convert a USDC decimal string (e.g. "1.25") to base units. */
export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}
