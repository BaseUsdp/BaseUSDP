# Threat Model

## Assets Under Protection
1. User funds in the privacy pool
2. Transaction privacy (deposit-to-transfer links)
3. Deposit notes (spending secrets)
4. Authenticated user sessions

## Key Threats and Mitigations

### T1: Smart Contract Exploitation
Attacker drains the privacy pool via contract vulnerability.
Mitigations: formal verification, external audit, bug bounty, emergency pause.

### T2: ZK Proof Forgery
Attacker creates valid proof without a deposit.
Mitigations: trusted setup ceremony, on-chain verifier, Circom constraints.

### T3: Double Spending
User spends the same deposit note twice.
Mitigations: on-chain nullifier tracking, transaction reverts on duplicate.

### T4: Deanonymization
Observer links deposits to withdrawals.
Mitigations: ZK proofs, intermediate wallets, relayer, fixed amounts.

### T5: Relayer Attacks
Relayer censors or modifies transactions.
Mitigations: on-chain verification, self-relay fallback, multiple relayers planned.

### T6: Client-Side Attacks
Malicious code steals deposit notes.
Mitigations: open source, CSP headers, SRI, local-only storage.
