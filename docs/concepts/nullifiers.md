# Nullifiers and Double-Spend Prevention

## The Double-Spend Problem
In a privacy pool, if there is no way to track which deposits have been spent, a user could potentially withdraw the same deposit multiple times.

## How Nullifiers Solve This
Each deposit generates a unique nullifier — a hash derived from the deposit secret. When spending a deposit, the nullifier is revealed and recorded on-chain.

### Deposit Phase
```
secret = random()
nullifier_preimage = random()
commitment = hash(secret, nullifier_preimage)
```

### Spending Phase
```
nullifier_hash = hash(nullifier_preimage)
// nullifier_hash is published on-chain
```

## How It Works
1. When you create a deposit, you generate a secret and a nullifier preimage
2. The commitment (hash of both values) is added to the Merkle tree
3. When you spend the deposit, you reveal the nullifier hash (not the preimage)
4. The smart contract checks that this nullifier has never been used before
5. If unused, the transaction proceeds and the nullifier is stored
6. If already used, the transaction is rejected (preventing double-spend)

## Privacy Preservation
The nullifier hash cannot be linked back to the original commitment because:
- The nullifier preimage is never revealed
- The hash function is one-way
- The ZK proof demonstrates knowledge of the preimage without revealing it

## On-Chain Storage
Spent nullifiers are stored in a mapping: `mapping(bytes32 => bool) public nullifierHashes`

This is the only spending-related data stored on-chain.
