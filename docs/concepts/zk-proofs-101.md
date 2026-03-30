# Zero-Knowledge Proofs 101

## What is a Zero-Knowledge Proof?
A zero-knowledge proof (ZKP) is a cryptographic method that allows one party (the prover) to convince another party (the verifier) that a statement is true without revealing any information beyond the truth of the statement itself.

## How BaseUSDP Uses ZK Proofs
In BaseUSDP, zero-knowledge proofs enable private transactions:

1. **Deposit Phase:** You deposit USDC into a privacy pool and receive a secret note
2. **Proof Generation:** When you want to transfer, your browser generates a ZK proof that you know the secret for one of the deposits in the pool — without revealing which one
3. **Verification:** The smart contract verifies the proof on-chain and releases funds to the recipient

## Types of ZK Proofs
- **ZK-SNARKs** (Succinct Non-interactive Arguments of Knowledge) — What BaseUSDP uses. They are small in size and quick to verify on-chain.
- **ZK-STARKs** — Larger proofs but no trusted setup required
- **Bulletproofs** — Compact range proofs used in some privacy coins

## The Trusted Setup
ZK-SNARKs require a one-time trusted setup ceremony to generate proving and verification keys. BaseUSDP uses a multi-party computation ceremony where the toxic waste is destroyed as long as at least one participant is honest.

## Performance
- Proof generation: 5-15 seconds in the browser using WebAssembly
- Proof verification: < 300,000 gas on-chain (about $0.005 on Base)
- Proof size: approximately 256 bytes

## Security Guarantees
- **Soundness:** It is computationally infeasible to create a valid proof without knowing the secret
- **Zero-knowledge:** The proof reveals nothing about which deposit is being spent
- **Completeness:** A valid proof will always be accepted by the verifier
