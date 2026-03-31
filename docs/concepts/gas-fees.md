# Gas Fees on Base

## What Are Gas Fees?
Gas fees are payments made to network validators for processing transactions. On Base, gas fees are significantly lower than Ethereum mainnet while inheriting its security.

## Base Fee Structure
Base transaction costs have two components:

### L2 Execution Fee
The cost of executing the transaction on the Base sequencer. Calculated as: gas_used * base_fee_per_gas. On Base, this is typically less than $0.001.

### L1 Data Fee
The cost of posting transaction data to Ethereum mainnet for data availability. This is the larger component and varies with Ethereum mainnet gas prices. With EIP-4844 blobs, this cost has been reduced significantly.

## Typical BaseUSDP Gas Costs
| Operation | Gas Used | Estimated Cost |
|-----------|----------|---------------|
| USDC Approval | ~46,000 | < $0.001 |
| Deposit | ~150,000 | $0.002 - $0.005 |
| Transfer (ZK) | ~300,000 | $0.005 - $0.01 |
| Withdrawal | ~200,000 | $0.003 - $0.008 |

## Who Pays Gas?
- **Deposits:** The user pays gas directly from their wallet
- **Transfers:** The relayer pays gas and deducts it from the transfer fee
- **Withdrawals:** The relayer pays gas and deducts it from the withdrawal amount

## Reducing Gas Costs
- Use the relayer for transfers to avoid paying gas directly
- Batch multiple small deposits into fewer larger ones
- Monitor gas prices and transact during low-activity periods
