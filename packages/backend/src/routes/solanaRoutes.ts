/**
 * Solana-specific API Routes
 * Handles Solana program interactions and Arcium computations
 */

import { Router } from "express";
import { solanaTransactionService } from "../services/solanaTransactionService.js";
import { solanaX402Service } from "../services/solanaX402Service.js";

const router = Router();

/**
 * POST /api/solana/initialize-account
 * Initialize encrypted account for a user
 */
router.post("/initialize-account", async (req, res) => {
  try {
    const { userAddress, encryptionPubkey } = req.body;

    if (!userAddress || !encryptionPubkey) {
      return res.status(400).json({
        error: "Missing required fields: userAddress, encryptionPubkey",
      });
    }

    // Note: In production, signer would come from authenticated session
    // For now, this is a placeholder
    res.json({
      success: true,
      message: "Account initialization queued",
      note: "Requires signer keypair in production",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/solana/encrypted-transfer
 * Execute encrypted P2P transfer on Solana
 */
router.post("/encrypted-transfer", async (req, res) => {
  try {
    const { from, to, amount, privacyLevel } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({
        error: "Missing required fields: from, to, amount",
      });
    }

    // Note: In production, signer would come from authenticated session
    const result = await solanaTransactionService.executeEncryptedTransfer(
      {
        from,
        to,
        amount,
        privacyLevel: privacyLevel || "full",
      },
      {} as any // Placeholder - would be actual Keypair
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/solana/balance/:address
 * Get encrypted balance for a Solana address
 */
router.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        error: "Address is required",
      });
    }

    const encryptedBalance = await solanaTransactionService.getEncryptedBalance(
      address
    );

    res.json({
      success: true,
      address,
      encryptedBalance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/solana/configure-account
 * Configure account for confidential transfers
 */
router.post("/configure-account", async (req, res) => {
  try {
    const { accountAddress } = req.body;

    if (!accountAddress) {
      return res.status(400).json({
        error: "Missing required field: accountAddress",
      });
    }

    // Note: This requires CLI access - may not work in all environments
    res.json({
      success: true,
      message: "Account configuration queued",
      note: "Requires spl-token CLI and proper permissions",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

