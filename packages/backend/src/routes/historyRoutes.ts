/**
 * Transaction History Routes
 * API endpoints for fetching transaction history
 */

import { Router, Request, Response } from "express";
import {
  asyncHandler,
  BadRequestError,
  NotFoundError,
  generalRateLimiter,
  optionalAuth,
  isValidSolanaAddress,
  logger,
} from "../middleware/index.js";
import { transactionHistoryService } from "../services/transactionHistoryService.js";

const router = Router();

/**
 * GET /api/history/:address
 * Get transaction history for a wallet address
 * 
 * Query params:
 * - limit: number (default 20, max 100)
 * - before: string (signature to paginate from)
 * 
 * Response: { success: true, transactions: [...], hasMore: boolean, oldestSignature?: string }
 */
router.get(
  "/:address",
  generalRateLimiter,
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const { limit = "20", before } = req.query;

    // Validate address
    if (!isValidSolanaAddress(address)) {
      throw new BadRequestError("Invalid Solana address format");
    }

    // Parse and validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    logger.debug(`Fetching history for ${address.slice(0, 8)}... (limit: ${parsedLimit})`);

    const result = await transactionHistoryService.getTransactionHistory(address, {
      limit: parsedLimit,
      before: before as string,
    });

    res.json({
      success: true,
      address,
      ...result,
    });
  })
);

/**
 * GET /api/history/tx/:signature
 * Get details of a specific transaction
 * 
 * Response: { success: true, transaction: {...} }
 */
router.get(
  "/tx/:signature",
  generalRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { signature } = req.params;

    if (!signature || signature.length < 80) {
      throw new BadRequestError("Invalid transaction signature");
    }

    const transaction = await transactionHistoryService.getTransaction(signature);

    if (!transaction) {
      throw new NotFoundError("Transaction not found");
    }

    res.json({
      success: true,
      transaction,
    });
  })
);

/**
 * GET /api/history/:address/count
 * Get total transaction count for a wallet
 * 
 * Response: { success: true, count: number }
 */
router.get(
  "/:address/count",
  generalRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!isValidSolanaAddress(address)) {
      throw new BadRequestError("Invalid Solana address format");
    }

    const count = await transactionHistoryService.getTransactionCount(address);

    res.json({
      success: true,
      address,
      count,
    });
  })
);

/**
 * GET /api/history/:address/summary
 * Get transaction summary for a wallet (counts by type)
 * 
 * Response: { success: true, summary: { transfers: n, payments: n, ... } }
 */
router.get(
  "/:address/summary",
  generalRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!isValidSolanaAddress(address)) {
      throw new BadRequestError("Invalid Solana address format");
    }

    // Get last 100 transactions for summary
    const result = await transactionHistoryService.getTransactionHistory(address, {
      limit: 100,
    });

    // Count by type
    const summary = {
      total: result.transactions.length,
      transfers: 0,
      payments: 0,
      deposits: 0,
      withdrawals: 0,
      other: 0,
      successful: 0,
      failed: 0,
    };

    for (const tx of result.transactions) {
      switch (tx.type) {
        case "transfer":
          summary.transfers++;
          break;
        case "payment":
          summary.payments++;
          break;
        case "deposit":
          summary.deposits++;
          break;
        case "withdraw":
          summary.withdrawals++;
          break;
        default:
          summary.other++;
      }

      if (tx.status === "success") {
        summary.successful++;
      } else {
        summary.failed++;
      }
    }

    res.json({
      success: true,
      address,
      summary,
      hasMore: result.hasMore,
    });
  })
);

export default router;

