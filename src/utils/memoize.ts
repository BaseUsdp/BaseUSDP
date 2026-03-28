/**
 * Performance Utilities
 *
 * Memoization, debounce, and throttle helpers for optimizing
 * expensive computations and frequent event handlers.
 */

/**
 * Memoize a function with a single argument.
 * Uses a Map cache with configurable max size.
 */
export function memoize<T, R>(
  fn: (arg: T) => R,
  options: { maxSize?: number; keyFn?: (arg: T) => string } = {}
): (arg: T) => R {
  const { maxSize = 100, keyFn } = options;
  const cache = new Map<string, R>();

  return (arg: T): R => {
    const key = keyFn ? keyFn(arg) : String(arg);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(arg);

    // Evict oldest entries when cache is full
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Debounce a function — delays execution until after `wait` ms
 * of inactivity.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Throttle a function — ensures it runs at most once every `wait` ms.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): T & { cancel: () => void } {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled as T & { cancel: () => void };
}

/**
 * Batch multiple state updates to reduce re-renders.
 * In React 18, batching is automatic for most cases,
 * but this is useful for non-React async callbacks.
 */
export function batchUpdates(callback: () => void): void {
  // React 18 auto-batches, but this wrapper makes intent explicit
  // and provides a future-proof API surface
  callback();
}

export default { memoize, debounce, throttle, batchUpdates };
