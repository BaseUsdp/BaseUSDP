# Developer Setup Guide

## Prerequisites
- Node.js 18+ (use nvm: `nvm use`)
- Git
- A code editor (VS Code recommended — see .vscode/ for settings)
- A wallet browser extension (MetaMask recommended)

## Setup Steps

### 1. Clone and Install
```bash
git clone https://github.com/BaseUsdp/BaseUSDP.git
cd BaseUSDP
npm ci
```

### 2. Environment Configuration
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase and RPC credentials
```

### 3. Start Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Run Tests
```bash
npm test
npm test -- --coverage  # With coverage report
```

### 5. Lint and Format
```bash
npm run lint
npx prettier --write "src/**/*.{ts,tsx}"
```

## Project Structure
```
src/
  components/   # React components
  pages/        # Next.js pages
  hooks/        # Custom React hooks
  services/     # Business logic
  constants/    # Configuration constants
  styles/       # CSS files
  types/        # TypeScript type definitions
  assets/       # Static assets
api/            # API route handlers
lib/            # Shared utilities
docs/           # Documentation
scripts/        # Build and utility scripts
public/         # Static public files
```

## Useful Commands
See `Makefile` for all available commands, or run `make help`.
