/**
 * Route Prefetching Utilities
 *
 * Provides intelligent prefetching for route code-splitting chunks.
 * Prefetch strategies: hover, viewport visibility, and idle-time.
 */

type ModuleImport = () => Promise<any>;

/** Cache of already-prefetched modules */
const prefetched = new Set<string>();

/**
 * Prefetch a lazy-loaded route module.
 * The import function is called immediately but the result is not awaited —
 * the browser will cache the chunk for when it's actually needed.
 *
 * @param importFn - Dynamic import function, e.g., () => import("@/pages/Dashboard")
 * @param label - Optional label for dedup tracking
 */
export function prefetchRoute(importFn: ModuleImport, label?: string): void {
  const key = label ?? importFn.toString();
  if (prefetched.has(key)) return;

  prefetched.add(key);
  importFn().catch(() => {
    // Remove from cache so retry is possible
    prefetched.delete(key);
  });
}

/**
 * Prefetch multiple routes at once.
 */
export function prefetchRoutes(routes: Array<{ importFn: ModuleImport; label: string }>): void {
  routes.forEach(({ importFn, label }) => prefetchRoute(importFn, label));
}

/**
 * Prefetch routes during browser idle time.
 * Uses requestIdleCallback when available, falls back to setTimeout.
 */
export function prefetchOnIdle(
  routes: Array<{ importFn: ModuleImport; label: string }>,
  timeout: number = 2000
): void {
  const schedule = typeof requestIdleCallback !== "undefined"
    ? (cb: () => void) => requestIdleCallback(cb, { timeout })
    : (cb: () => void) => setTimeout(cb, 100);

  schedule(() => prefetchRoutes(routes));
}

/**
 * Create an onMouseEnter handler that prefetches a route.
 * Useful for navigation links — prefetch on hover so the chunk
 * is ready when the user clicks.
 */
export function createHoverPrefetcher(importFn: ModuleImport, label?: string) {
  let triggered = false;

  return () => {
    if (triggered) return;
    triggered = true;
    prefetchRoute(importFn, label);
  };
}

/**
 * Prefetch a route when an element enters the viewport.
 * Uses IntersectionObserver for efficient visibility detection.
 */
export function prefetchOnVisible(
  element: HTMLElement,
  importFn: ModuleImport,
  label?: string
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    // Fallback: prefetch immediately
    prefetchRoute(importFn, label);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        prefetchRoute(importFn, label);
        observer.disconnect();
      }
    },
    { rootMargin: "200px" } // Start prefetching slightly before visible
  );

  observer.observe(element);

  return () => observer.disconnect();
}

/**
 * Get the list of all prefetched route labels.
 * Useful for debugging.
 */
export function getPrefetchedRoutes(): string[] {
  return Array.from(prefetched);
}
