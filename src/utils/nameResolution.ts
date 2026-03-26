/**
 * ENS and Base Name resolution utilities.
 *
 * Resolves human-readable names (alice.eth, alice.base) to Ethereum
 * addresses using the appropriate on-chain registries.
 */

export type NameType = "ens" | "basename" | "address" | "unknown";

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
