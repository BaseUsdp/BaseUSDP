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

    // DEBUG: Log received amount
    console.log(`[DEPOSIT] Received deposit request: amount=${amount}, token=${token}, type=${typeof amount}`);

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

    // Ensure amount is a number
    const depositAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a valid number greater than zero',
      });
    }

    // DEBUG: Log parsed amount
    console.log(`[DEPOSIT] Parsed amount: ${depositAmount} ${token}`);

    const result = await depositService.createDepositTransaction({
      userWallet: wallet,
      amount: depositAmount,
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
    console.log('[DEPOSIT/PROCESS] Received request:', {
      depositId: req.body.depositId,
      hasSignature: !!req.body.transactionSignature,
      wallet: req.body.wallet,
      amount: req.body.amount,
      token: req.body.token,
    });

    const { depositId, transactionSignature, wallet, amount, token } = req.body;

    if (!depositId || !transactionSignature || !wallet || !amount || !token) {
      console.error('[DEPOSIT/PROCESS] Missing required fields:', {
        depositId: !!depositId,
        transactionSignature: !!transactionSignature,
        wallet: !!wallet,
        amount: !!amount,
        token: !!token,
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: depositId, transactionSignature, wallet, amount, token',
      });
    }

    if (!['SOL', 'USDC', 'USDT'].includes(token)) {
      console.error('[DEPOSIT/PROCESS] Invalid token:', token);
      return res.status(400).json({
        success: false,
        error: 'Token must be SOL, USDC, or USDT',
      });
    }

    // Ensure amount is a number
    const depositAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    console.log('[DEPOSIT/PROCESS] Processing deposit:', {
      depositId,
      wallet,
      amount: depositAmount,
      token,
    });

    const result = await depositService.processDeposit({
      depositId,
      transactionSignature,
      userWallet: wallet,
      amount: depositAmount,
      token,
    });

    console.log('[DEPOSIT/PROCESS] Result:', {
      success: result.success,
      error: result.error,
      depositId: result.depositId,
    });

    if (!result.success) {
      console.error('[DEPOSIT/PROCESS] Deposit processing failed:', result.error);
      return res.status(500).json(result);
    }

    console.log('[DEPOSIT/PROCESS] Deposit processed successfully');
    res.json({
      success: true,
      depositId: result.depositId,
      intermediateWallet: result.intermediateWallet,
      zkProofNonce: result.zkProofNonce,
      splitParts: result.splitParts,
      message: 'Deposit processed successfully. Funds are being mixed through privacy layers.',
    });
  } catch (error) {
    console.error('[DEPOSIT/PROCESS] Unexpected error:', error);
    console.error('[DEPOSIT/PROCESS] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
