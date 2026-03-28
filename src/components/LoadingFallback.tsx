/**
 * LoadingFallback Component
 *
 * Suspense fallback component for lazy-loaded routes and components.
 * Displays a branded loading indicator with skeleton elements.
 */

import { memo } from "react";

interface LoadingFallbackProps {
  /** Message to display below the spinner */
  message?: string;
  /** Whether to show as full-page or inline */
  fullPage?: boolean;
  /** Show skeleton lines for content areas */
  showSkeleton?: boolean;
}

function LoadingFallbackInner({
  message = "Loading...",
  fullPage = false,
  showSkeleton = false,
}: LoadingFallbackProps) {
  const containerClass = fullPage
    ? "flex min-h-screen items-center justify-center bg-background"
    : "flex items-center justify-center py-12";

  return (
    <div className={containerClass} role="status" aria-live="polite" aria-label={message}>
      <div className="flex flex-col items-center gap-4">
        {/* Animated spinner */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        </div>

        {/* Loading message */}
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>

        {/* Optional skeleton content */}
        {showSkeleton && (
          <div className="mt-6 w-72 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        )}
      </div>
    </div>
  );
}

export const LoadingFallback = memo(LoadingFallbackInner);

/**
 * Page-level loading fallback for route suspense boundaries.
 */
export function PageLoadingFallback() {
  return <LoadingFallback fullPage showSkeleton message="Loading page..." />;
}

/**
 * Dashboard section loading fallback.
 */
export function DashboardLoadingFallback() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default LoadingFallback;
