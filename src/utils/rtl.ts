/**
 * RTL (Right-to-Left) Support Utilities
 *
 * Provides helpers for direction-aware styling and layout in RTL locales
 * like Arabic. These utilities work alongside Tailwind CSS's RTL plugin
 * and the i18n system's automatic dir attribute management.
 */

import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";

/**
 * Check if a locale uses RTL text direction.
 */
export function isRTL(locale: Locale): boolean {
  return SUPPORTED_LOCALES[locale]?.direction === "rtl";
}

/**
 * Get the current document direction.
 */
export function getDocumentDirection(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  return (document.documentElement.dir as "ltr" | "rtl") || "ltr";
}

/**
 * Apply direction-aware class names.
 * Returns the LTR class for LTR locales and the RTL class for RTL locales.
 *
 * @example
 * directionalClass("ml-4", "mr-4") // Returns "ml-4" in LTR, "mr-4" in RTL
 */
export function directionalClass(ltrClass: string, rtlClass: string): string {
  return getDocumentDirection() === "rtl" ? rtlClass : ltrClass;
}

/**
 * Flip a horizontal CSS property value for RTL.
 * e.g., "left" becomes "right" and vice versa.
 */
export function flipHorizontal(value: "left" | "right"): "left" | "right" {
  if (getDocumentDirection() !== "rtl") return value;
  return value === "left" ? "right" : "left";
}

/**
 * Get the logical start direction based on document direction.
 * "start" is "left" in LTR and "right" in RTL.
 */
export function logicalStart(): "left" | "right" {
  return getDocumentDirection() === "rtl" ? "right" : "left";
}

/**
 * Get the logical end direction based on document direction.
 * "end" is "right" in LTR and "left" in RTL.
 */
export function logicalEnd(): "left" | "right" {
  return getDocumentDirection() === "rtl" ? "left" : "right";
}

/**
 * Create direction-aware inline styles for absolute/fixed positioning.
 * Replaces left/right with the correct property based on direction.
 */
export function directionalStyle(
  styles: Record<string, string | number>
): Record<string, string | number> {
  const dir = getDocumentDirection();
  if (dir !== "rtl") return styles;

  const flipped: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (key === "left") {
      flipped["right"] = value;
    } else if (key === "right") {
      flipped["left"] = value;
    } else if (key === "marginLeft") {
      flipped["marginRight"] = value;
    } else if (key === "marginRight") {
      flipped["marginLeft"] = value;
    } else if (key === "paddingLeft") {
      flipped["paddingRight"] = value;
    } else if (key === "paddingRight") {
      flipped["paddingLeft"] = value;
    } else if (key === "textAlign" && value === "left") {
      flipped["textAlign"] = "right";
    } else if (key === "textAlign" && value === "right") {
      flipped["textAlign"] = "left";
    } else {
      flipped[key] = value;
    }
  }
  return flipped;
}

/**
 * Format a number according to locale conventions.
 * Uses the locale's decimal and thousands separators.
 */
export function formatLocalizedNumber(
  value: number,
  locale: Locale,
  maximumFractionDigits: number = 2
): string {
  const config = SUPPORTED_LOCALES[locale];
  if (!config) return value.toFixed(maximumFractionDigits);

  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
  } catch {
    return value.toFixed(maximumFractionDigits);
  }
}

/**
 * Format a currency amount according to locale conventions.
 */
export function formatLocalizedCurrency(
  value: number,
  locale: Locale,
  currency: string = "USD"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}
