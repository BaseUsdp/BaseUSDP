# Contributing Examples

This guide provides concrete examples for common contribution patterns in BASEUSDP.

## Adding a New Utility Function

### 1. Create the utility file

```typescript
// src/utils/formatCurrency.ts

/**
 * Format a numeric amount as a currency string.
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: "USD")
 * @param locale - Locale for formatting (default: "en-US")
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

### 2. Add tests

```typescript
// src/utils/formatCurrency.test.ts

import { describe, it, expect } from "vitest";
import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(100.5)).toBe("$100.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
```

### 3. Export from barrel (if applicable)

Add the export to the relevant `index.ts` barrel file.

## Adding a New Hook

### 1. Create the hook

```typescript
// src/hooks/useClipboard.ts

import { useState, useCallback } from "react";

export function useClipboard(timeout: number = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  return { copied, copy };
}
```

### 2. Add tests

```typescript
// src/hooks/__tests__/useClipboard.test.ts

import { renderHook, act } from "@testing-library/react";
import { useClipboard } from "../useClipboard";

describe("useClipboard", () => {
  it("starts with copied = false", () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
  });
});
```

## Adding a New Component

### 1. Create the component

```tsx
// src/components/StatusBadge.tsx

interface StatusBadgeProps {
  status: "success" | "pending" | "error";
  label: string;
}

const statusStyles = {
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {label}
    </span>
  );
}
```

## Adding a New Locale

See the [i18n documentation](./i18n.md) for detailed instructions.

## Commit Message Format

```
<type>: <description>

Co-Authored-By: Your Name <email>
```

Types: `Add`, `Update`, `Fix`, `Remove`, `Refactor`, `Docs`, `Test`

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] New files have JSDoc comments
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
