# Merkle Trees in BaseUSDP

## What is a Merkle Tree?
A Merkle tree is a binary tree data structure where every leaf node contains the hash of a data block, and every non-leaf node contains the hash of its children. The root hash uniquely represents all the data in the tree.

## How BaseUSDP Uses Merkle Trees
BaseUSDP maintains a Merkle tree of all deposits. When a user makes a deposit, a commitment (hash of the deposit secret) is added as a leaf to the tree.

### Deposit
When you deposit, your commitment is inserted at the next available leaf position:
```
Root = H(H(H(C1, C2), H(C3, C4)), H(H(C5, C6), H(C7, YOUR_COMMITMENT)))
```

### Proof Generation
To prove you made a deposit without revealing which one, you provide a Merkle proof (the sibling hashes along the path from your leaf to the root). The ZK circuit verifies this path without revealing your leaf position.

## Tree Parameters
- **Height:** 20 levels
- **Capacity:** 2^20 = 1,048,576 deposits
- **Hash function:** Poseidon (ZK-friendly hash)
- **Updates:** Append-only (deposits cannot be removed)

## On-Chain Storage
Only the current root hash is stored on-chain. The full tree state is maintained by the relayer and can be independently reconstructed from on-chain deposit events.

## Why Poseidon?
BaseUSDP uses the Poseidon hash function because it is highly efficient inside ZK-SNARK circuits, requiring significantly fewer constraints than SHA-256 or Keccak.
