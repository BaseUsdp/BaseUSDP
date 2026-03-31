# Smart Contract Security

## Overview
BaseUSDP smart contracts handle user funds and privacy-critical operations. Security is paramount and follows defense-in-depth principles.

## Security Measures

### Formal Verification
Core contract logic has been formally verified using Certora to prove correctness of critical invariants:
- Conservation of funds: total deposits always equal total pool balance plus total withdrawals
- Nullifier uniqueness: each deposit note can only be spent once
- Merkle tree integrity: the tree state is always consistent

### Audit History
- Internal security review (ongoing)
- External audit planned for Q3 2026
- Bug bounty program active

### Access Controls
- Immutable core logic: deposit and withdrawal functions cannot be upgraded
- Admin functions limited to fee adjustments and emergency pause
- Multi-sig required for any admin action
- Timelock on all governance changes

### Emergency Procedures
- Circuit breaker pattern: contracts can be paused in case of detected exploit
- Pause does not affect existing deposits — users can always withdraw
- Emergency withdrawal function bypasses the relayer

## Known Limitations
- The trusted setup ceremony introduces a trust assumption
- Relayer availability affects transaction submission (but not fund safety)
- Front-running protection relies on the relayer's transaction ordering

## Responsible Disclosure
Found a vulnerability? Email security@baseusdp.com. We offer bounties for critical findings.
