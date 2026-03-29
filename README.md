<p align="center">
  <img src="src/assets/usdp-logo-white.png" alt="BASEUSDP" width="120" />
</p>

<p align="center">
  <a href="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/build.yml"><img src="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/build.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/test.yml"><img src="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/test.yml/badge.svg" alt="Tests" /></a>
  <a href="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/lint.yml"><img src="https://github.com/BaseUsdp/BaseUSDP/actions/workflows/lint.yml/badge.svg" alt="Lint" /></a>
  <a href="https://github.com/BaseUsdp/BaseUSDP/blob/main/LICENSE"><img src="https://img.shields.io/github/license/BaseUsdp/BaseUSDP" alt="License" /></a>
  <a href="https://github.com/BaseUsdp/BaseUSDP/releases"><img src="https://img.shields.io/github/v/release/BaseUsdp/BaseUSDP?include_prereleases" alt="Release" /></a>
</p>



<h1 align="center">BASEUSDP</h1>

<p align="center">
  <strong>Privacy-First Payments for the AI Economy</strong>
</p>

<p align="center">
  Confidential stablecoin transactions powered by Zero-Knowledge Proofs on Base (Coinbase L2).
</p>

<p align="center">
  <a href="https://baseusdp.com">Website</a> &middot;
  <a href="https://baseusdp.com/dashboard">Dashboard</a> &middot;
  <a href="https://x.com/baseusdp">Twitter</a>
</p>

---

## What is BASEUSDP?

BASEUSDP is a privacy-preserving payment protocol built on [Base](https://base.org), Coinbase's Layer 2 network. It enables users to send, receive, and manage USDC and other stablecoins with configurable privacy levels — from fully public transactions to completely confidential transfers using Zero-Knowledge Proofs.

Traditional blockchain payments expose your entire financial history to anyone with a block explorer. BASEUSDP solves this by wrapping transactions in ZK proofs that verify correctness without revealing amounts, recipients, or balances.

## Key Features

### Privacy-Preserving Transfers
- **Public mode** — Standard on-chain transfers, fully visible
- **Partial privacy** — Encrypted amounts, visible addresses
- **Full privacy** — ZK-shielded transfers where amounts, sender, and recipient are all concealed

### Dashboard
- Encrypted balance display with one-click reveal
- Send payments to any wallet address or BASEUSDP username
- Deposit USDC via multiple on-ramp methods
- Full transaction history with privacy-level indicators
- Real-time portfolio tracking

### x402 Payment Protocol
- HTTP-native payment requests using the [x402 standard](https://www.x402.org/)
- Generate payment links and QR codes
- Settle payments on-chain with optional privacy

### Encrypted Messaging (XMTP)
- End-to-end encrypted messaging between wallets
- Send payment requests via chat
- Built on the [XMTP](https://xmtp.org/) protocol

### Multi-Wallet Support
- MetaMask, Coinbase Wallet, and other injected wallets
- WalletConnect for mobile wallets
- Phantom and Solflare for cross-chain operations

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         React + TypeScript + Vite            │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Dashboard │ │  Wallet  │ │   Privacy    │ │
│  │    UI     │ │ Context  │ │   Selector   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   Send   │ │ Deposit  │ │  ZK Transfer │ │
│  │   Flow   │ │   Flow   │ │     Flow     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   XMTP   │ │   x402   │ │ Transaction  │ │
│  │ Messaging│ │ Payments │ │   Signing    │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Backend API (Private)           │
│  ZK Proof Generation · Wallet Pool          │
│  Transaction Relay · Auth · Notifications   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Base (Coinbase L2)              │
│        USDC · ERC-20 · Smart Contracts      │
└─────────────────────────────────────────────┘
```

> **Note:** This repository contains the open-source frontend. The backend API, ZK proof generation, and intermediate wallet infrastructure are maintained privately.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Wallet | ethers.js + viem |
| Messaging | XMTP Browser SDK |
| Charts | Recharts |
| Animation | Framer Motion + Lottie |
| Deployment | Vercel |
| Chain | Base (Coinbase L2) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A wallet with Base network configured

### Installation

```bash
# Clone the repository
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP

# Install dependencies
npm install --legacy-peer-deps

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

The app will be running at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── dashboard/          # Dashboard UI (send, deposit, history, etc.)
│   │   └── sections/       # Dashboard tab sections
│   ├── svg-animations/     # Animated SVG illustrations
│   └── ui/                 # shadcn/ui component library
├── contexts/               # React contexts (Wallet, Theme, XMTP)
├── hooks/                  # Custom React hooks
├── pages/                  # Route pages
├── services/               # API client and service layer
└── utils/                  # Utilities and validation
```

## Privacy Model

BASEUSDP implements a three-tier privacy model:

1. **Public** — Transactions are fully visible on-chain, identical to standard ERC-20 transfers.

2. **Partial Privacy** — Transaction amounts are encrypted using homomorphic encryption. Addresses remain visible but balances are concealed.

3. **Full Privacy** — Zero-Knowledge Proofs (ZKPs) are generated client-side to prove transaction validity without revealing any details. The proof is submitted on-chain, and the transaction is executed through an intermediate wallet pool that breaks the link between sender and recipient.

## Contributing

We welcome contributions. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Security

If you discover a security vulnerability, please report it responsibly by emailing **baseusdp@proton.me**. Do not open a public issue.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Links

- **Website:** [baseusdp.com](https://baseusdp.com)
- **Base App:** Available on the [Base App Store](https://base.dev)
- **Twitter:** [@baseusdp](https://x.com/baseusdp)
- **Base Chain:** [base.org](https://base.org)

---

<p align="center">
  Built on Base. Powered by Zero-Knowledge Proofs.
</p>
