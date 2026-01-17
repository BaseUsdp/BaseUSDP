/**
 * ZK Deposit Routes
 * API endpoints for user deposits through privacy layers
 */

import { Router, Request, Response } from 'express';
import { getZKDepositService } from '../services/zkDepositService.js';
import { generalRateLimiter } from '../middleware/index.js';

const router = Router();
const depositService = getZKDepositService();

/**
 * POST /api/zk/deposit
 * Create deposit transaction for user to sign
 */
router.post('/deposit', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { wallet, amount, token } = req.body;

    if (!wallet || !amount || !token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: wallet, amount, token',
      });
    }

    if (!['SOL', 'USDC', 'USDT'].includes(token)) {
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

    const result = await depositService.createDepositTransaction({
      userWallet: wallet,
      amount,
      token,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      depositId: result.depositId,
      transaction: result.transaction,
      amount,
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/zk/deposit/process
 * Process deposit after user signs transaction
 * Handles: smart split, Jupiter swaps, intermediate wallet assignment
 */
router.post('/deposit/process', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { depositId, transactionSignature, wallet, amount, token } = req.body;

    if (!depositId || !transactionSignature || !wallet || !amount || !token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: depositId, transactionSignature, wallet, amount, token',
      });
    }

    if (!['SOL', 'USDC', 'USDT'].includes(token)) {
      return res.status(400).json({
        success: false,
        error: 'Token must be SOL, USDC, or USDT',
      });
    }

    const result = await depositService.processDeposit({
      depositId,
      transactionSignature,
      userWallet: wallet,
      amount,
      token,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      depositId: result.depositId,
      intermediateWallet: result.intermediateWallet,
      zkProofNonce: result.zkProofNonce,
      splitParts: result.splitParts,
      message: 'Deposit processed successfully. Funds are being mixed through privacy layers.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
