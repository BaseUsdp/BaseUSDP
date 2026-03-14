# Contributing to BASEUSDP

Thanks for your interest in contributing to BASEUSDP. This document outlines how to get involved.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `npm install --legacy-peer-deps`
4. Create a new branch for your work

```bash
git checkout -b feature/your-feature-name
```

## Development

```bash
# Start the dev server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

## Pull Request Process

1. **One PR per feature or fix.** Keep changes focused and atomic.
2. **Write clear commit messages.** Describe what changed and why.
3. **Test your changes.** Make sure the app builds and runs correctly.
4. **Update documentation** if your change affects the public API or user-facing behavior.

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- Tailwind CSS for styling (no inline styles or CSS modules)
- shadcn/ui primitives for common UI patterns
- Descriptive variable and function names

## What We're Looking For

- Bug fixes
- Performance improvements
- Accessibility improvements
- Documentation improvements
- New UI components that follow existing patterns

## What to Avoid

- Breaking changes to existing component APIs without discussion
- Adding large dependencies without justification
- Changes to the build or deployment configuration without prior approval

## Reporting Issues

Use [GitHub Issues](https://github.com/BaseUsdp/BaseUSDP/issues) to report bugs or request features. Include:

- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Browser and OS information
- Screenshots if applicable

## Code of Conduct

Be respectful and constructive. We're building privacy infrastructure — collaboration matters.

## Questions?

Open a discussion or reach out at **baseusdp@proton.me**.
