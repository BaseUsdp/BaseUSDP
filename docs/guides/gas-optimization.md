# Gas Optimization Guide

## Overview
While Base offers significantly lower gas fees compared to Ethereum mainnet, understanding gas optimization can help reduce costs further, especially for frequent users and merchants processing many transactions.

## Base Network Gas Basics
Base is an Ethereum L2 rollup, which means transactions are executed on Base but data is posted to Ethereum mainnet. Gas costs on Base have two components:
1. **L2 execution fee** — Cost of executing the transaction on Base
2. **L1 data fee** — Cost of posting transaction data to Ethereum

## Tips for Lower Gas Costs

### Timing Your Transactions
- Gas prices on Base fluctuate with Ethereum mainnet activity
- Weekends and late-night hours (UTC) tend to have lower gas prices
- Use a gas tracker to monitor current prices before large transactions

### Batch Operations
- If making multiple deposits, consider consolidating into fewer, larger deposits
- Merchant batch settlement reduces per-transaction gas overhead

### Approval Optimization
- Use unlimited USDC approval to avoid repeated approval transactions
- Each approval transaction costs gas, so approving once saves future costs

### Contract Interaction Tips
- Ensure your wallet sets appropriate gas limits
- Avoid setting gas price too low, which can cause stuck transactions
- On Base, most transactions confirm within 2 seconds regardless of gas price

## Estimated Gas Costs (as of 2026)
| Operation | Estimated Cost |
|-----------|---------------|
| USDC Approval | < $0.001 |
| Deposit | $0.002 - $0.005 |
| Transfer (with ZK proof) | $0.005 - $0.01 |
| Withdrawal | $0.003 - $0.008 |

## Monitoring Gas Usage
The BaseUSDP dashboard shows estimated gas costs before confirming any transaction. Historical gas spending is available in your transaction history.
