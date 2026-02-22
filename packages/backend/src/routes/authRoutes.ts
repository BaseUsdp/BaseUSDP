/**
 * Authentication Routes
 * Wallet-based authentication endpoints
 * 
 * SECURITY: This file handles wallet authentication.
 * Signature verification is CRITICAL - do not modify without security review.
 */

import { Router, Request, Response } from "express";
import nacl from "tweetnacl";
import bs58 from "bs58";
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

/**
 * Verify a Solana wallet signature
 * 
 * SECURITY: This is the core authentication mechanism.
 * A valid signature proves the user controls the private key for the wallet.
 * 
 * @param message - The original message that was signed
 * @param signature - Base58-encoded signature from wallet
 * @param publicKey - Base58-encoded public key (wallet address)
 * @returns true if signature is valid
 */
function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Decode the signature from base58
    const signatureBytes = bs58.decode(signature);
    
    // Decode the public key from base58
    const publicKeyBytes = bs58.decode(publicKey);
    
    // Encode the message as bytes (same as frontend)
    const messageBytes = new TextEncoder().encode(message);
    
    // Verify using nacl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
    
    return isValid;
  } catch (error) {
    // Any decoding or verification error means invalid signature
    logger.error("Signature verification error:", error);
    return false;
  }
}

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
    const message = `Sign this message to authenticate with ORB402.\n\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction.`;

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
 * SECURITY: This endpoint verifies cryptographic signatures.
 * The signature proves the user controls the wallet's private key.
 * 
 * Request: { walletAddress: string, signature: string, nonce: string }
 * Response: { success: true, sessionToken: string, expiresIn: number }
 */
router.post(
  "/verify",
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { walletAddress, signature, nonce } = req.body;

    // Validate required fields
    if (!walletAddress) {
      throw new BadRequestError("walletAddress is required");
    }
    
    if (!signature) {
      throw new BadRequestError("signature is required");
    }
    
    if (!nonce) {
      throw new BadRequestError("nonce is required");
    }

    // Validate wallet address format
    if (!verifyWalletAddress(walletAddress)) {
      throw new BadRequestError("Invalid wallet address format");
    }

    // Validate signature format (base58, reasonable length)
    if (typeof signature !== "string" || signature.length < 64 || signature.length > 128) {
      throw new BadRequestError("Invalid signature format");
    }

    // Get the stored nonce data (includes the message)
    const storedNonce = getNonce(walletAddress);
    
    if (!storedNonce) {
      throw new UnauthorizedError("No pending authentication. Please request a nonce first.");
    }

    // Verify the nonce matches and is not expired
    if (!verifyNonce(walletAddress, nonce)) {
      throw new UnauthorizedError("Invalid or expired nonce. Please request a new one.");
    }

    // Reconstruct the message that was signed
    const message = `Sign this message to authenticate with ORB402.\n\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction.`;

    // SECURITY: Verify the cryptographic signature
    const isValidSignature = verifySignature(message, signature, walletAddress);

    if (!isValidSignature) {
      logger.warn(`Invalid signature attempt for wallet: ${walletAddress.slice(0, 8)}...`);
      throw new UnauthorizedError("Invalid signature. Please try again.");
    }

    logger.info(`Signature verified for wallet: ${walletAddress.slice(0, 8)}...`);

    // Create session - only after signature is verified
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


