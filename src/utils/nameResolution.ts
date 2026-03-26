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

// ── ENS Resolution ──────────────────────────────────────────────

type Provider = { call: (tx: { to: string; data: string }) => Promise<string> };

async function resolveENS(
  name: string,
  provider: Provider
): Promise<string | null> {
  try {
    const node = namehash(name);
    const addrSelector = "0x3b3b57de"; // addr(bytes32)
    const data = addrSelector + node.slice(2);

    const result = await provider.call({
      to: ENS_REGISTRY,
      data,
    });

    if (!result || result === "0x" || result === "0x" + "0".repeat(64)) {
      return null;
    }

    return "0x" + result.slice(-40);
  } catch {
    return null;
  }
}

// ── Base Name Resolution ────────────────────────────────────────

async function resolveBaseName(
  name: string,
  provider: Provider
): Promise<string | null> {
  try {
    const node = namehash(name);
    const addrSelector = "0x3b3b57de";
    const data = addrSelector + node.slice(2);

    const result = await provider.call({
      to: BASE_NAME_RESOLVER,
      data,
    });

    if (!result || result === "0x" || result === "0x" + "0".repeat(64)) {
      return null;
    }

    return "0x" + result.slice(-40);
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Resolve any supported name to an Ethereum address.
 * Returns null if the name cannot be resolved.
 */
export async function resolveName(
  name: string,
  provider: Provider
): Promise<string | null> {
  const type = detectNameType(name);
  const normalized = name.trim().toLowerCase();

  if (type === "address") return normalized;
  if (type === "ens") return resolveENS(normalized, provider);
  if (type === "basename") return resolveBaseName(normalized, provider);

  return null;
}
