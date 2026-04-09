# CI/CD Pipeline

This document describes the continuous integration and deployment setup for BASEUSDP.

## Overview

BASEUSDP uses GitHub Actions for continuous integration. Every push to `main` and every pull request runs automated checks to catch issues early.

## Workflows

### Build (`.github/workflows/build.yml`)

Validates that the build tooling is functional and the project structure is intact.

- **Triggers:** push to main, pull requests, manual dispatch
- **Node version:** 22
- **What it does:**
  - Installs dependencies with `--legacy-peer-deps --ignore-scripts`
  - Verifies Vite is installable
  - Checks that required project files exist (`vite.config.ts`, `index.html`, `src/`)

### Lint (`.github/workflows/lint.yml`)

Validates ESLint and TypeScript tooling.

- **Triggers:** push to main, pull requests, manual dispatch
- **What it does:**
  - Validates the ESLint config file can be parsed
  - Verifies the TypeScript compiler is installable

### Test (`.github/workflows/test.yml`)

Validates the test runner and test file presence.

- **Triggers:** push to main, pull requests, manual dispatch
- **What it does:**
  - Verifies Vitest is installable
  - Counts test files in the source tree and fails if none exist

## Path Filters

All three workflows skip execution when only documentation files change:

- `docs/**`
- `**.md`
- `LICENSE`

This reduces CI minute usage for documentation-only pull requests.

## Other Workflows

- **CodeQL** — Automated security analysis
- **Dependency Review** — Flags vulnerable dependencies in PRs
- **Stale** — Closes inactive issues and PRs
- **Labeler** — Auto-labels PRs based on changed files
- **Greetings** — Welcomes first-time contributors
- **Lighthouse** — Performance audits on the built site
- **Preview Cleanup** — Removes Vercel preview deployments after merge

## Running Locally

To replicate the CI environment locally:

```bash
# Use the correct Node version
nvm use

# Install dependencies the same way CI does
npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund

# Run the checks
npm run lint
npm run test
npm run build
```

## Troubleshooting

### `EBADENGINE` error during install

Make sure you're running Node 22 or later. The `@xmtp/browser-sdk` package requires it.

```bash
nvm install 22
nvm use 22
```

### Husky prepare script fails

The `prepare` script is suffixed with `|| true` so it won't fail the install in non-git environments. If you see husky-related errors, they're safe to ignore in CI.

### Lint finds unexpected errors

Run `npm run lint:fix` to auto-fix what can be fixed, then address remaining issues manually.
