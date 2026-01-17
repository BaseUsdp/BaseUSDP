/**
 * ZK x402 Routes
 * API endpoints for x402 payments with ZK proofs
 */

import { Router, Request, Response } from 'express';
import { getZKX402Service } from '../services/zkX402Service.js';
import { generalRateLimiter } from '../middleware/index.js';

const router = Router();
const x402Service = getZKX402Service();

/**
 * POST /api/zk-x402/create
 * Create x402 payment request with ZK proof
 */
router.post('/create', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { amount, recipient, service_id, token, metadata, wallet } = req.body;

    if (!amount || !recipient || !service_id || !wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, recipient, service_id, wallet',
      });
    }

    if (!['SOL', 'USDC', 'USDT'].includes(token || 'USDC')) {
      return res.status(400).json({
        success: false,
        error: 'Token must be SOL, USDC, or USDT',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero',
      });
    }

    const result = await x402Service.createPaymentRequest(
      {
        amount,
        recipient,
        serviceId: service_id,
        token: token || 'USDC',
        metadata,
      },
      wallet
    );

    res.json({
      success: true,
      paymentId: result.paymentId,
      paymentHash: result.paymentHash,
      nonce: result.nonce,
      status: result.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/zk-x402/settle
 * Settle x402 payment using ZK proof
 */
router.post('/settle', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      paymentId,
      wallet,
      proof_bytes,
      commitment_bytes,
      blinding_factor_bytes,
      wallet_signature,
      message_to_sign,
    } = req.body;

    if (!paymentId || !wallet || !proof_bytes || !commitment_bytes || !blinding_factor_bytes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: paymentId, wallet, proof_bytes, commitment_bytes, blinding_factor_bytes',
      });
    }

    const proofBytes = Buffer.from(proof_bytes, 'base64');
    const commitmentBytes = Buffer.from(commitment_bytes, 'base64');
    const blindingFactorBytes = Buffer.from(blinding_factor_bytes, 'base64');

    const result = await x402Service.settlePayment(
      paymentId,
      wallet,
      proofBytes,
      commitmentBytes,
      blindingFactorBytes,
      wallet_signature,
      message_to_sign
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      signature: result.signature,
      paymentId,
      message: 'Payment settled successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/zk-x402/status/:paymentId
 * Get payment status
 */
router.get('/status/:paymentId', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await x402Service.getPaymentStatus(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    // Verify payment if it's pending
    if (payment.status === 'pending') {
      const verification = await x402Service.verifyPayment(paymentId);
      if (verification.verified) {
        payment.status = 'settled';
      }
    }

    res.json({
      success: true,
      paymentId: payment.paymentId,
      paymentHash: payment.paymentHash,
      nonce: payment.nonce,
      proofPDA: payment.proofPDA,
      status: payment.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/zk-x402/verify
 * Verify x402 payment
 */
router.post('/verify', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: paymentId',
      });
    }

    const verification = await x402Service.verifyPayment(paymentId);

    res.json({
      success: true,
      paymentId: verification.paymentId,
      proofNonce: verification.proofNonce,
      verified: verification.verified,
      transactionSignature: verification.transactionSignature,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
