/**
 * Logging Middleware
 * Request/response logging for debugging and monitoring
 */

import { Request, Response, NextFunction } from "express";

// Log levels
type LogLevel = "debug" | "info" | "warn" | "error";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// HTTP method colors
const methodColors: Record<string, string> = {
  GET: colors.green,
  POST: colors.blue,
  PUT: colors.yellow,
  PATCH: colors.yellow,
  DELETE: colors.red,
};

// Status code colors
function getStatusColor(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
}

/**
 * Format timestamp
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format duration in ms
 */
function formatDuration(startTime: [number, number]): string {
  const diff = process.hrtime(startTime);
  const ms = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
  return `${ms}ms`;
}

/**
 * Logger utility
 */
export const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(`${colors.dim}[DEBUG]${colors.reset} ${formatTimestamp()} - ${message}`, data || "");
    }
  },
  
  info: (message: string, data?: any) => {
    console.log(`${colors.blue}[INFO]${colors.reset} ${formatTimestamp()} - ${message}`, data || "");
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`${colors.yellow}[WARN]${colors.reset} ${formatTimestamp()} - ${message}`, data || "");
  },
  
  error: (message: string, error?: any) => {
    console.error(`${colors.red}[ERROR]${colors.reset} ${formatTimestamp()} - ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
        if (error.stack && process.env.NODE_ENV !== "production") {
          console.error(`  ${error.stack.split("\n").slice(1, 4).join("\n  ")}`);
        }
      } else {
        console.error(`  ${JSON.stringify(error)}`);
      }
    }
  },
  
  request: (method: string, path: string, status: number, duration: string, ip?: string) => {
    const methodColor = methodColors[method] || colors.reset;
    const statusColor = getStatusColor(status);
    
    console.log(
      `${colors.dim}[REQ]${colors.reset} ${formatTimestamp()} ` +
      `${methodColor}${method}${colors.reset} ${path} ` +
      `${statusColor}${status}${colors.reset} ` +
      `${colors.dim}${duration}${colors.reset}` +
      (ip ? ` ${colors.dim}from ${ip}${colors.reset}` : "")
    );
  },
};

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime();
  const ip = req.ip || req.socket.remoteAddress;

  // Log request body for POST/PUT/PATCH (sanitized)
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    // Hide sensitive fields
    if (sanitizedBody.signedTransaction) {
      sanitizedBody.signedTransaction = `[${sanitizedBody.signedTransaction.length} chars]`;
    }
    if (sanitizedBody.privateKey) {
      sanitizedBody.privateKey = "[REDACTED]";
    }
    if (sanitizedBody.password) {
      sanitizedBody.password = "[REDACTED]";
    }
    logger.debug(`Request body: ${JSON.stringify(sanitizedBody)}`);
  }

  // Log response when finished
  res.on("finish", () => {
    const duration = formatDuration(startTime);
    logger.request(req.method, req.path, res.statusCode, duration, ip);
  });

  next();
}

/**
 * Log successful transactions
 */
export function logTransaction(
  type: "transfer" | "payment",
  from: string,
  to: string,
  amount: number,
  signature?: string
): void {
  logger.info(
    `Transaction ${type.toUpperCase()}: ${from.slice(0, 8)}... → ${to.slice(0, 8)}... | Amount: ${amount}` +
    (signature ? ` | Sig: ${signature.slice(0, 16)}...` : "")
  );
}

/**
 * Log payment events
 */
export function logPayment(
  event: "created" | "verified" | "settled" | "failed",
  paymentId: string,
  details?: any
): void {
  const eventColors: Record<string, string> = {
    created: colors.blue,
    verified: colors.cyan,
    settled: colors.green,
    failed: colors.red,
  };
  
  console.log(
    `${eventColors[event] || colors.reset}[PAYMENT ${event.toUpperCase()}]${colors.reset} ` +
    `${formatTimestamp()} - ID: ${paymentId.slice(0, 16)}...` +
    (details ? ` | ${JSON.stringify(details)}` : "")
  );
}

