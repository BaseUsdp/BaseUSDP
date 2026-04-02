# Incident Response Plan

## Severity Levels
- **P0 Critical:** Fund loss risk, active exploitation. Response: < 1 hour.
- **P1 High:** Auth bypass, data exposure. Response: < 4 hours.
- **P2 Medium:** DoS, logic errors. Response: < 24 hours.
- **P3 Low:** Informational findings. Response: < 1 week.

## Response Procedure
1. **Detection:** Automated monitoring or bug bounty report
2. **Assessment:** Confirm vulnerability, assess severity
3. **Containment:** Emergency pause if funds at risk
4. **Investigation:** Root cause analysis, scope determination
5. **Resolution:** Develop, test, and deploy fix
6. **Communication:** Notify affected users within 24h, post-mortem within 72h
7. **Review:** Retrospective within 1 week, update documentation

## Emergency Contacts
- Security team: security@baseusdp.com
- On-call: Rotated weekly among core team members
