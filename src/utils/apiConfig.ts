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
 * 1. VITE_API_URL environment variable (override)
 * 2. Production: same origin (relative /api)
 * 3. Development: http://localhost:3000
 */
export function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Production: API is on same Vercel project at /api
  if (import.meta.env.PROD) {
    return ""; // relative: same origin, so /api/auth/nonce etc.
  }
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

