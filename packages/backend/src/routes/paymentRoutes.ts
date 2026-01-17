/**
 * Payment Routes
 * API endpoints for x402 payments and encrypted transactions
 */

import { Router } from "express";
// Note: Old x402Service removed - using ZK x402 service instead
// import { x402Service } from "../services/x402Service.js";
import { getZKX402Service } from "../services/zkX402Service.js";

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

    // Use ZK x402 service instead
    const zkX402Service = getZKX402Service();
    const paymentRequest = await zkX402Service.createPaymentRequest(
      {
        amount,
        recipient,
        serviceId,
        token: "USDC", // Default to USDC
        metadata,
      },
      req.body.wallet || "" // User wallet from request
    );

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

    // Use ZK x402 service instead
    const zkX402Service = getZKX402Service();
    const verification = await zkX402Service.verifyPayment(paymentId);
    const isValid = verification.verified;

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

    // Note: This endpoint is deprecated - use ZK x402 settle endpoint instead
    // Use /api/zk-x402/settle for ZK x402 payments
    return res.json({
      success: false,
      error: "This endpoint is deprecated. Use ZK x402 system for payments.",
      message: "Use /api/zk-x402/settle instead",
    });

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
    // Use ZK x402 service instead
    const zkX402Service = getZKX402Service();
    const payment = await zkX402Service.getPaymentStatus(paymentId);

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

