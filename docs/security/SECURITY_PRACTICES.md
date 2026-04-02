# Security Practices

## Development Security
- All code changes require at least one approving review
- Security-sensitive changes require review from the security team
- Automated static analysis runs on every PR
- Dependencies pinned to exact versions with automated vulnerability scanning

## Infrastructure Security
- Immutable deployments via Vercel with automatic HTTPS
- Content Security Policy (CSP) and HSTS headers
- Rate limiting on all API endpoints
- Real-time error tracking and uptime monitoring

## Smart Contract Security
- Formal verification of critical invariants
- Comprehensive test suite with fuzzing
- Multi-sig ownership for admin functions
- Emergency pause functionality

## Incident Response
1. Detection via automated monitoring
2. Triage by security team
3. Containment (emergency pause if needed)
4. Resolution and deployment
5. Post-mortem published within 72 hours

Contact: security@baseusdp.com
