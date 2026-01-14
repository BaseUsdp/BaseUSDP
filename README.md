# Void402

**Privacy-first financial platform combining x402 micropayments, FHE encryption, and neobank features.**

## What is Void402?

Void402 enables private money transfers and online payments without revealing how much you spent or who you paid. Built on the x402 payment standard with Fully Homomorphic Encryption (FHE) for complete confidentiality.

## Features

- **Private Money Transfers** - Send money confidentially with encrypted amounts
- **Private Online Payments** - Pay for content, APIs, and services using x402 with privacy
- **Encrypted Balances** - Your balance is encrypted, you control who sees it
- **Privacy by Default** - Your spending patterns aren't tracked

## Project Structure

```
void402/
├── packages/
│   ├── contracts/     # Smart contracts (VoidFHERC20, Void402Facilitator)
│   ├── backend/       # Backend API services
│   └── core/          # Core utilities (future)
└── src/               # Frontend React app
```

## Quick Start

### Backend Setup

1. **Contracts:**
```bash
cd packages/contracts
npm install
npm run compile
npm run deploy:sepolia
```

2. **Backend Server:**
```bash
cd packages/backend
npm install
cp .env.example .env
# Add contract addresses to .env
npm run dev
```

### Frontend

The frontend React app is in the `src/` directory and can be run with:
```bash
npm run dev
```

## Technology Stack

- **Blockchain:** Base (Sepolia testnet)
- **Smart Contracts:** Solidity, Hardhat, Fhenix FHE
- **Backend:** Node.js, Express, TypeScript
- **Payment Protocol:** Coinbase x402 SDKs
- **Privacy:** Fhenix FHE libraries

## Documentation

- [Contracts README](./packages/contracts/README.md)
- [Backend README](./packages/backend/README.md)

## License

MIT
