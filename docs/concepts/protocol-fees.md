# Protocol Fees

## Fee Structure
BaseUSDP charges fees to sustain protocol development and relayer operations.

| Operation | Protocol Fee | Relayer Fee | Total |
|-----------|-------------|-------------|-------|
| Deposit | 0% | 0% | Free (gas only) |
| Transfer | 0.3% | 0.1% | 0.4% |
| Withdrawal | 0.3% | 0.1% | 0.4% |

## Example
Transfer of 100 USDC:
- Protocol fee: 0.30 USDC
- Relayer fee: 0.10 USDC
- Recipient receives: 99.60 USDC
- Gas fee: ~$0.005 (paid by relayer, included in relayer fee)

## Fee Distribution
- 40% to protocol treasury for development
- 25% to security fund for audits and bounties
- 25% to relayer operators for gas and infrastructure
- 10% to community grants

## Fee Governance
Protocol fees may be adjusted through the governance process. Any fee change requires a community vote with 14-day notice period.

## Comparison
| Protocol | Fee |
|----------|-----|
| BaseUSDP | 0.4% |
| Traditional wire transfer | $25-50 flat |
| Credit card processing | 2.5-3.5% |
| PayPal international | 3-5% |
