/**
 * API Configuration Utility
 * Centralized API URL configuration for frontend
 * 
 * Usage:
 * import { getApiUrl } from '@/utils/apiConfig';
 * const apiUrl = getApiUrl();
 */

/**
 * Get the backend API URL
 * 
 * Priority:
 * 1. VITE_API_URL environment variable (set in Vercel)
 * 2. Production default: https://void402-backend.vercel.app (if in production)
 * 3. Development default: http://localhost:3000
 */
export function getApiUrl(): string {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production, use default backend URL
  // This should be updated to your actual backend deployment URL
  if (import.meta.env.PROD) {
    return "https://backend-5mxw8sphj-bryces-projects-72528c60.vercel.app";
  }
  
  // Development default
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

