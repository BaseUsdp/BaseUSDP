/**
 * Authentication Middleware
 * Wallet-based authentication for API endpoints
 */

import { Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { UnauthorizedError, ForbiddenError } from "./errorHandler.js";
import { logger } from "./logger.js";

// Session store (use Redis in production)
interface Session {
  walletAddress: string;
  createdAt: number;
  expiresAt: number;
  nonce: string;
}

const sessions: Map<string, Session> = new Map();

// Nonce store for signature verification
const nonces: Map<string, { nonce: string; expiresAt: number }> = new Map();

// Clean up expired sessions and nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  for (const [key, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(key);
    }
  }
  
  for (const [key, nonceEntry] of nonces.entries()) {
    if (nonceEntry.expiresAt < now) {
      nonces.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a random nonce for wallet signature
 */
export function generateNonce(walletAddress: string): string {
  const nonce = createHash("sha256")
    .update(`${walletAddress}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 32);

  // Store nonce with 5-minute expiry
  nonces.set(walletAddress, {
    nonce,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return nonce;
}

/**
 * Verify a wallet address is valid
 */
export function verifyWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a session for an authenticated wallet
 */
export function createSession(walletAddress: string): string {
  const sessionId = createHash("sha256")
    .update(`${walletAddress}:${Date.now()}:${Math.random()}`)
    .digest("hex");

  const session: Session = {
    walletAddress,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    nonce: generateNonce(walletAddress),
  };

  sessions.set(sessionId, session);
  logger.info(`Session created for wallet: ${walletAddress.slice(0, 8)}...`);

  return sessionId;
}

/**
 * Get session from request header
 */
function getSessionFromRequest(req: Request): Session | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const sessionId = authHeader.slice(7);
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Extend Request interface to include wallet info
 */
declare global {
  namespace Express {
    interface Request {
      wallet?: {
        address: string;
        session: Session;
      };
    }
  }
}

/**
 * Authentication middleware - requires valid session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);

  if (!session) {
    throw new UnauthorizedError("Authentication required. Please connect your wallet.");
  }

  // Attach wallet info to request
  req.wallet = {
    address: session.walletAddress,
    session,
  };

  next();
}

/**
 * Optional authentication - attaches wallet if session exists
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);

  if (session) {
    req.wallet = {
      address: session.walletAddress,
      session,
    };
  }

  next();
}

/**
 * Verify wallet ownership - ensures request wallet matches session wallet
 */
export function verifyWalletOwnership(addressField: string = "from") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getSessionFromRequest(req);
    
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const requestedAddress = req.body[addressField];
    
    if (!requestedAddress) {
      throw new ForbiddenError(`Missing ${addressField} in request`);
    }

    if (requestedAddress !== session.walletAddress) {
      logger.warn(
        `Wallet ownership verification failed: ` +
        `${requestedAddress.slice(0, 8)}... != ${session.walletAddress.slice(0, 8)}...`
      );
      throw new ForbiddenError("You can only perform actions with your own wallet");
    }

    req.wallet = {
      address: session.walletAddress,
      session,
    };

    next();
  };
}

/**
 * Logout - invalidate session
 */
export function invalidateSession(sessionId: string): boolean {
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Get stored nonce for wallet
 */
export function getNonce(walletAddress: string): string | null {
  const entry = nonces.get(walletAddress);
  if (!entry || entry.expiresAt < Date.now()) {
    nonces.delete(walletAddress);
    return null;
  }
  return entry.nonce;
}

/**
 * Verify and consume nonce
 */
export function verifyNonce(walletAddress: string, nonce: string): boolean {
  const storedEntry = nonces.get(walletAddress);
  
  if (!storedEntry) {
    return false;
  }

  if (storedEntry.expiresAt < Date.now()) {
    nonces.delete(walletAddress);
    return false;
  }

  if (storedEntry.nonce !== nonce) {
    return false;
  }

  // Consume the nonce (one-time use)
  nonces.delete(walletAddress);
  return true;
}

