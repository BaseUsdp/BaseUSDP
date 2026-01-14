/**
 * Transaction Routes
 * API endpoints for encrypted P2P transfers
 */

import { Router } from "express";
import { encryptedTransactionService } from "../services/encryptedTransactionService.js";

const router = Router();

/**
 * POST /api/transactions/transfer
 * Execute encrypted P2P transfer
 */
router.post("/transfer", async (req, res) => {
  try {
    const { from, to, amount, privacyLevel } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({
        error: "Missing required fields: from, to, amount",
      });
    }

    // Note: In production, signer would come from authenticated session
    const result = await encryptedTransactionService.executeEncryptedTransfer(
      {
        from,
        to,
        amount,
        privacyLevel: privacyLevel || "full",
      },
      null // signer would be passed here
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
 * GET /api/transactions/balance/:address
 * Get encrypted balance for an address
 */
router.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        error: "Address is required",
      });
    }

    const encryptedBalance = await encryptedTransactionService.getEncryptedBalance(
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
 * GET /api/transactions/history/:address
 * Get encrypted transaction history
 */
router.get("/history/:address", async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        error: "Address is required",
      });
    }

    const history = await encryptedTransactionService.getEncryptedTransactionHistory(
      address
    );

    res.json({
      success: true,
      address,
      transactions: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

