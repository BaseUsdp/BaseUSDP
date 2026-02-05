/**
 * API Configuration Utility
 * Centralized API URL configuration for frontend
 * 
 * Usage:
 * import { getApiUrl } from '@/utils/apiConfig';
 * const apiUrl = getApiUrl();
 */

/**
 * Get the backend API URL (single Vercel project: API lives on same origin).
 *
 * Priority:
 * 1. VITE_API_URL (only set for local dev override; leave unset in Vercel for same-origin /api)
 * 2. Production: same origin → "" so /api/auth/nonce etc. hit this deployment
 * 3. Development: http://localhost:3000
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  // In production, ignore old separate-backend URL so we use same-origin /api
  if (envUrl && import.meta.env.PROD && envUrl.includes("baseusdp.vercel.app")) {
    return "";
  }
  if (envUrl) return envUrl;
  if (import.meta.env.PROD) return "";
  return "http://localhost:3000";
}

/**
 * Get the API URL with a specific endpoint
 */
export function getApiEndpoint(endpoint: string): string {
  const baseUrl = getApiUrl();
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
}

