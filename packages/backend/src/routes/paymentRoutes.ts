/**
 * Payment Routes
 * API endpoints for x402 payments and encrypted transactions
 */

import { Router } from "express";
import { x402Service } from "../services/x402Service.js";
import { encryptedTransactionService } from "../services/encryptedTransactionService.js";

const router = Router();

/**
 * POST /api/payments/create
 * Create a new x402 payment request
 */
router.post("/create", async (req, res) => {
  try {
    const { amount, recipient, serviceId, metadata } = req.body;

    if (!amount || !recipient || !serviceId) {
      return res.status(400).json({
        error: "Missing required fields: amount, recipient, serviceId",
      });
    }

    const paymentRequest = await x402Service.createPaymentRequest({
      amount,
      recipient,
      serviceId,
      metadata,
    });

    res.json({
      success: true,
      payment: paymentRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify an x402 payment
 */
router.post("/verify", async (req, res) => {
  try {
    const { paymentId, encryptedAmount } = req.body;

    if (!paymentId || !encryptedAmount) {
      return res.status(400).json({
        error: "Missing required fields: paymentId, encryptedAmount",
      });
    }

    const isValid = await x402Service.verifyPayment(paymentId, encryptedAmount);

    res.json({
      success: isValid,
      verified: isValid,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/payments/settle
 * Settle an x402 payment on-chain
 */
router.post("/settle", async (req, res) => {
  try {
    const { paymentId, payerAddress } = req.body;

    if (!paymentId || !payerAddress) {
      return res.status(400).json({
        error: "Missing required fields: paymentId, payerAddress",
      });
    }

    // Note: In production, signer would come from authenticated session
    // For now, this is a placeholder
    const result = await x402Service.settlePayment(
      paymentId,
      payerAddress,
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
 * GET /api/payments/status/:paymentId
 * Get payment status
 */
router.get("/status/:paymentId", (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = x402Service.getPaymentStatus(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

