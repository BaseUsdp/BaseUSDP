/**
 * Client-Side Signing Routes
 * 
 * NEW ARCHITECTURE ENDPOINTS:
 * - POST /api/solana/build-transfer-transaction - Build unsigned transfer transaction
 * - POST /api/solana/build-payment-transaction - Build unsigned payment transaction
 * - POST /api/solana/submit-transaction - Submit signed transaction
 * - GET /api/solana/validate-address/:address - Validate address has sufficient balance
 * - GET /api/solana/token-account/:address - Get token account info
 */

import { Router, Request, Response } from "express";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  transactionBuilderService,
  BuildTransferRequest,
  BuildPaymentRequest,
  TransactionSubmitRequest,
} from "../services/transactionBuilderService.js";
// Note: Old solanaX402Service removed - using ZK x402 service instead
// import { solanaX402Service } from "../services/solanaX402Service.js";
import { getZKX402Service } from "../services/zkX402Service.js";
import { requireInitialization } from "../middleware/initializationGuard.js";

const router = Router();

// Type definitions for request bodies
interface BuildTransferBody {
  from: string;
  to: string;
  amount: number;
  privacyLevel?: "public" | "partial" | "full";
}

interface BuildPaymentBody {
  paymentId: string;
  payerAddress: string;
  amount: number;
}

interface SubmitTransactionBody {
  signedTransaction: string;
  transactionType: "transfer" | "payment";
  paymentId?: string; // Required for payment transactions
}

/**
 * POST /api/solana/build-transfer-transaction
 * Build an unsigned confidential transfer transaction for client-side signing
 * 
 * Request Body:
 * {
 *   "from": "sender_address",
 *   "to": "recipient_address", 
 *   "amount": 100,
 *   "privacyLevel": "full" | "partial" | "public"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "unsignedTransaction": "base58_encoded_transaction",
 *   "blockhash": "blockhash_string",
 *   "lastValidBlockHeight": 12345,
 *   "message": "Transfer description"
 * }
 */
router.post("/build-transfer-transaction", async (req: Request, res: Response) => {
  try {
    // Ensure service is initialized (create connection if needed)
    try {
      transactionBuilderService.getConnection();
    } catch (serviceError) {
      // Service not initialized - create basic connection
      const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const mintAddress = process.env.TOKEN_2022_MINT_ADDRESS || "";
      if (mintAddress) {
        await transactionBuilderService.initialize(solanaRpcUrl, mintAddress);
      } else {
        return res.status(503).json({
          success: false,
          error: "Token-2022 mint not configured. Please set TOKEN_2022_MINT_ADDRESS in environment variables.",
        });
      }
    }

    const { from, to, amount, privacyLevel = "full" }: BuildTransferBody = req.body;

    // Validate required fields
    if (!from || !to || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: from, to, amount",
      });
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    // Validate privacy level
    if (!["public", "partial", "full"].includes(privacyLevel)) {
      return res.status(400).json({
        success: false,
        error: "Invalid privacy level. Must be 'public', 'partial', or 'full'",
      });
    }

    // Check if sender has sufficient SOL for fees
    const feeCheck = await transactionBuilderService.validateFeeBalance(from);
    if (!feeCheck.sufficient) {
      return res.status(400).json({
        success: false,
        error: `Insufficient SOL for transaction fees. Current balance: ${feeCheck.balance} SOL`,
      });
    }

    // Build the unsigned transaction
    const request: BuildTransferRequest = {
      from,
      to,
      amount,
      privacyLevel,
    };

    const result = await transactionBuilderService.buildConfidentialTransfer(request);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error building transfer transaction:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to build transaction",
    });
  }
});

/**
 * POST /api/solana/build-payment-transaction
 * Build an unsigned x402 payment settlement transaction for client-side signing
 * 
 * Request Body:
 * {
 *   "paymentId": "payment_identifier",
 *   "payerAddress": "payer_wallet_address",
 *   "amount": 0.10
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "unsignedTransaction": "base58_encoded_transaction",
 *   "blockhash": "blockhash_string",
 *   "lastValidBlockHeight": 12345,
 *   "message": "Payment description"
 * }
 */
router.post("/build-payment-transaction", requireInitialization, async (req: Request, res: Response) => {
  try {
    const { paymentId, payerAddress, amount }: BuildPaymentBody = req.body;

    // Validate required fields
    if (!paymentId || !payerAddress || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: paymentId, payerAddress, amount",
      });
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be a positive number",
      });
    }

    // Get payment request to retrieve recipient address (using ZK x402 service)
    const zkX402Service = getZKX402Service();
    const paymentRequest = await zkX402Service.getPaymentStatus(paymentId);
    if (!paymentRequest || !paymentRequest.success) {
      return res.status(404).json({
        success: false,
        error: "Payment request not found",
      });
    }

    // Payment must be pending
    if (paymentRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: `Payment already ${paymentRequest.status}`,
      });
    }

    // Check if payer has sufficient SOL for fees
    const feeCheck = await transactionBuilderService.validateFeeBalance(payerAddress);
    if (!feeCheck.sufficient) {
      return res.status(400).json({
        success: false,
        error: `Insufficient SOL for transaction fees. Current balance: ${feeCheck.balance} SOL`,
      });
    }

    // Note: In a real implementation, the recipient address would be stored 
    // with the payment request. For now, we use a placeholder or require it in the request.
    // This is a simplified version - you should extend the payment request storage.
    const recipientAddress = process.env.DEFAULT_RECIPIENT_ADDRESS || payerAddress;

    // Build the unsigned transaction
    const request: BuildPaymentRequest = {
      paymentId,
      payerAddress,
      recipientAddress,
      amount,
    };

    const result = await transactionBuilderService.buildPaymentSettlementTransaction(request);

    res.json({
      success: true,
      paymentId,
      ...result,
    });
  } catch (error) {
    console.error("Error building payment transaction:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to build transaction",
    });
  }
});

/**
 * POST /api/solana/submit-transaction
 * Submit a signed transaction to Solana
 * 
 * Request Body:
 * {
 *   "signedTransaction": "base58_encoded_signed_transaction",
 *   "transactionType": "transfer" | "payment",
 *   "paymentId": "optional_payment_id" // Required for payment transactions
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "signature": "transaction_signature",
 *   "confirmationStatus": "confirmed"
 * }
 */
router.post("/submit-transaction", requireInitialization, async (req: Request, res: Response) => {
  try {
    const { signedTransaction, transactionType, paymentId }: SubmitTransactionBody = req.body;

    // Validate required fields
    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: signedTransaction",
      });
    }

    if (!transactionType || !["transfer", "payment"].includes(transactionType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction type. Must be 'transfer' or 'payment'",
      });
    }

    // For payment transactions, validate payment exists
    if (transactionType === "payment") {
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: "Payment ID is required for payment transactions",
        });
      }

      const zkX402Service = getZKX402Service();
      const payment = await zkX402Service.getPaymentStatus(paymentId);
      if (!payment || !payment.success) {
        return res.status(404).json({
          success: false,
          error: "Payment request not found",
        });
      }

      if (payment.status !== "pending") {
        return res.status(400).json({
          success: false,
          error: `Payment already ${payment.status}`,
        });
      }
    }

    // Submit the signed transaction
    const result = await transactionBuilderService.submitSignedTransaction(signedTransaction);

    // If payment transaction succeeded, update payment status
    if (result.success && transactionType === "payment" && paymentId) {
      // Note: You would need to add a method to update payment status
      // For now, we'll just return the success result
      // solanaX402Service.updatePaymentStatus(paymentId, "settled", result.signature);
    }

    if (result.success) {
      res.json({
        success: true,
        signature: result.signature,
        confirmationStatus: result.confirmationStatus,
        transactionType,
        ...(paymentId && { paymentId }),
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Error submitting transaction:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit transaction",
    });
  }
});

/**
 * GET /api/solana/validate-address/:address
 * Validate that an address has sufficient SOL for transaction fees
 */
router.get("/validate-address/:address", requireInitialization, async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "Address is required",
      });
    }

    const result = await transactionBuilderService.validateFeeBalance(address);

    res.json({
      success: true,
      address,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate address",
    });
  }
});

/**
 * GET /api/solana/token-account/:address
 * Get token account information for an address
 */
router.get("/token-account/:address", requireInitialization, async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "Address is required",
      });
    }

    const result = await transactionBuilderService.getTokenAccountInfo(address);

    res.json({
      success: true,
      ownerAddress: address,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get token account info",
    });
  }
});

/**
 * GET /api/solana/balance/:address
 * Get balance for an address (token account balance + SOL balance)
 * Works even if services aren't fully initialized - creates connection on demand
 */
router.get("/balance/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "Address is required",
      });
    }

    // Create connection if not available (fast, doesn't require full init)
    let connection: Connection;
    let tokenBalance = 0;
    let tokenAccountExists = false;
    let tokenAccountAddress: string | undefined;

    try {
      // Try to use existing connection from transaction builder service
      connection = transactionBuilderService.getConnection();
      
      // Try to get token account info if service is initialized
      try {
        const tokenAccount = await transactionBuilderService.getTokenAccountInfo(address);
        tokenBalance = tokenAccount.balance || 0;
        tokenAccountExists = tokenAccount.exists || false;
        tokenAccountAddress = tokenAccount.address;
      } catch (tokenError) {
        // Token account lookup failed - service might not be initialized
        // Continue with just SOL balance
        console.log("Token account lookup failed (service may be initializing):", tokenError);
      }
    } catch (serviceError) {
      // Service not initialized - create a basic connection
      const solanaRpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      connection = new Connection(solanaRpcUrl, "confirmed");
      console.log("Using basic connection (services initializing)");
    }
    
    // Get SOL balance (always works with just a connection)
    const pubkey = new PublicKey(address);
    const solBalanceLamports = await connection.getBalance(pubkey);
    const solBalance = solBalanceLamports / 1e9;

    res.json({
      success: true,
      address,
      tokenBalance,
      solBalance,
      tokenAccountExists,
      tokenAccountAddress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance",
    });
  }
});

export default router;

