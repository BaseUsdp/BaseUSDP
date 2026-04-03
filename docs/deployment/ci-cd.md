# CI/CD Pipeline

## Overview
BaseUSDP uses GitHub Actions for continuous integration and Vercel for continuous deployment.

## Pipeline Stages

### On Pull Request
1. **Lint:** ESLint checks on all TypeScript files
2. **Type Check:** TypeScript compiler with strict mode
3. **Test:** Jest unit and integration tests
4. **Build:** Next.js production build
5. **Bundle Size:** Size-limit check against budget
6. **Security:** Dependency review and CodeQL analysis
7. **Preview:** Vercel preview deployment

### On Merge to Main
1. All PR checks run again
2. Vercel production deployment (automatic)
3. Lighthouse performance audit
4. Smoke tests against production URL

## Configuration Files
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/codeql.yml` — Security scanning
- `.github/workflows/lighthouse.yml` — Performance budgets
- `.github/workflows/dependency-review.yml` — Dependency checks

## Secrets Required
| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Automatic, used by GitHub Actions |
| `VERCEL_TOKEN` | Vercel deployment |
| `SENTRY_AUTH_TOKEN` | Source map upload |

## Branch Protection
- `main` branch requires passing CI checks
- At least one approving review required
- Force push disabled
- Branch must be up to date
