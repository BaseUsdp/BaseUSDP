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
import {
  transactionBuilderService,
  BuildTransferRequest,
  BuildPaymentRequest,
  TransactionSubmitRequest,
} from "../services/transactionBuilderService.js";
import { solanaX402Service } from "../services/solanaX402Service.js";

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
 * POST /api/solana/build-sol-transfer
 * Build an unsigned simple SOL transfer transaction (for testing)
 * 
 * Request Body:
 * {
 *   "from": "sender_address",
 *   "to": "recipient_address", 
 *   "amount": 0.01 // in SOL
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
router.post("/build-sol-transfer", async (req: Request, res: Response) => {
  try {
    const { from, to, amount }: BuildTransferBody = req.body;

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

    // Build the unsigned SOL transfer transaction
    const result = await transactionBuilderService.buildSolTransfer(from, to, amount);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error building SOL transfer transaction:", error);
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
router.post("/build-payment-transaction", async (req: Request, res: Response) => {
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

    // Get payment request to retrieve recipient address
    const paymentRequest = solanaX402Service.getPaymentStatus(paymentId);
    if (!paymentRequest) {
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
router.post("/submit-transaction", async (req: Request, res: Response) => {
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

      const payment = solanaX402Service.getPaymentStatus(paymentId);
      if (!payment) {
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
router.get("/validate-address/:address", async (req: Request, res: Response) => {
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
router.get("/token-account/:address", async (req: Request, res: Response) => {
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
 * GET /api/solana/token-account-needed/:address
 * Check if a wallet needs a token account to be created
 */
router.get("/token-account-needed/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: "Address is required",
      });
    }

    const result = await transactionBuilderService.checkTokenAccountNeeded(address);

    res.json({
      success: true,
      address,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check token account status",
    });
  }
});

/**
 * POST /api/solana/build-create-account-transaction
 * Build an unsigned transaction to create a Token-2022 account
 * 
 * Request Body:
 * {
 *   "ownerAddress": "wallet_that_will_own_the_account",
 *   "payerAddress": "optional_different_payer"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "unsignedTransaction": "base58_encoded",
 *   "blockhash": "...",
 *   "lastValidBlockHeight": 12345
 * }
 */
router.post("/build-create-account-transaction", async (req: Request, res: Response) => {
  try {
    const { ownerAddress, payerAddress } = req.body;

    if (!ownerAddress) {
      return res.status(400).json({
        success: false,
        error: "ownerAddress is required",
      });
    }

    // Check if payer has enough SOL
    const payer = payerAddress || ownerAddress;
    const feeCheck = await transactionBuilderService.validateFeeBalance(payer);
    
    if (!feeCheck.sufficient) {
      return res.status(400).json({
        success: false,
        error: `Insufficient SOL for account creation. Current balance: ${feeCheck.balance.toFixed(4)} SOL`,
      });
    }

    const result = await transactionBuilderService.buildCreateTokenAccountTransaction(
      ownerAddress,
      payerAddress
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to build transaction";
    
    // Return 400 for "already exists" errors
    if (errorMessage.includes("already exists")) {
      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;


