# Intermediate Wallets

## What Are Intermediate Wallets?
Intermediate wallets are temporary wallet addresses used by the BaseUSDP relayer to break the on-chain link between deposits and withdrawals. They add an additional layer of privacy to the transfer process.

## How They Work
1. When you initiate a transfer, the relayer generates a fresh intermediate wallet
2. Funds are first sent from the privacy pool to the intermediate wallet
3. The intermediate wallet then forwards funds to the final recipient
4. The intermediate wallet is discarded after use

## Why Use Intermediate Wallets?
Without intermediate wallets, a sophisticated observer could potentially correlate privacy pool withdrawals with recipients by analyzing timing and amounts. Intermediate wallets add noise to this analysis by introducing additional hops.

## Privacy Benefits
- Breaks direct on-chain links between pool and recipient
- Randomized timing between hops
- Multiple intermediate wallets may be used for a single transfer
- Intermediate wallets are never reused

## Gas Implications
Using intermediate wallets requires additional gas for the extra transaction hops. However, on Base, this additional cost is minimal (typically less than $0.005 per extra hop).

## Configuration
Intermediate wallet usage is automatic and configured at the protocol level. Users do not need to manage intermediate wallets directly.
