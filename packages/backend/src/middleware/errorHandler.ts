/**
 * Error Handling Middleware
 * Centralized error handling for all API endpoints
 */

import { Request, Response, NextFunction } from "express";

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }
}

// Common error types
export class BadRequestError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class SolanaError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 502, "SOLANA_ERROR", details);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  path: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.error(`  Message: ${err.message}`);
  if (err.stack) {
    console.error(`  Stack: ${err.stack.split("\n").slice(0, 3).join("\n")}`);
  }

  // Determine status code and error details
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let details: any = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    details = err.details;
  } else if (err.name === "SyntaxError") {
    // JSON parsing error
    statusCode = 400;
    code = "INVALID_JSON";
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: err.message || "An unexpected error occurred",
      code,
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    errorResponse.error.message = "An unexpected error occurred";
    delete errorResponse.error.details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

