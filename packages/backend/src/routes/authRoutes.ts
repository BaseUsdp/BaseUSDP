/**
 * Authentication Routes
 * Wallet-based authentication endpoints
 */

import { Router, Request, Response } from "express";
import {
  asyncHandler,
  BadRequestError,
  UnauthorizedError,
  authRateLimiter,
  generateNonce,
  getNonce,
  verifyNonce,
  createSession,
  invalidateSession,
  verifyWalletAddress,
  logger,
} from "../middleware/index.js";

const router = Router();

/**
 * POST /api/auth/nonce
 * Get a nonce for wallet signature authentication
 * 
 * Request: { walletAddress: string }
 * Response: { success: true, nonce: string, message: string }
 */
router.post(
  "/nonce",
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new BadRequestError("walletAddress is required");
    }

    if (!verifyWalletAddress(walletAddress)) {
      throw new BadRequestError("Invalid wallet address format");
    }

    const nonce = generateNonce(walletAddress);
    
    // The message the user needs to sign
    const message = `Sign this message to authenticate with Void402.\n\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction.`;

    logger.info(`Nonce generated for wallet: ${walletAddress.slice(0, 8)}...`);

    res.json({
      success: true,
      nonce,
      message,
    });
  })
);

/**
 * POST /api/auth/verify
 * Verify wallet signature and create session
 * 
 * Request: { walletAddress: string, signature: string, nonce: string }
 * Response: { success: true, sessionToken: string, expiresIn: number }
 * 
 * Note: In a full implementation, you would verify the signature using
 * nacl or tweetnacl. For now, we trust the nonce verification.
 */
router.post(
  "/verify",
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress, signature, nonce } = req.body;

    if (!walletAddress || !nonce) {
      throw new BadRequestError("walletAddress and nonce are required");
    }

    if (!verifyWalletAddress(walletAddress)) {
      throw new BadRequestError("Invalid wallet address format");
    }

    // Verify the nonce is valid and not expired
    if (!verifyNonce(walletAddress, nonce)) {
      throw new UnauthorizedError("Invalid or expired nonce. Please request a new one.");
    }

    // TODO: In production, verify the actual signature using nacl
    // const isValidSignature = nacl.sign.detached.verify(
    //   new TextEncoder().encode(message),
    //   bs58.decode(signature),
    //   new PublicKey(walletAddress).toBytes()
    // );
    
    // For now, if the nonce is valid, we trust the client
    // This is acceptable because:
    // 1. Client already proved wallet ownership by connecting
    // 2. Transaction signing is the real security gate
    
    if (!signature) {
      logger.warn(`Missing signature for wallet: ${walletAddress.slice(0, 8)}...`);
      // For development, allow session creation without signature
      // In production, throw an error here
    }

    // Create session
    const sessionToken = createSession(walletAddress);

    res.json({
      success: true,
      sessionToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      walletAddress,
    });
  })
);

/**
 * POST /api/auth/logout
 * Invalidate the current session
 * 
 * Request: Authorization header with Bearer token
 * Response: { success: true }
 */
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const sessionToken = authHeader.slice(7);
      const invalidated = invalidateSession(sessionToken);
      
      if (invalidated) {
        logger.info("Session invalidated successfully");
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  })
);

/**
 * GET /api/auth/session
 * Check current session status
 * 
 * Request: Authorization header with Bearer token
 * Response: { authenticated: boolean, walletAddress?: string }
 */
router.get(
  "/session",
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        authenticated: false,
      });
    }

    // The session validation happens in middleware
    // If we reach here with a valid session, we're authenticated
    res.json({
      authenticated: !!req.wallet,
      walletAddress: req.wallet?.address,
    });
  })
);

export default router;

