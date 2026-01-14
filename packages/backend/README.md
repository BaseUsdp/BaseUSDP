# Void402 Backend

Backend services for x402 payments and encrypted transactions.

## Services

### FHE Service
Handles FHE operations using Fhenix libraries:
- Encrypt/decrypt values
- Create encrypted payment payloads
- Verify encrypted payments

### Encrypted Transaction Service
Manages P2P encrypted transfers:
- Execute encrypted transfers
- Query encrypted balances
- Get transaction history

### x402 Service
Processes x402 payments with privacy:
- Create payment requests
- Verify payments
- Settle payments on-chain

## API Endpoints

### Payments
- `POST /api/payments/create` - Create x402 payment request
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/settle` - Settle payment on-chain
- `GET /api/payments/status/:paymentId` - Get payment status

### Transactions
- `POST /api/transactions/transfer` - Execute encrypted P2P transfer
- `GET /api/transactions/balance/:address` - Get encrypted balance
- `GET /api/transactions/history/:address` - Get transaction history

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add contract addresses and RPC URLs
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

