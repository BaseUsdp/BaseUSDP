/**
 * Initialization Guard Middleware
 * Ensures services are initialized before handling requests
 * Critical for Vercel serverless functions where initialization is async
 */

import { Request, Response, NextFunction } from "express";
import { ensureInitialized } from "../index.js";
import { logger } from "./logger.js";

/**
 * Middleware to ensure services are initialized before processing requests
 * Returns 503 Service Unavailable if services are not ready
 */
export async function requireInitialization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    logger.error("Service initialization check failed:", error);
    res.status(503).json({
      success: false,
      error: "Service is initializing. Please try again in a moment.",
      code: "SERVICE_INITIALIZING",
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
}
