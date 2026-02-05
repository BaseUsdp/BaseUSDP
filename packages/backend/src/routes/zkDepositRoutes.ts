/**
 * ZK Deposit Routes
 * API endpoints for user deposits through privacy layers
 */

import { Router, Request, Response } from 'express';
import { getZKDepositService } from '../services/zkDepositService.js';
import { generalRateLimiter, requireAuth, verifyWalletOwnership } from '../middleware/index.js';

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
 * Process deposit after user signs transaction (requires auth like Nolvipay)
 * Handles: smart split, Jupiter swaps, intermediate wallet assignment
 */
router.post('/deposit/process', generalRateLimiter, requireAuth, verifyWalletOwnership('wallet'), async (req: Request, res: Response) => {
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
      pendingChangenow: result.pendingChangenow || false,
      message: result.pendingChangenow 
        ? 'Deposit initiated. ChangeNow deposits are processing and will complete automatically.'
        : 'Deposit processed successfully. Funds are being mixed through privacy layers.',
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

/**
 * POST /api/zk/deposit/complete-changenow
 * Complete pending ChangeNow deposits that timed out
 * This endpoint can be called manually or via webhook to finish deposits
 */
router.post('/deposit/complete-changenow', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { exchangeId, userWallet, token, partAmount } = req.body;

    if (!exchangeId || !userWallet || !token || !partAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: exchangeId, userWallet, token, partAmount',
      });
    }

    console.log('[DEPOSIT/COMPLETE-CHANGENOW] Completing pending ChangeNow deposit:', {
      exchangeId,
      userWallet,
      token,
      partAmount,
    });

    const result = await depositService.completeChangenowDeposit({
      exchangeId,
      userWallet,
      token,
      partAmount,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: 'ChangeNow deposit completed successfully',
      depositSignature: result.depositSignature,
    });
  } catch (error) {
    console.error('[DEPOSIT/COMPLETE-CHANGENOW] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/zk/deposit/complete-pending
 * Automatically check and complete all pending ChangeNow deposits for a user
 * This endpoint can be called after a deposit to ensure balance updates
 */
router.post('/deposit/complete-pending', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { userWallet, token } = req.body;

    if (!userWallet || !token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userWallet, token',
      });
    }

    console.log('[DEPOSIT/COMPLETE-PENDING] Checking for pending ChangeNow deposits:', {
      userWallet,
      token,
    });

    const result = await depositService.completePendingChangenowDeposits({
      userWallet,
      token,
    });

    res.json({
      success: true,
      completed: result.completed || 0,
      failed: result.failed || 0,
      message: `Completed ${result.completed || 0} pending ChangeNow deposit(s)`,
    });
  } catch (error) {
    console.error('[DEPOSIT/COMPLETE-PENDING] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
