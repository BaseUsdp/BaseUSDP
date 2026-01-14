/**
 * Input Validation Middleware
 * Validates request bodies for API endpoints
 */

import { Request, Response, NextFunction } from "express";
import { ValidationError, BadRequestError } from "./errorHandler.js";

// Solana address validation (base58, 32-44 characters)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  if (typeof address !== "string") return false;
  return SOLANA_ADDRESS_REGEX.test(address);
}

/**
 * Validate amount (positive number)
 */
export function isValidAmount(amount: any): boolean {
  if (typeof amount !== "number") return false;
  return !isNaN(amount) && amount > 0 && isFinite(amount);
}

/**
 * Validate privacy level
 */
export function isValidPrivacyLevel(level: any): boolean {
  return ["public", "partial", "full"].includes(level);
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate transfer request body
 */
export function validateTransferRequest(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body.from) {
    errors.push("'from' address is required");
  } else if (!isValidSolanaAddress(body.from)) {
    errors.push("'from' must be a valid Solana address");
  }

  if (!body.to) {
    errors.push("'to' address is required");
  } else if (!isValidSolanaAddress(body.to)) {
    errors.push("'to' must be a valid Solana address");
  }

  if (body.amount === undefined || body.amount === null) {
    errors.push("'amount' is required");
  } else if (!isValidAmount(body.amount)) {
    errors.push("'amount' must be a positive number");
  }

  if (body.privacyLevel && !isValidPrivacyLevel(body.privacyLevel)) {
    errors.push("'privacyLevel' must be 'public', 'partial', or 'full'");
  }

  // Check if sending to self
  if (body.from && body.to && body.from === body.to) {
    errors.push("Cannot transfer to the same address");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate payment request body
 */
export function validatePaymentRequest(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body.paymentId) {
    errors.push("'paymentId' is required");
  } else if (typeof body.paymentId !== "string" || body.paymentId.length < 8) {
    errors.push("'paymentId' must be a valid payment identifier");
  }

  if (!body.payerAddress) {
    errors.push("'payerAddress' is required");
  } else if (!isValidSolanaAddress(body.payerAddress)) {
    errors.push("'payerAddress' must be a valid Solana address");
  }

  if (body.amount === undefined || body.amount === null) {
    errors.push("'amount' is required");
  } else if (!isValidAmount(body.amount)) {
    errors.push("'amount' must be a positive number");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate submit transaction request body
 */
export function validateSubmitRequest(body: any): ValidationResult {
  const errors: string[] = [];

  if (!body.signedTransaction) {
    errors.push("'signedTransaction' is required");
  } else if (typeof body.signedTransaction !== "string") {
    errors.push("'signedTransaction' must be a base58 encoded string");
  } else if (body.signedTransaction.length < 100) {
    errors.push("'signedTransaction' appears to be invalid (too short)");
  }

  if (!body.transactionType) {
    errors.push("'transactionType' is required");
  } else if (!["transfer", "payment"].includes(body.transactionType)) {
    errors.push("'transactionType' must be 'transfer' or 'payment'");
  }

  if (body.transactionType === "payment" && !body.paymentId) {
    errors.push("'paymentId' is required for payment transactions");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate create payment request body
 */
export function validateCreatePaymentRequest(body: any): ValidationResult {
  const errors: string[] = [];

  if (body.amount === undefined || body.amount === null) {
    errors.push("'amount' is required");
  } else if (!isValidAmount(body.amount)) {
    errors.push("'amount' must be a positive number");
  }

  if (!body.serviceId) {
    errors.push("'serviceId' is required");
  } else if (typeof body.serviceId !== "string" || body.serviceId.length < 1) {
    errors.push("'serviceId' must be a non-empty string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create validation middleware for a specific validator function
 */
export function validate(
  validatorFn: (body: any) => ValidationResult
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validatorFn(req.body);

    if (!result.isValid) {
      throw new ValidationError("Validation failed", { errors: result.errors });
    }

    next();
  };
}

// Pre-built validation middleware
export const validateTransfer = validate(validateTransferRequest);
export const validatePayment = validate(validatePaymentRequest);
export const validateSubmit = validate(validateSubmitRequest);
export const validateCreatePayment = validate(validateCreatePaymentRequest);

/**
 * Sanitize request body - remove unexpected fields
 */
export function sanitizeBody(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === "object") {
      const sanitized: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          sanitized[field] = req.body[field];
        }
      }
      req.body = sanitized;
    }
    next();
  };
}

