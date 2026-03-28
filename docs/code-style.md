# Code Style Guide

This document describes the code formatting and style conventions used in BASEUSDP.

## Tools

| Tool | Purpose | Config File |
|------|---------|-------------|
| ESLint | Linting (logic errors, best practices) | `eslint.config.js` |
| Prettier | Formatting (whitespace, semicolons, quotes) | `.prettierrc` |
| EditorConfig | Editor settings (indent, charset) | `.editorconfig` |
| Husky | Git hooks (run checks before commit) | `.husky/` |
| lint-staged | Run linters on staged files only | `.lintstagedrc.json` |

## Formatting Rules

### TypeScript / TSX

- **Semicolons**: Always
- **Quotes**: Double quotes for strings
- **Trailing commas**: ES5 (arrays, objects — not function params)
- **Indent**: 2 spaces
- **Print width**: 100 characters
- **Arrow parens**: Always (`(x) => x`, not `x => x`)
- **Bracket spacing**: `{ foo }` not `{foo}`

### JSON

- **Indent**: 2 spaces
- **Print width**: 80 characters

### Markdown

- **Prose wrap**: Always (at 80 characters)

## Commands

```bash
# Format all source files
npm run format

# Check formatting without changing files
npm run format:check

# Lint and auto-fix
npm run lint:fix

# Run ESLint only
npm run lint
```

## Pre-commit Hook

Husky runs lint-staged before every commit. This ensures:

1. **TypeScript files** are linted with ESLint (with `--fix`) and formatted with Prettier
2. **JSON, Markdown, YAML** files are formatted with Prettier
3. **CSS** files are formatted with Prettier

If the hook fails, the commit is blocked. Fix the issues and try again.

## Import Order

We follow this import order (enforced by ESLint):

```typescript
// 1. React and built-in modules
import { useState, useEffect } from "react";

// 2. Third-party libraries
import { ethers } from "ethers";
import { motion } from "framer-motion";

// 3. Internal aliases (@/)
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";

// 4. Relative imports
import { BalanceCard } from "./BalanceCard";

// 5. Type imports
import type { Transaction } from "@/types/transactions";
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `LanguageSwitcher.tsx` |
| Hooks | camelCase with `use` prefix | `useTranslation.ts` |
| Utilities | camelCase | `apiConfig.ts` |
| Types/Interfaces | PascalCase | `TransactionUpdate` |
| Constants | UPPER_SNAKE_CASE | `BASE_MAINNET_CHAIN_ID` |
| CSS classes | kebab-case (Tailwind) | `bg-primary text-white` |
| Test files | `*.test.ts` / `*.test.tsx` | `validation.test.ts` |
