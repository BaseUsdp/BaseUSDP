# ERC-20 Transfers

## What is ERC-20?
ERC-20 is the standard interface for fungible tokens on Ethereum and EVM-compatible chains like Base. USDC follows this standard, which defines how tokens can be transferred, approved, and queried.

## Key ERC-20 Functions

### transfer(to, amount)
Directly transfers tokens from the caller to the recipient. Requires the caller to hold sufficient balance.

### approve(spender, amount)
Grants permission for another address (like the BaseUSDP contract) to spend tokens on your behalf, up to the specified amount.

### transferFrom(from, to, amount)
Allows an approved spender to transfer tokens from one address to another. Used by BaseUSDP to move USDC from your wallet into the privacy pool.

## How BaseUSDP Uses ERC-20
1. **Approval:** You approve the BaseUSDP contract to spend your USDC
2. **Deposit:** The contract calls transferFrom to move USDC into the pool
3. **Withdrawal:** The contract calls transfer to send USDC to the recipient

## Approval Best Practices
- You can approve an exact amount or unlimited (type(uint256).max)
- Exact approvals are more secure but require re-approval for each deposit
- Unlimited approvals are convenient but give the contract permanent spending rights
- BaseUSDP prompts for exact approval by default

## Token Decimals
USDC uses 6 decimal places. When you deposit 100 USDC, the actual on-chain value is 100,000,000 (100 * 10^6).
