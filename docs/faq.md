# Developer FAQ

Frequently asked questions for BASEUSDP contributors and developers.

## General

### What is the tech stack?

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **State**: React Context + TanStack Query
- **Wallet**: ethers.js, viem
- **Messaging**: XMTP Browser SDK
- **Deployment**: Vercel
- **Testing**: Vitest, React Testing Library
- **Chain**: Base (Coinbase L2)

### Why Base instead of Ethereum mainnet?

Base offers significantly lower gas fees ($0.01-0.10 per transaction vs $5-50 on mainnet) while inheriting Ethereum's security through its rollup architecture. This makes privacy-preserving transactions economically viable for everyday payments.

### Why not use Next.js?

BASEUSDP is a client-heavy application where most logic runs in the browser (wallet signing, ZK proof generation, encrypted messaging). A static SPA with serverless API routes provides simpler deployment and better client-side performance than SSR for this use case.

## Development

### How do I set up the development environment?

```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

### Why `--legacy-peer-deps`?

Some dependencies (particularly wallet SDKs) have conflicting peer dependency requirements. The `--legacy-peer-deps` flag allows npm to install them without failing. This is safe for our use case.

### How do I run tests?

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### How do I add a new page?

1. Create the page component in `src/pages/`
2. Add a lazy import in `src/routes/lazy.ts`
3. Add the route in `src/App.tsx`
4. Add SEO meta tags using `<SEOMeta />`

## Architecture

### How does the privacy system work?

BASEUSDP has three privacy tiers:

1. **Public**: Standard ERC-20 transfer on Base
2. **Partial**: Amount encrypted with homomorphic encryption, addresses visible
3. **Full**: ZK proof generated client-side, submitted through an intermediate wallet pool

### Where are private keys handled?

Private keys **never** leave the user's wallet. All transaction signing happens client-side through the wallet adapter (MetaMask, Coinbase Wallet, etc.). The backend only receives signed transactions.

### What is x402?

[x402](https://www.x402.org/) is an HTTP-native payment protocol. BASEUSDP uses it to generate payment links that can be shared as URLs or QR codes and settled on-chain.

### How does XMTP messaging work?

XMTP provides end-to-end encrypted messaging between wallet addresses. Messages are stored on the XMTP network, not on-chain, so there are no gas costs for messaging.

## Troubleshooting

### Build fails with "Cannot find module"

Run `npm install --legacy-peer-deps` to ensure all dependencies are installed.

### Tests fail with "matchMedia is not a function"

The test setup in `src/test/setup.ts` mocks `matchMedia`. Make sure your test file is importing from the correct location and the setup file is loaded.

### Wallet won't connect

1. Ensure you're on the Base network (Chain ID 8453 for mainnet, 84532 for Sepolia)
2. Check that your wallet extension is unlocked
3. Try disconnecting and reconnecting

### "Wrong Network" error

Click "Switch to Base" in the wallet dropdown, or manually add the Base network to your wallet.
