# Frequently Asked Questions

## General

### What is BaseUSDP?
BaseUSDP is an open-source privacy payment protocol built on the Base network. It allows you to send USDC privately using zero-knowledge proofs, so third parties cannot see the connection between sender and recipient.

### Is BaseUSDP a mixer?
BaseUSDP is a privacy protocol, not a mixer. It uses zero-knowledge cryptography to provide financial privacy while maintaining compliance capabilities. Users retain the ability to prove their transaction history for regulatory purposes.

### What blockchain does BaseUSDP use?
BaseUSDP runs on Base, an Ethereum Layer 2 network built by Coinbase. Base offers low fees and fast transactions while inheriting Ethereum's security.

### Is BaseUSDP open source?
Yes, BaseUSDP is fully open source under the MIT license. You can view, audit, and contribute to the code on GitHub.

## Using BaseUSDP

### How much does it cost to use?
- Gas fees on Base are typically under $0.01 per transaction
- Protocol fee: 0.3% on transfers and withdrawals
- No fees for deposits (beyond gas)

### How long do transactions take?
Deposits and transfers confirm within 2-4 seconds on Base. Proof generation takes 5-15 seconds in your browser before the transaction is submitted.

### Can I use BaseUSDP on mobile?
Yes, BaseUSDP works as a progressive web app on mobile devices. Use it with mobile wallets like Coinbase Wallet or MetaMask Mobile.

### What wallets are supported?
MetaMask, Coinbase Wallet, WalletConnect-compatible wallets, and Rainbow.

## Privacy

### How private are my transactions?
Your deposits, transfers, and withdrawals cannot be linked by third parties. The zero-knowledge proof system ensures that only you know the connection between your deposit and your transfers.

### Can the BaseUSDP team see my transactions?
No. The protocol is designed so that even the BaseUSDP team cannot determine which deposits belong to which users or link deposits to transfers.

### Is my IP address protected?
Transfers are submitted through a relayer, which prevents your IP from being linked to the transaction. For maximum privacy, consider using a VPN.

## Security

### Are the smart contracts audited?
BaseUSDP is undergoing a formal security audit. The code is open source for community review. See our security documentation for details.

### What happens if I lose my deposit note?
Without your deposit note, funds cannot be recovered. Always save your deposit notes in a secure location. The app stores them locally as a backup, but browser data can be lost.

### Has BaseUSDP ever been hacked?
No. The protocol follows security best practices and undergoes regular review. We maintain a bug bounty program for responsible disclosure.
