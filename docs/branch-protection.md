# Branch Protection Rules

This document describes the recommended branch protection rules for the `main` branch of the BaseUSDP repository.

## Recommended Settings

### Required Status Checks

Enable **Require status checks to pass before merging** with the following checks:

| Check Name | Workflow | Required |
|-----------|----------|----------|
| ESLint | `lint.yml` | Yes |
| TypeScript | `lint.yml` | Yes |
| Build | `build.yml` | Yes |
| Unit Tests | `test.yml` | Yes |

### Pull Request Reviews

- **Require a pull request before merging**: Enabled
- **Required number of approvals**: 1
- **Dismiss stale pull request approvals when new commits are pushed**: Enabled
- **Require review from code owners**: Recommended for teams > 2

### Additional Settings

- **Require conversation resolution before merging**: Enabled
- **Require signed commits**: Optional (recommended)
- **Require linear history**: Enabled (enforces rebase/squash merge)
- **Include administrators**: Enabled (no bypass)

## Setting Up via GitHub CLI

```bash
gh api repos/BaseUsdp/BaseUSDP/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ESLint","TypeScript","Build","Unit Tests"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

## Merge Strategy

We recommend **squash and merge** for most PRs to keep the commit history clean. Use **rebase and merge** for multi-commit PRs where individual commits are meaningful (e.g., a feature branch with logical atomic commits).

## Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/zk-batch-transfers` |
| `fix/` | Bug fixes | `fix/wallet-disconnect-error` |
| `docs/` | Documentation | `docs/api-reference` |
| `ci/` | CI/CD changes | `ci/add-e2e-tests` |
| `refactor/` | Code refactoring | `refactor/swap-service` |
