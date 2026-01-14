/**
 * Middleware Index
 * Export all middleware for easy importing
 */

// Error handling
export {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  SolanaError,
} from "./errorHandler.js";

// Rate limiting
export {
  createRateLimiter,
  generalRateLimiter,
  transactionRateLimiter,
  authRateLimiter,
  buildTransactionRateLimiter,
} from "./rateLimiter.js";

// Validation
export {
  validateTransfer,
  validatePayment,
  validateSubmit,
  validateCreatePayment,
  sanitizeBody,
  isValidSolanaAddress,
  isValidAmount,
  isValidPrivacyLevel,
} from "./validator.js";

// Logging
export {
  logger,
  requestLogger,
  logTransaction,
  logPayment,
} from "./logger.js";

// Authentication
export {
  requireAuth,
  optionalAuth,
  verifyWalletOwnership,
  createSession,
  invalidateSession,
  generateNonce,
  getNonce,
  verifyNonce,
  verifyWalletAddress,
} from "./auth.js";

