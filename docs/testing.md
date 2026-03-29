# Testing Guide

## Overview

BASEUSDP uses [Vitest](https://vitest.dev/) as its test runner with React Testing Library for component tests.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Open the Vitest UI
npm run test:ui
```

## Test Structure

```
src/
├── utils/
│   ├── validation.ts
│   └── validation.test.ts          # Unit test alongside source
├── hooks/
│   └── __tests__/
│       ├── useResolveName.test.ts   # Hook tests in __tests__ folder
│       └── useSwap.test.ts
├── services/
│   └── __tests__/
│       ├── authService.test.ts
│       └── websocketService.test.ts
├── contexts/
│   └── __tests__/
│       └── WalletContext.test.ts
└── test/
    └── setup.ts                     # Test setup (jsdom, mocks)
```

## Writing Tests

### Unit Tests

Test pure functions and utilities directly:

```typescript
import { describe, it, expect } from "vitest";
import { isValidBaseAddress } from "./validation";

describe("isValidBaseAddress", () => {
  it("accepts a valid checksummed address", () => {
    expect(isValidBaseAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe(true);
  });

  it("rejects addresses without 0x prefix", () => {
    expect(isValidBaseAddress("742d35Cc6634C0532925")).toBe(false);
  });
});
```

### Hook Tests

Test hooks using the `renderHook` API:

```typescript
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

it("detects mobile viewport", () => {
  Object.defineProperty(window, "innerWidth", { value: 375 });
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(true);
});
```

### Mocking

Use Vitest's built-in mocking:

```typescript
import { vi } from "vitest";

// Mock a module
vi.mock("@/services/api", () => ({
  fetchBalance: vi.fn().mockResolvedValue({ balance: "100.00" }),
}));

// Mock fetch
globalThis.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ success: true }))
);
```

## Coverage

Coverage thresholds are configured in `vitest.config.ts`:

| Metric | Threshold |
|--------|-----------|
| Statements | 60% |
| Branches | 55% |
| Functions | 60% |
| Lines | 60% |

Coverage reports are generated in the `coverage/` directory and uploaded to Codecov in CI.

## Test Environment

The test setup (`src/test/setup.ts`) provides:

- **jsdom** environment for DOM APIs
- **matchMedia** mock for responsive hooks
- **IntersectionObserver** mock for lazy loading
- **ResizeObserver** mock for layout components
- **localStorage** mock with auto-cleanup between tests
- **crypto.randomUUID** polyfill

## CI Integration

Tests run automatically on every push and PR via the GitHub Actions test workflow. The workflow:

1. Installs dependencies
2. Runs `npm run test:coverage`
3. Uploads coverage to Codecov
4. Posts a coverage summary comment on PRs
