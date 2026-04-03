# Testing Guide

## Test Structure
```
src/
  __tests__/          # Test files mirror src/ structure
  setupTests.ts       # Global test setup
__mocks__/            # Jest file mocks
jest.config.ts        # Jest configuration
```

## Running Tests
```bash
npm test                     # Run all tests
npm test -- --watch          # Watch mode
npm test -- --coverage       # Coverage report
npm test -- path/to/file     # Single file
```

## Writing Tests

### Component Tests
```tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Hook Tests
```tsx
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '@/hooks/useMyHook';

describe('useMyHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(initialValue);
  });
});
```

## Mocking
- Wallet connections: Mock wagmi hooks
- API calls: Mock fetch or use MSW
- ZK proofs: Use pre-computed test proofs
- Blockchain: Mock viem client

## Coverage Thresholds
- Branches: 70%
- Functions: 70%
- Lines: 80%
- Statements: 80%
