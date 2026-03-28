# Performance Guide

This document covers the performance optimization strategies used in BASEUSDP.

## Code Splitting

Routes are lazy-loaded using `React.lazy()` and `Suspense`. Each page is a separate chunk that loads on demand.

```tsx
import { Suspense } from "react";
import { LazyDashboard } from "@/routes/lazy";
import { PageLoadingFallback } from "@/components/LoadingFallback";

<Suspense fallback={<PageLoadingFallback />}>
  <LazyDashboard />
</Suspense>
```

### Route Prefetching

Routes can be prefetched to eliminate loading delays:

- **On hover**: Prefetch when the user hovers over a navigation link
- **On idle**: Prefetch during browser idle time after initial load
- **On visible**: Prefetch when a link enters the viewport

```tsx
import { createHoverPrefetcher } from "@/utils/prefetch";

const prefetchDashboard = createHoverPrefetcher(
  () => import("@/pages/Index"),
  "dashboard"
);

<a onMouseEnter={prefetchDashboard} href="/dashboard">Dashboard</a>
```

## Memoization

The `src/utils/memoize.ts` module provides:

- **`memoize(fn)`** — Cache expensive function results with LRU eviction
- **`debounce(fn, ms)`** — Delay execution until input settles
- **`throttle(fn, ms)`** — Limit execution frequency

### React.memo

Use `React.memo` for components that receive stable props but sit in frequently re-rendering trees. Our `LoadingFallback` component is already memoized.

## Image Optimization

See `src/utils/imageOptimization.ts` for utilities:

- Responsive `srcset` generation
- Lazy loading attributes (`loading="lazy"`, `decoding="async"`)
- WebP support detection
- Blur placeholder generation for progressive loading

### Best Practices

1. Use WebP format with PNG/JPEG fallback
2. Provide multiple sizes via `srcset`
3. Set explicit `width` and `height` to prevent layout shift
4. Use `loading="eager"` only for above-the-fold images

## Web Vitals

Core Web Vitals are monitored using the native `PerformanceObserver` API:

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| LCP | < 2.5s | Loading performance |
| FID | < 100ms | Input responsiveness |
| CLS | < 0.1 | Visual stability |
| TTFB | < 800ms | Server response time |

### Reporting

```typescript
import { reportWebVitals } from "@/utils/webVitals";

reportWebVitals((metric) => {
  console.log(`${metric.name}: ${metric.value} (${metric.rating})`);
  // Send to analytics endpoint
});
```

## Performance Monitoring Hook

The `usePerformanceMetrics` hook tracks component lifecycle and async operations:

```tsx
function Dashboard() {
  const { measure, mark } = usePerformanceMetrics("Dashboard");

  const loadData = async () => {
    const data = await measure("fetchBalance", () => fetchBalance());
    // ...
  };
}
```

This is only active in development mode by default.

## Bundle Size

Monitor bundle size with the build workflow, which reports chunk sizes in the GitHub Actions summary. Target:

- **Initial JS bundle**: < 200 KB (gzipped)
- **Total route chunks**: < 500 KB (gzipped)
- **Largest single chunk**: < 100 KB (gzipped)
