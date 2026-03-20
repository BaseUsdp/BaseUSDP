# Getting Started

This guide walks you through setting up the BASEUSDP frontend for local development.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** — Comes with Node.js
- **A wallet extension** — MetaMask, Coinbase Wallet, or similar
- **Base network** — Add Base to your wallet ([instructions](https://docs.base.org/using-base/))

## Installation

```bash
# Clone the repository
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP

# Install dependencies
npm install --legacy-peer-deps

# Copy environment template
cp .env.example .env.local
```

## Configuration

Edit `.env.local` with your settings:

```env
# Leave empty for same-origin API calls in production
# Set to your backend URL for local development
VITE_API_URL=http://localhost:3000
```

## Running Locally

```bash
# Start the development server
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

## Building for Production

```bash
# Create an optimized production build
npm run build

# Preview the production build locally
npm run preview
```

## Project Structure

```
src/
├── components/       # React components
│   ├── dashboard/    # Dashboard UI
│   ├── ui/           # shadcn/ui primitives
│   └── svg-animations/
├── contexts/         # Global state (Wallet, Theme, XMTP)
├── hooks/            # Custom React hooks
├── pages/            # Route pages
├── services/         # API client layer
└── utils/            # Utilities
```

See [architecture.md](./architecture.md) for a detailed breakdown.

## Connecting a Wallet

1. Open the app in your browser
2. Click **Connect Wallet** in the navigation bar
3. Select your wallet provider
4. Approve the connection request
5. Ensure you're on the **Base** network

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand how the codebase is organized
- Read the [Privacy Model](./privacy-model.md) to understand the three-tier privacy system
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) if you want to contribute
