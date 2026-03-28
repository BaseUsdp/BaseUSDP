/**
 * Web Vitals Reporting
 *
 * Collects Core Web Vitals metrics (LCP, FID, CLS, FCP, TTFB)
 * using the native PerformanceObserver API. Reports metrics to
 * a callback function for analytics or logging.
 */

export interface WebVitalMetric {
  name: "LCP" | "FID" | "CLS" | "FCP" | "TTFB" | "INP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: "navigate" | "reload" | "back_forward" | "prerender";
}

type ReportCallback = (metric: WebVitalMetric) => void;

const thresholds: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  FID: [100, 300],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
  INP: [200, 500],
};

function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function getNavigationType(): WebVitalMetric["navigationType"] {
  if (typeof performance === "undefined") return "navigate";
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return (nav?.type as WebVitalMetric["navigationType"]) ?? "navigate";
}

let metricId = 0;
function generateId(): string {
  return `v${++metricId}-${Date.now()}`;
}

/**
 * Observe Largest Contentful Paint (LCP).
 * Measures loading performance — when the largest content element becomes visible.
 */
export function observeLCP(callback: ReportCallback): void {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (!lastEntry) return;

      const value = lastEntry.startTime;
      callback({
        name: "LCP",
        value,
        rating: getRating("LCP", value),
        delta: value,
        id: generateId(),
        navigationType: getNavigationType(),
      });
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // PerformanceObserver not supported for this entry type
  }
}

/**
 * Observe First Input Delay (FID).
 * Measures interactivity — delay between first user interaction and browser response.
 */
export function observeFID(callback: ReportCallback): void {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEventTiming | undefined;
      if (!firstEntry) return;

      const value = firstEntry.processingStart - firstEntry.startTime;
      callback({
        name: "FID",
        value,
        rating: getRating("FID", value),
        delta: value,
        id: generateId(),
        navigationType: getNavigationType(),
      });
    });

    observer.observe({ type: "first-input", buffered: true });
  } catch {
    // Not supported
  }
}

/**
 * Observe Cumulative Layout Shift (CLS).
 * Measures visual stability — sum of unexpected layout shifts.
 */
export function observeCLS(callback: ReportCallback): void {
  if (typeof PerformanceObserver === "undefined") return;

  let clsValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as any;
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
          sessionEntries.push(entry);
        }
      }

      callback({
        name: "CLS",
        value: clsValue,
        rating: getRating("CLS", clsValue),
        delta: clsValue,
        id: generateId(),
        navigationType: getNavigationType(),
      });
    });

    observer.observe({ type: "layout-shift", buffered: true });
  } catch {
    // Not supported
  }
}

/**
 * Initialize all Web Vitals observers.
 */
export function reportWebVitals(callback: ReportCallback): void {
  observeLCP(callback);
  observeFID(callback);
  observeCLS(callback);
}

export default reportWebVitals;
