/**
 * usePerformanceMetrics Hook
 *
 * Collects and reports client-side performance metrics
 * including navigation timing, component render times,
 * and custom user interaction measurements.
 */

import { useEffect, useRef, useCallback, useState } from "react";

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "score" | "bytes";
  timestamp: number;
}

export interface NavigationMetrics {
  /** Time from navigation start to DOM content loaded */
  domContentLoaded: number;
  /** Time from navigation start to full page load */
  pageLoad: number;
  /** Time to first byte from the server */
  ttfb: number;
  /** DNS lookup time */
  dnsLookup: number;
  /** TCP connection time */
  tcpConnect: number;
}

/**
 * Collect navigation timing metrics from the Performance API.
 */
export function getNavigationMetrics(): NavigationMetrics | null {
  if (typeof performance === "undefined") return null;

  const entries = performance.getEntriesByType("navigation");
  if (entries.length === 0) return null;

  const nav = entries[0] as PerformanceNavigationTiming;

  return {
    domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
    pageLoad: nav.loadEventEnd - nav.startTime,
    ttfb: nav.responseStart - nav.requestStart,
    dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
    tcpConnect: nav.connectEnd - nav.connectStart,
  };
}

/**
 * Hook for measuring component render performance.
 *
 * @param componentName - Name of the component being measured
 * @param enabled - Whether to collect metrics (disable in production)
 */
export function usePerformanceMetrics(
  componentName: string,
  enabled: boolean = import.meta.env.DEV
) {
  const renderCount = useRef(0);
  const mountTime = useRef(0);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  // Track mount time
  useEffect(() => {
    if (!enabled) return;

    mountTime.current = performance.now();
    renderCount.current = 0;

    return () => {
      const unmountTime = performance.now();
      const lifetime = unmountTime - mountTime.current;

      if (import.meta.env.DEV) {
        console.debug(
          `[Perf] ${componentName}: lifetime=${lifetime.toFixed(1)}ms, renders=${renderCount.current}`
        );
      }
    };
  }, [componentName, enabled]);

  // Track renders
  useEffect(() => {
    if (!enabled) return;
    renderCount.current += 1;
  });

  /**
   * Measure an async operation's duration.
   */
  const measure = useCallback(
    async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
      if (!enabled) return operation();

      const start = performance.now();
      try {
        const result = await operation();
        const duration = performance.now() - start;

        const metric: PerformanceMetric = {
          name: `${componentName}.${name}`,
          value: duration,
          unit: "ms",
          timestamp: Date.now(),
        };

        setMetrics((prev) => [...prev.slice(-49), metric]); // Keep last 50

        if (import.meta.env.DEV) {
          console.debug(`[Perf] ${metric.name}: ${duration.toFixed(1)}ms`);
        }

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.warn(`[Perf] ${componentName}.${name} failed after ${duration.toFixed(1)}ms`);
        throw error;
      }
    },
    [componentName, enabled]
  );

  /**
   * Mark a point in time for later measurement.
   */
  const mark = useCallback(
    (name: string) => {
      if (!enabled || typeof performance === "undefined") return;
      performance.mark(`${componentName}:${name}`);
    },
    [componentName, enabled]
  );

  return { measure, mark, metrics, renderCount: renderCount.current };
}

export default usePerformanceMetrics;
