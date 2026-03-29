/**
 * SEOMeta Component
 *
 * Manages document <head> meta tags for SEO.
 * Uses document.title and meta tag manipulation
 * since this project does not use react-helmet.
 */

import { useEffect } from "react";

interface SEOMetaProps {
  /** Page title (appended to site name) */
  title?: string;
  /** Meta description */
  description?: string;
  /** Canonical URL */
  canonical?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Open Graph type */
  ogType?: "website" | "article";
  /** Twitter card type */
  twitterCard?: "summary" | "summary_large_image";
  /** Prevent indexing (for private/authenticated pages) */
  noIndex?: boolean;
}

const SITE_NAME = "BASEUSDP";
const DEFAULT_DESCRIPTION =
  "Privacy-first stablecoin payments powered by Zero-Knowledge Proofs on Base (Coinbase L2). Send, receive, and manage USDC with configurable privacy.";
const DEFAULT_OG_IMAGE = "https://baseusdp.com/social-preview.png";
const SITE_URL = "https://baseusdp.com";

function setMetaTag(name: string, content: string, property?: boolean): void {
  const attr = property ? "property" : "name";
  let element = document.querySelector(`meta[${attr}="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(url: string): void {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.href = url;
}

export function SEOMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  twitterCard = "summary_large_image",
  noIndex = false,
}: SEOMetaProps) {
  useEffect(() => {
    // Document title
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

    // Standard meta tags
    setMetaTag("description", description);

    // Robots
    if (noIndex) {
      setMetaTag("robots", "noindex, nofollow");
    } else {
      setMetaTag("robots", "index, follow");
    }

    // Open Graph
    setMetaTag("og:title", title ?? SITE_NAME, true);
    setMetaTag("og:description", description, true);
    setMetaTag("og:type", ogType, true);
    setMetaTag("og:image", ogImage, true);
    setMetaTag("og:site_name", SITE_NAME, true);

    if (canonical) {
      setMetaTag("og:url", canonical, true);
      setCanonical(canonical);
    }

    // Twitter Card
    setMetaTag("twitter:card", twitterCard);
    setMetaTag("twitter:site", "@baseusdp");
    setMetaTag("twitter:title", title ?? SITE_NAME);
    setMetaTag("twitter:description", description);
    setMetaTag("twitter:image", ogImage);

    // Cleanup: reset title on unmount
    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, canonical, ogImage, ogType, twitterCard, noIndex]);

  return null; // This component only produces side effects
}

/**
 * Generate a canonical URL for a given path.
 */
export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export default SEOMeta;
