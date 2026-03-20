# Architecture

This document describes the high-level architecture of the BASEUSDP frontend application.

## Overview

BASEUSDP is a single-page application built with React and TypeScript, deployed on Vercel, and connected to the Base (Coinbase L2) blockchain. The frontend handles wallet interactions, transaction construction, privacy selection, and communication with backend APIs for ZK proof generation and transaction relay.

```
User
 │
 ▼
┌────────────────────────────────────┐
│           React Frontend           │
│                                    │
│  Pages ──► Components ──► Services │
│              │                │    │
│          Contexts          API     │
│         (Wallet,         Client    │
│          Theme,             │      │
│          XMTP)              │      │
└─────────────┬───────────────┘      │
              │                      │
              ▼                      ▼
        Base Chain            Backend API
       (ERC-20, ZK)        (Proof Gen, Relay)
```

## Directory Structure

### `/src/pages/`

Top-level route components. Each page corresponds to a URL path.

| Page | Route | Description |
|------|-------|-------------|
| `Index.tsx` | `/` | Landing page with all marketing sections |
| `Dashboard.tsx` | `/dashboard` | Main application dashboard |
| `PaymentPage.tsx` | `/pay/:id` | Payment settlement page |
| `X402Deposit.tsx` | `/x402-deposit` | x402 protocol deposit flow |
| `PrivacyPolicy.tsx` | `/privacy-policy` | Legal |
| `TermsAndConditions.tsx` | `/terms-and-conditions` | Legal |

### `/src/components/`

Reusable UI components, organized by domain.

- **`/dashboard/`** — Dashboard-specific components (balance display, send modal, deposit modal, transaction history, etc.)
- **`/dashboard/sections/`** — Tab content for dashboard navigation (Overview, Payments, History, Messages, Settings, etc.)
- **`/svg-animations/`** — Animated SVG illustrations for the landing page
- **`/ui/`** — shadcn/ui component library (buttons, dialogs, forms, etc.)

### `/src/contexts/`

React contexts that provide global state.

| Context | Purpose |
|---------|---------|
| `WalletContext` | Wallet connection, chain management, balance, privacy level, authentication |
| `ThemeContext` | Light/dark mode toggle and persistence |
| `XMTPContext` | XMTP client initialization and messaging state |

### `/src/services/`

API client layer. All backend communication goes through these modules.

| Service | Purpose |
|---------|---------|
| `api.ts` | Core API client with auth headers and error handling |
| `authService.ts` | Session token management, SIWE authentication |
| `transactionSigningService.ts` | Client-side transaction construction and wallet signing |
| `xmtpService.ts` | XMTP encrypted messaging |
| `clawncherSwapService.ts` | Token swap integration |
| `twitterApi.ts` | X/Twitter payment integration |

### `/src/hooks/`

Custom React hooks for shared logic.

### `/src/utils/`

Pure utility functions — validation, API URL configuration.

## Data Flow

### Authentication

1. User connects wallet (MetaMask, Coinbase Wallet, etc.)
2. Frontend requests a nonce from `/api/auth/nonce`
3. User signs a SIWE message with their wallet
4. Signed message is verified at `/api/auth/verify`
5. Session token is stored in localStorage
6. All subsequent API calls include the token as a Bearer header

### Private Transfer

1. User selects privacy level (public / partial / full)
2. Frontend calls `/api/zk/check-recipient` to validate recipient
3. Transaction parameters are sent to `/api/zk/transfer`
4. Backend generates a ZK proof and routes through the intermediate wallet pool
5. Frontend receives a transaction hash and displays confirmation
6. Transaction appears in history with a privacy level indicator

### Deposit

1. User initiates deposit from the dashboard
2. Frontend calls `/api/zk/deposit` with amount and privacy preferences
3. A holding wallet address is returned
4. User sends funds to the holding wallet
5. Backend detects the deposit and credits the user's private balance

## Key Design Decisions

### Why client-side transaction signing?

Private keys never leave the user's wallet. The frontend constructs unsigned transactions, the wallet signs them, and the signed transaction is submitted to the backend for relay. This keeps the trust boundary at the wallet level.

### Why XMTP for messaging?

XMTP provides end-to-end encrypted messaging tied to wallet addresses. No accounts, no phone numbers, no email. Messages are encrypted client-side before being sent to the XMTP network.

### Why three privacy levels?

Different use cases need different privacy guarantees. A coffee payment doesn't need full ZK privacy, but a salary payment might. Giving users the choice keeps the system practical and gas-efficient.
