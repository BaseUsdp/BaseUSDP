# Data Retention Policy

## Overview
BaseUSDP minimizes data collection and retention in alignment with privacy-by-design principles.

## What We Store
| Data Type | Retention Period | Purpose |
|-----------|-----------------|---------|
| Wallet addresses (authenticated) | Account lifetime | Authentication and session management |
| Usernames | Account lifetime | Payment routing |
| API request logs | 90 days | Debugging and rate limiting |
| Error logs | 30 days | Bug fixing and monitoring |
| Payment request metadata | 1 year | Merchant reconciliation |

## What We Do NOT Store
- Deposit notes or secrets
- Zero-knowledge proofs (submitted directly to chain)
- Transaction correlations (deposit-to-withdrawal links)
- IP addresses (beyond request logs)
- Browser fingerprints
- Location data

## On-Chain Data
Transaction data on the Base blockchain is permanent and immutable. BaseUSDP cannot modify or delete on-chain data. However, the privacy protocol ensures that on-chain data does not reveal transaction relationships.

## Data Deletion
Users can request deletion of off-chain data by contacting privacy@baseusdp.com. On-chain data cannot be deleted due to blockchain immutability.

## Backup and Recovery
- Database backups are encrypted and retained for 30 days
- Backups are stored in geographically distributed locations
- Access to backups is restricted to authorized personnel
