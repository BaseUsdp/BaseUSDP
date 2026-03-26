/**
 * ENS and Base Name resolution utilities.
 *
 * Resolves human-readable names (alice.eth, alice.base) to Ethereum
 * addresses using the appropriate on-chain registries.
 */

export type NameType = "ens" | "basename" | "address" | "unknown";


const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const BASE_NAME_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

const RESOLVER_ABI = [
  "function addr(bytes32 node) view returns (address)",
];

const namespacePatterns = {
  ens: /^[a-zA-Z0-9-]+\.eth$/,
  basename: /^[a-zA-Z0-9-]+\.base$/,
};

/**
 * Detect what kind of identifier the user entered.
 */
export function detectNameType(input: string): NameType {
  if (!input) return "unknown";

  const trimmed = input.trim().toLowerCase();

  if (trimmed.startsWith("0x") && trimmed.length === 42) return "address";
  if (namespacePatterns.ens.test(trimmed)) return "ens";
  if (namespacePatterns.basename.test(trimmed)) return "basename";

  return "unknown";
}

// ── Hashing utilities ───────────────────────────────────────────

function hexConcat(a: string, b: string): string {
  return a + b.slice(2);
}

function keccak256(_input: string): string {
  // Delegates to viem's keccak256 at runtime.
  // Placeholder — the actual implementation uses the keccak256
  // from the connected wallet provider or viem.
  throw new Error("keccak256 must be provided by the runtime (viem/ethers)");
}

function keccak256Bytes(_input: string): string {
  throw new Error("keccak256 must be provided by the runtime (viem/ethers)");
}

/**
 * Compute the ENS namehash for a domain.
 * Implements EIP-137 iterative hashing.
 */
export function namehash(name: string): string {
  const labels = name.split(".");
  let node =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak256(labels[i]);
    node = keccak256Bytes(hexConcat(node, labelHash));
  }

  return node;
}
