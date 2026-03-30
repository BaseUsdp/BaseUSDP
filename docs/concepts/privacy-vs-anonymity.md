# Privacy vs Anonymity

## Understanding the Difference
Privacy and anonymity are related but distinct concepts in the context of blockchain transactions.

### Privacy
Privacy means controlling who can see your financial information. With BaseUSDP, your transaction amounts, recipients, and frequency are hidden from public observers. You maintain the ability to prove your transaction history if needed (for tax compliance, audits, etc.).

### Anonymity
Anonymity means your identity is completely unknown. This is a stronger guarantee that BaseUSDP does not claim to provide. Your wallet address may still be linked to your identity through exchanges, ENS names, or on-chain activity outside of BaseUSDP.

## What BaseUSDP Provides
- **Transaction privacy:** Third parties cannot see the connection between your deposit and your transfers
- **Amount privacy:** Transfer amounts within the same tier are indistinguishable
- **Timing privacy:** The relayer submits transactions on your behalf, hiding your IP and timing

## What BaseUSDP Does NOT Provide
- **Complete anonymity:** Your initial deposit comes from a known address
- **Cross-protocol privacy:** Activity outside BaseUSDP is still public
- **Protection from targeted surveillance:** A determined adversary with access to your device could observe your activity

## Best Practices
- Wait between deposit and transfer for better privacy
- Avoid depositing and withdrawing the same amount in quick succession
- Use different addresses for receiving withdrawals
- Be mindful of timing patterns in your transaction behavior

## Compliance
BaseUSDP is designed as a privacy tool, not an anonymity tool. Users are expected to comply with local tax and reporting requirements. The system supports voluntary disclosure through deposit notes.
