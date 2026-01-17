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
import { Connection } from "@solana/web3.js";

const router = Router();

/**
 * GET /api/history/:address
 * Get transaction history for a wallet address
 * 
 * Query params:
 * - limit: number (default 20, max 100)
 * - before: string (signature to paginate from)
 * - type: "transfer" | "payment" | "deposit" | "withdraw" (filter by type)
 * - status: "success" | "failed" (filter by status)
 * - minAmount: number (minimum amount filter)
 * - maxAmount: number (maximum amount filter)
 * - startDate: number (unix timestamp ms, start date filter)
 * - endDate: number (unix timestamp ms, end date filter)
 * 
 * Response: { success: true, transactions: [...], hasMore: boolean, oldestSignature?: string }
 */
router.get(
  "/:address",
  generalRateLimiter,
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const { 
      limit = "20", 
      before,
      type,
      status,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    } = req.query;

    // Validate address
    if (!isValidSolanaAddress(address)) {
      throw new BadRequestError("Invalid Solana address format");
    }

    // Parse and validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    // Validate type filter
    const validTypes = ["transfer", "payment", "deposit", "withdraw"];
    if (type && !validTypes.includes(type as string)) {
      throw new BadRequestError(`Invalid type filter. Must be one of: ${validTypes.join(", ")}`);
    }

    // Validate status filter
    const validStatuses = ["success", "failed"];
    if (status && !validStatuses.includes(status as string)) {
      throw new BadRequestError(`Invalid status filter. Must be one of: ${validStatuses.join(", ")}`);
    }

    // Parse amount filters
    const parsedMinAmount = minAmount ? parseFloat(minAmount as string) : undefined;
    const parsedMaxAmount = maxAmount ? parseFloat(maxAmount as string) : undefined;

    if (parsedMinAmount !== undefined && (isNaN(parsedMinAmount) || parsedMinAmount < 0)) {
      throw new BadRequestError("minAmount must be a valid positive number");
    }

    if (parsedMaxAmount !== undefined && (isNaN(parsedMaxAmount) || parsedMaxAmount < 0)) {
      throw new BadRequestError("maxAmount must be a valid positive number");
    }

    // Parse date filters
    const parsedStartDate = startDate ? parseInt(startDate as string, 10) : undefined;
    const parsedEndDate = endDate ? parseInt(endDate as string, 10) : undefined;

    if (parsedStartDate !== undefined && isNaN(parsedStartDate)) {
      throw new BadRequestError("startDate must be a valid unix timestamp (milliseconds)");
    }

    if (parsedEndDate !== undefined && isNaN(parsedEndDate)) {
      throw new BadRequestError("endDate must be a valid unix timestamp (milliseconds)");
    }

    logger.debug(`Fetching history for ${address.slice(0, 8)}... (limit: ${parsedLimit}, filters: ${type || status ? "active" : "none"})`);

    // Ensure transaction history service is initialized (creates connection if needed)
    // Check if service has connection, if not create one
    try {
      const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const connection = new Connection(solanaRpcUrl, "confirmed");
      transactionHistoryService.initialize(connection);
    } catch (initError) {
      logger.warn("Failed to initialize history service, but continuing:", initError);
    }

    const result = await transactionHistoryService.getTransactionHistory(address, {
      limit: parsedLimit,
      before: before as string,
      type: type as "transfer" | "payment" | "deposit" | "withdraw" | undefined,
      status: status as "success" | "failed" | undefined,
      minAmount: parsedMinAmount,
      maxAmount: parsedMaxAmount,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });

    res.json({
      success: true,
      address,
      filters: {
        type: type || null,
        status: status || null,
        minAmount: parsedMinAmount || null,
        maxAmount: parsedMaxAmount || null,
        startDate: parsedStartDate || null,
        endDate: parsedEndDate || null,
      },
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


