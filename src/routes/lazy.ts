/**
 * Lazy Route Loading
 *
 * Defines lazy-loaded route components using React.lazy().
 * Each route is code-split into its own chunk, loaded on demand.
 * Wrap these in <Suspense fallback={<PageLoadingFallback />}>.
 */

import { lazy } from "react";

/**
 * Dashboard page — the main authenticated view.
 * Includes balance display, send/receive, transaction history.
 */
export const LazyDashboard = lazy(
  () => import("@/pages/Index")
);

/**
 * Swap page — token swapping via DEX aggregator.
 */
export const LazySwap = lazy(
  () => import("@/pages/Swap")
);

/**
 * Transfer page — send payments with privacy controls.
 */
export const LazyTransfer = lazy(
  () => import("@/pages/Transfer")
);

/**
 * Deposit page — on-ramp USDC to the wallet.
 */
export const LazyDeposit = lazy(
  () => import("@/pages/Deposit")
);

/**
 * Support page — help and contact.
 */
export const LazySupport = lazy(
  () => import("@/pages/Support")
);

/**
 * Privacy Policy page.
 */
export const LazyPrivacyPolicy = lazy(
  () => import("@/pages/PrivacyPolicy")
);

/**
 * Terms and Conditions page.
 */
export const LazyTerms = lazy(
  () => import("@/pages/TermsAndConditions")
);

/**
 * Private Swap page — ZK-shielded swaps.
 */
export const LazyPrivateSwap = lazy(
  () => import("@/pages/PrivateSwap")
);

/**
 * Preload a lazy component by calling its load function.
 * Useful for prefetching routes on hover or focus.
 */
export function preloadRoute(routeImport: () => Promise<any>): void {
  routeImport().catch(() => {
    // Silently fail — the route will load normally when navigated to
  });
}
