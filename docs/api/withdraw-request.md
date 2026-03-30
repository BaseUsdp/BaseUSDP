# Withdraw Request Endpoint

## `POST /api/privacy-usd/withdraw`

Initiates a withdrawal from the privacy pool back to a specified wallet address. Similar to transfers but optimized for self-withdrawal.

## Request Body
```json
{
  "proof": "0x...",
  "publicInputs": {
    "root": "0x...",
    "nullifierHash": "0x...",
    "recipient": "0x1234...abcd",
    "amount": "100",
    "fee": "0.30"
  }
}
```

## Response

### Success (200)
```json
{
  "withdrawalId": "wth_ghi789",
  "transactionHash": "0x...",
  "status": "submitted",
  "amount": "100",
  "fee": "0.30",
  "netAmount": "99.70"
}
```

## Notes
- Withdrawals use the same proof mechanism as transfers
- The fee is deducted from the withdrawal amount
- Funds are sent directly to the specified recipient address
- Allow up to 30 seconds for the relayer to submit the transaction
