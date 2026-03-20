# Privacy Model

BASEUSDP implements a three-tier privacy model for stablecoin transactions on Base. This document explains how each tier works and when to use it.

## The Problem

Standard ERC-20 transfers on any EVM chain are fully transparent. When you send USDC to someone, the following is permanently visible to anyone:

- Your wallet address
- The recipient's wallet address
- The exact amount transferred
- Your current balance
- Your entire transaction history

This is equivalent to publishing your bank statement on the internet every time you make a payment.

## Privacy Tiers

### Tier 1: Public

Standard on-chain ERC-20 transfer. No privacy enhancements.

**How it works:** Direct `transfer()` call on the USDC contract.

**What's visible:** Everything — sender, recipient, amount, balances.

**When to use:** When transparency is desired (e.g., donations, public payments, on-chain reputation building).

**Gas cost:** Lowest.

### Tier 2: Partial Privacy

Transaction amounts are concealed. Addresses remain visible.

**How it works:** The transfer is routed through the BASEUSDP relay, which batches transactions and obscures individual amounts. A commitment scheme ensures the total in equals the total out.

**What's visible:** That a transfer occurred between two addresses. The amount is hidden.

**When to use:** When you want to keep payment amounts private but don't mind the counterparty relationship being visible (e.g., freelancer invoices, B2B payments).

**Gas cost:** Moderate.

### Tier 3: Full Privacy

Zero-Knowledge Proofs conceal the sender, recipient, and amount.

**How it works:**

1. The sender's funds are deposited into a shielded pool via an intermediate wallet
2. A ZK proof is generated that proves:
   - The sender has sufficient balance
   - The transfer amount is valid (non-negative, within balance)
   - No double-spending has occurred
3. The proof is submitted on-chain without revealing any transaction details
4. The recipient can withdraw from the shielded pool to any wallet

The intermediate wallet pool breaks the on-chain link between sender and recipient. The ZK proof guarantees correctness without revealing the underlying data.

**What's visible:** That a deposit was made to the shielded pool and a withdrawal occurred. The link between the two is cryptographically hidden.

**When to use:** When full financial privacy is required (e.g., salary payments, sensitive business transactions, personal transfers).

**Gas cost:** Highest (due to proof verification on-chain).

## Trust Assumptions

- **Wallet security:** Private keys never leave the user's wallet. All signing happens client-side.
- **Backend relay:** The backend sees transaction parameters in order to generate proofs and relay transactions. It does not store plaintext transaction data after processing.
- **ZK proofs:** The correctness of private transfers is guaranteed by the zero-knowledge proof system. The backend cannot fabricate invalid transfers.
- **Intermediate wallets:** The wallet pool is managed by the backend. Users trust that withdrawal requests are honored. On-chain escrow ensures funds cannot be misappropriated.

## Choosing a Privacy Level

| Scenario | Recommended Tier |
|----------|-----------------|
| Tipping a creator | Public |
| Paying a freelancer | Partial |
| Receiving salary | Full |
| Splitting a bill with friends | Public or Partial |
| Business-to-business payment | Partial or Full |
| Donation to a public cause | Public |
| Personal savings transfer | Full |
