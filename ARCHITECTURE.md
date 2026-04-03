# Architecture Overview

## System Components
- **Frontend (Next.js):** React UI, ZK proof generation via WASM, wallet connection
- **API Layer (Next.js API Routes):** Auth, relayer, webhooks
- **Blockchain (Base L2):** Privacy pool contract, verifier contract, USDC
- **Browser Storage:** Deposit notes, preferences, session
- **Supabase:** User auth, usernames, payment requests

## Data Flow

### Deposit: User -> Wallet -> Base Contract -> Merkle Tree
### Transfer: User -> ZK Proof (browser) -> Relayer -> Base Contract -> Recipient
### Auth: Wallet Sign -> API Verify -> JWT -> Authenticated Requests

## Design Principles
1. Privacy by default
2. Client-side computation for ZK proofs
3. Open source and auditable
4. Minimal trust assumptions
5. Progressive enhancement
