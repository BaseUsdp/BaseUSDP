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

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
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
