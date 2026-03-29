/**
 * SEO Utilities
 *
 * Helper functions for URL canonicalization, slug generation,
 * and meta tag management.
 */

const SITE_URL = "https://baseusdp.com";

/**
 * Generate a canonical URL for a given path.
 * Strips trailing slashes and query parameters.
 */
export function canonicalUrl(path: string): string {
  let clean = path.split("?")[0].split("#")[0];
  clean = clean.replace(/\/+$/, "");
  if (!clean.startsWith("/")) clean = `/${clean}`;
  return `${SITE_URL}${clean}`;
}

/**
 * Generate a URL-safe slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Truncate a description to a specific length for meta tags.
 * Cuts at the last word boundary before maxLength.
 */
export function truncateDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace === -1) return truncated + "...";
  return truncated.slice(0, lastSpace) + "...";
}

/**
 * Generate page-specific meta description based on page type.
 */
export function getPageDescription(page: string): string {
  const descriptions: Record<string, string> = {
    home: "Privacy-first stablecoin payments powered by Zero-Knowledge Proofs on Base. Send, receive, and manage USDC with configurable privacy levels.",
    dashboard: "Manage your BASEUSDP wallet. View balances, send payments, and track transactions with privacy controls.",
    swap: "Swap tokens on Base with low fees. Exchange ETH, USDC, and other ERC-20 tokens using BASEUSDP.",
    transfer: "Send private payments on Base. Choose your privacy level — public, partial, or fully confidential with ZK proofs.",
    deposit: "Deposit USDC to your BASEUSDP wallet. Multiple on-ramp methods available.",
    support: "Get help with BASEUSDP. Contact support, browse FAQs, and report issues.",
  };

  return descriptions[page] ?? descriptions.home;
}

/**
 * Generate Open Graph tags as an object (useful for SSR or static generation).
 */
export function generateOGTags(options: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
}): Record<string, string> {
  return {
    "og:title": options.title,
    "og:description": truncateDescription(options.description, 200),
    "og:url": canonicalUrl(options.path),
    "og:image": options.image ?? `${SITE_URL}/social-preview.png`,
    "og:type": options.type ?? "website",
    "og:site_name": "BASEUSDP",
  };
}

/**
 * Check if a URL is internal (same domain).
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url, SITE_URL);
    return parsed.origin === SITE_URL;
  } catch {
    return url.startsWith("/") || url.startsWith("#");
  }
}
