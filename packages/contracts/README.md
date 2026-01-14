# Void402 Smart Contracts

Smart contracts for encrypted payments and x402 facilitation on Base blockchain.

## Contracts

### VoidFHERC20
Encrypted ERC20 token standard using FHE (Fully Homomorphic Encryption).

**Features:**
- Encrypted balances
- Encrypted transfers
- Encrypted approvals
- Privacy level management (Public, Partial, Full)

### Void402Facilitator
On-chain facilitator for x402 payments with FHE privacy.

**Features:**
- Payment request creation
- Encrypted payment verification
- On-chain settlement
- Payment status tracking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add your private key and RPC URLs
```

3. Compile contracts:
```bash
npm run compile
```

4. Deploy to Base Sepolia:
```bash
npm run deploy:sepolia
```

## Development

- Compile: `npm run compile`
- Test: `npm run test`
- Deploy: `npm run deploy:sepolia`

