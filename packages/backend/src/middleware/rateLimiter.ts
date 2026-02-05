/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import { Request, Response, NextFunction } from "express";
import { RateLimitError } from "./errorHandler.js";

// In-memory store for rate limiting (use Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    keyGenerator = (req) => req.ip || "unknown",
    skip = () => false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if configured
    if (skip(req)) {
      return next();
    }

    const key = `ratelimit:${keyGenerator(req)}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    } else {
      // Increment existing entry
      entry.count++;
    }

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      
      throw new RateLimitError(message);
    }

    next();
  };
}

// Pre-configured rate limiters for different endpoints

/**
 * General API rate limiter - 100 requests per minute
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: "Too many requests. Please wait a moment and try again.",
});

/**
 * Transaction rate limiter - 10 transactions per minute
 * More restrictive for transaction endpoints
 */
export const transactionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: "Transaction rate limit exceeded. Please wait before submitting more transactions.",
  keyGenerator: (req) => {
    // Rate limit by wallet address if available, otherwise by IP
    const walletAddress = req.body?.from || req.body?.payerAddress || req.ip;
    return `tx:${walletAddress}`;
  },
});

/**
 * Auth rate limiter - 20 per minute per wallet/IP (nonce + verify flow needs headroom)
 * Key by wallet when present so one user doesn't block others
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: "Too many authentication attempts. Please wait a moment and try again.",
  keyGenerator: (req) => {
    const wallet = req.body?.walletAddress ?? req.body?.wallet;
    return wallet ? `auth:${wallet}` : `auth:${req.ip || "unknown"}`;
  },
});

/**
 * Build transaction rate limiter - 20 per minute
 * Moderate rate limiting for transaction building
 */
export const buildTransactionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: "Too many transaction build requests. Please slow down.",
  keyGenerator: (req) => {
    const walletAddress = req.body?.from || req.body?.payerAddress || req.ip;
    return `build:${walletAddress}`;
  },
});

