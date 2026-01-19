/**
 * ZK Balance Routes
 * API endpoints for retrieving user private balances
 */

import { Router, Request, Response } from 'express';
import { getZKBalanceService } from '../services/zkBalanceService.js';
import { generalRateLimiter } from '../middleware/index.js';

const router = Router();
const balanceService = getZKBalanceService();

/**
 * GET /api/zk/balance/:wallet
 * Get user's private balance (SOL, USDC, USDT)
 */
router.get('/balance/:wallet', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const { token } = req.query; // Optional: specific token to check

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Try to complete pending ChangeNow deposits for USDC (most common)
    // This ensures balance is up-to-date when user checks
    if (!token || token === 'USDC') {
      try {
        const { getZKDepositService } = await import('../services/zkDepositService.js');
        const depositService = getZKDepositService();
        await depositService.completePendingChangenowDeposits({
          userWallet: wallet,
          token: 'USDC',
        });
      } catch (error) {
        // Don't fail balance check if pending completion fails
        console.warn('[ZK/BALANCE] Failed to complete pending deposits:', error);
      }
    }

    const balances = await balanceService.getUserBalance(wallet);

    res.json({
      success: true,
      wallet,
      balances: {
        sol: balances.sol,
        usdc: balances.usdc,
        usdt: balances.usdt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
