# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.5.0] - 2026-03-29

### Added
- **Testing**: Vitest test suite with jsdom environment, coverage thresholds, and 15 test files
  - Utility tests: validation, apiConfig, nameResolution (unit + integration)
  - Context tests: WalletContext, ThemeContext
  - Service tests: authService, websocketService, transactionSigningService
  - Hook tests: useResolveName, useTransactionStatus, useSwap, useMobile
- **CI/CD**: GitHub Actions workflows for lint, build, and test with Codecov integration
  - Dependabot configuration for automated dependency updates
  - Branch protection documentation
- **i18n**: Full internationalization support with 5 languages
  - English, Spanish, French, Chinese (Simplified), Arabic
  - useTranslation hook with dynamic locale loading
  - LanguageSwitcher component
  - RTL support utilities for Arabic
- **Performance**: Code splitting, lazy route loading, and optimization utilities
  - LoadingFallback and suspense components
  - Memoize, debounce, and throttle utilities
  - Image optimization helpers
  - Web Vitals reporting
  - Route prefetching (hover, idle, viewport)
  - Performance monitoring hook
- **Type Safety**: Comprehensive TypeScript type definitions
  - API response types, transaction types, wallet types
  - WebSocket message types, environment variable types
  - Shared utility types with branded types for domain safety
- **SEO**: Sitemap generator, structured data (JSON-LD), SEO meta component
  - Canonical URL utilities
  - robots.txt generation
- **Formatting**: Prettier, Husky pre-commit hooks, lint-staged
  - EditorConfig improvements
  - Format scripts in package.json
- **Security**: CSP headers configuration, input sanitization utilities
  - Rate limiting documentation
  - Dependency audit script
- **Community**: Code of Conduct, public roadmap, GitHub discussion templates
  - CI badges on README
- **Documentation**: 10 new docs covering deployment, environment variables,
  API authentication, testing, contributing examples, developer FAQ,
  i18n, code style, performance, SEO, rate limiting, and branch protection


## [0.3.0] - 2026-03-20

### Added
- Documentation: architecture guide, privacy model deep-dive, getting started guide
- GitHub issue templates (bug report, feature request) and PR template
- SECURITY.md with vulnerability reporting process
- CONTRIBUTING.md with development guidelines
- `.editorconfig` for consistent formatting across editors

### Changed
- Package renamed from generic scaffold name to `baseusdp`
- Package marked as public for open-source distribution

## [0.2.0] - 2026-03-05

### Added
- README with architecture overview, tech stack, and setup instructions
- MIT License
- Public assets: favicons, logos, social preview images, Lottie animations
- Landing page: Hero, About, Problem, Solution, Features, Use Cases, Roadmap, FAQ, CTA sections
- Animated SVG illustrations for landing page

## [0.1.0] - 2026-02-18

### Added
- Dashboard with encrypted balance display
- Send payment modal with username and address resolution
- Deposit flow with multiple on-ramp methods
- ZK proof transfer system with three privacy tiers (public, partial, full)
- x402 payment protocol integration
- Transaction history with privacy level indicators and CSV export
- XMTP encrypted messaging between wallets
- Notification center
- Yield engine display
- Wallet integration: MetaMask, Coinbase Wallet, Phantom, WalletConnect
- Theme system with light/dark mode
- API service layer with session-based authentication
- Client-side transaction signing (private keys never leave the wallet)
- Address and username validation utilities

## [0.0.1] - 2026-01-15

### Added
- Initial project scaffold: Vite + React 18 + TypeScript
- Tailwind CSS with custom configuration
- shadcn/ui component library (60+ primitives)
- ESLint and PostCSS configuration

## [0.4.0] - 2026-03-26

### Added
- ENS name resolution (alice.eth → 0x address)
- Base Name resolution (alice.base → 0x address)
- `useResolveName` React hook with debouncing and caching
- `detectNameType` utility for classifying user input
- EIP-137 namehash implementation
- Unit tests for name type detection
- Name resolution documentation
