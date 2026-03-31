# Signing Transactions

## What is Transaction Signing?
Every blockchain transaction must be cryptographically signed by the sender's private key. This proves that the transaction was authorized by the wallet owner without revealing the private key itself.

## How Signing Works in BaseUSDP

### Authentication Signing
When you connect to BaseUSDP, you sign a message (not a transaction) to prove wallet ownership. This is a free operation that does not cost gas.

The message looks like: "Sign this message to verify your wallet: [nonce]"

### Transaction Signing
When you deposit, transfer, or withdraw, you sign an actual blockchain transaction. This requires gas and modifies on-chain state.

### What to Review Before Signing
Always review:
- **To address:** Should match the BaseUSDP contract
- **Amount:** The USDC amount being transferred
- **Gas fee:** The estimated cost of the transaction
- **Function name:** Should match the expected operation (deposit, approve, etc.)

## EIP-712 Typed Data
BaseUSDP uses EIP-712 structured data signing where possible, which displays human-readable information in your wallet's signing prompt instead of raw hex data.

## Common Signing Errors
- **User rejected:** You cancelled the signing request in your wallet
- **Insufficient funds:** Not enough ETH for gas
- **Nonce too low:** A previous transaction is still pending
- **Invalid chain:** Your wallet is connected to the wrong network

## Security Tips
- Never sign messages from unknown or suspicious sources
- Always verify the website URL matches baseusdp.com
- Review all transaction details before confirming
- Be wary of "unlimited approval" requests from unknown contracts
