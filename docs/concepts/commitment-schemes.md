# Commitment Schemes

## What is a Commitment Scheme?
A commitment scheme is a cryptographic primitive that allows you to commit to a value while keeping it hidden, with the ability to reveal it later. Think of it as placing a value in a sealed envelope — once sealed, the value cannot be changed (binding), and others cannot see the value until you open it (hiding).

## Pedersen Commitments in BaseUSDP
BaseUSDP uses Pedersen commitments for deposit notes:

```
commitment = PedersenHash(secret, nullifier)
```

### Properties
- **Hiding:** The commitment reveals nothing about the secret or nullifier
- **Binding:** It is computationally infeasible to find a different secret/nullifier pair that produces the same commitment
- **Homomorphic:** Pedersen commitments support addition, which can be useful for batch operations

## The Deposit Note
When you make a deposit, the resulting note contains:
- The secret (random 256-bit value)
- The nullifier preimage (random 256-bit value)
- The commitment (hash of both)
- The tier and amount
- The leaf index in the Merkle tree

This note is your proof of deposit and must be kept secret and safe.

## Why Not SHA-256?
While SHA-256 is a well-known hash function, it requires approximately 25,000 constraints in a ZK-SNARK circuit. Pedersen hashing requires only about 750 constraints, making proofs much faster to generate and cheaper to verify on-chain.
