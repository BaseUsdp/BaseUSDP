/**
 * Input Sanitization Utilities
 *
 * Protects against XSS, injection, and other input-based attacks.
 * Used to sanitize user inputs before rendering or sending to APIs.
 */

/**
 * HTML entity map for escaping.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

/**
 * Escape HTML special characters to prevent XSS.
 *
 * @param input - Raw user input
 * @returns Escaped string safe for HTML rendering
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Strip all HTML tags from a string.
 *
 * @param input - String potentially containing HTML
 * @returns Plain text with all tags removed
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize a wallet address input.
 * Removes whitespace and validates format.
 *
 * @param address - Raw address input
 * @returns Cleaned address string
 */
export function sanitizeAddress(address: string): string {
  if (!address || typeof address !== "string") return "";
  // Remove all whitespace and non-printable characters
  return address.trim().replace(/\s/g, "");
}

/**
 * Sanitize a numeric amount input.
 * Allows digits, one decimal point, and optional leading minus.
 *
 * @param amount - Raw amount input
 * @returns Cleaned numeric string
 */
export function sanitizeAmount(amount: string): string {
  if (!amount || typeof amount !== "string") return "";
  // Remove everything except digits and decimal point
  const cleaned = amount.replace(/[^\d.]/g, "");
  // Ensure only one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return cleaned;
}

/**
 * Sanitize a search query input.
 * Removes potentially dangerous characters while preserving
 * useful search syntax.
 *
 * @param query - Raw search query
 * @returns Sanitized query string
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== "string") return "";
  return query
    .trim()
    .replace(/[<>'"`;]/g, "") // Remove dangerous characters
    .slice(0, 200); // Limit length
}

/**
 * Sanitize a memo/message input.
 * Allows alphanumeric characters, spaces, and common punctuation.
 *
 * @param memo - Raw memo input
 * @param maxLength - Maximum allowed length (default 280)
 * @returns Sanitized memo string
 */
export function sanitizeMemo(memo: string, maxLength: number = 280): string {
  if (!memo || typeof memo !== "string") return "";
  return memo
    .trim()
    .replace(/[^\w\s.,!?@#$%^&*()\-=+[\]{}|:;"'<>/~`]/g, "")
    .slice(0, maxLength);
}

/**
 * Validate and sanitize a URL.
 * Only allows http: and https: protocols.
 *
 * @param url - Raw URL input
 * @returns Sanitized URL or empty string if invalid/unsafe
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();

  // Block javascript: and data: URIs
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return "";

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href;
  } catch {
    // Allow relative URLs starting with /
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }
    return "";
  }
}

/**
 * Sanitize an object's string values recursively.
 * Useful for sanitizing API request bodies.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as any)[key] = escapeHtml(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (result as any)[key] = sanitizeObject(value);
    }
  }
  return result;
}

export default {
  escapeHtml,
  stripHtml,
  sanitizeAddress,
  sanitizeAmount,
  sanitizeSearchQuery,
  sanitizeMemo,
  sanitizeUrl,
  sanitizeObject,
};
