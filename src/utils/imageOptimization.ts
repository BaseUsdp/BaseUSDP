/**
 * Image Optimization Utilities
 *
 * Provides helpers for responsive images, lazy loading attributes,
 * and srcset generation for optimal image delivery.
 */

export interface ImageSrcSet {
  src: string;
  srcSet: string;
  sizes: string;
}

/**
 * Standard responsive breakpoints for srcset.
 */
export const IMAGE_BREAKPOINTS = [320, 640, 768, 1024, 1280, 1536] as const;

/**
 * Generate a srcset string for responsive images.
 * Assumes images follow the pattern: `${basePath}/${width}w.${ext}`
 */
export function generateSrcSet(
  basePath: string,
  ext: string = "webp",
  widths: readonly number[] = IMAGE_BREAKPOINTS
): string {
  return widths.map((w) => `${basePath}/${w}w.${ext} ${w}w`).join(", ");
}

/**
 * Generate default sizes attribute for full-width responsive images.
 */
export function generateSizes(
  breakpoints: { maxWidth: number; size: string }[] = [
    { maxWidth: 640, size: "100vw" },
    { maxWidth: 1024, size: "80vw" },
    { maxWidth: 1280, size: "60vw" },
  ],
  defaultSize: string = "50vw"
): string {
  const parts = breakpoints.map((bp) => `(max-width: ${bp.maxWidth}px) ${bp.size}`);
  return [...parts, defaultSize].join(", ");
}

/**
 * Get lazy loading attributes for images.
 * Images above the fold should use eager loading.
 */
export function getLazyLoadAttrs(isAboveFold: boolean = false): {
  loading: "lazy" | "eager";
  decoding: "async" | "sync";
} {
  return {
    loading: isAboveFold ? "eager" : "lazy",
    decoding: isAboveFold ? "sync" : "async",
  };
}

/**
 * Calculate aspect ratio padding for responsive image containers.
 * Returns a percentage for use as padding-bottom in CSS.
 */
export function getAspectRatioPadding(width: number, height: number): string {
  return `${(height / width) * 100}%`;
}

/**
 * Check if the browser supports WebP format.
 * Caches the result after the first check.
 */
let webpSupported: boolean | null = null;

export async function supportsWebP(): Promise<boolean> {
  if (webpSupported !== null) return webpSupported;

  if (typeof document === "undefined") {
    webpSupported = false;
    return false;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  });
}

/**
 * Generate a placeholder blur data URL for progressive loading.
 * Returns a small, blurred SVG as a data URI.
 */
export function generateBlurPlaceholder(width: number, height: number, color: string = "#e5e7eb"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <filter id="b" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="20"/>
    </filter>
    <rect width="100%" height="100%" fill="${color}" filter="url(#b)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
