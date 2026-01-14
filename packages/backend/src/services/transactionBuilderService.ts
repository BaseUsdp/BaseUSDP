/**
 * Transaction Builder Service
 * Builds unsigned transactions for client-side signing
 * 
 * NEW ARCHITECTURE:
 * 1. Backend builds unsigned transactions (this service)
 * 2. Frontend signs with user's wallet (Phantom/Solflare)
 * 3. Frontend sends signed transaction back to backend
 * 4. Backend submits signed transaction to Solana
 */

import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

// Types for request/response bodies
export interface BuildTransferRequest {
  from: string;
  to: string;
  amount: number;
  privacyLevel: "public" | "partial" | "full";
}

export interface BuildPaymentRequest {
  paymentId: string;
  payerAddress: string;
  recipientAddress: string;
  amount: number;
}

export interface UnsignedTransactionResponse {
  unsignedTransaction: string; // base58 encoded
  blockhash: string;
  lastValidBlockHeight: number;
  message: string;
}

export interface TransactionSubmitRequest {
  signedTransaction: string; // base58 encoded
  transactionType: "transfer" | "payment";
}

export interface TransactionSubmitResponse {
  success: boolean;
  signature?: string;
  error?: string;
  confirmationStatus?: string;
}

export class TransactionBuilderService {
  private connection: Connection | null = null;
  private mintAddress: PublicKey | null = null;
  private rpcUrl: string = "";

  /**
   * Initialize service with Solana connection and Token-2022 mint
   */
  async initialize(rpcUrl: string, mintAddress: string): Promise<void> {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, "confirmed");
    this.mintAddress = new PublicKey(mintAddress);

    console.log("Transaction builder service initialized");
    console.log("RPC URL:", rpcUrl);
    console.log("Token-2022 Mint:", this.mintAddress.toBase58());
  }

  /**
   * Get Solana connection
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error("Transaction builder service not initialized");
    }
    return this.connection;
  }

  /**
   * Get mint address
   */
  getMintAddress(): PublicKey {
    if (!this.mintAddress) {
      throw new Error("Transaction builder service not initialized");
    }
    return this.mintAddress;
  }

  /**
   * Build an unsigned confidential transfer transaction
   * Returns base58-encoded unsigned transaction for client-side signing
   * 
   * @param request Transfer request details
   * @returns Unsigned transaction and blockhash info
   */
  async buildConfidentialTransfer(
    request: BuildTransferRequest
  ): Promise<UnsignedTransactionResponse> {
    if (!this.connection || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    const { from, to, amount, privacyLevel } = request;

    // Validate addresses
    let fromPubkey: PublicKey;
    let toPubkey: PublicKey;

    try {
      fromPubkey = new PublicKey(from);
      toPubkey = new PublicKey(to);
    } catch (error) {
      throw new Error("Invalid Solana address format");
    }

    // Get associated token accounts for Token-2022
    const fromTokenAccount = await getAssociatedTokenAddress(
      this.mintAddress,
      fromPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      this.mintAddress,
      toPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Build transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Check if recipient token account exists, if not, add instruction to create it
    try {
      await getAccount(this.connection, toTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
    } catch (error) {
      // Account doesn't exist, add create instruction
      const createAtaIx = createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toTokenAccount, // associated token account
        toPubkey, // owner
        this.mintAddress, // mint
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(createAtaIx);
    }

    // Convert amount to token units (assuming 9 decimals for Token-2022)
    const tokenAmount = BigInt(Math.floor(amount * 1e9));

    // Add transfer instruction
    // Note: For full confidential transfers with Token-2022, you would use
    // the confidential transfer extension instructions. This is a standard
    // transfer that works with Token-2022 program.
    const transferIx = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromPubkey,
      tokenAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    transaction.add(transferIx);

    // Serialize transaction to base58 (unsigned)
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const unsignedTransaction = bs58.encode(serializedTransaction);

    return {
      unsignedTransaction,
      blockhash,
      lastValidBlockHeight,
      message: `Transfer ${amount} tokens from ${from.slice(0, 8)}... to ${to.slice(0, 8)}... (Privacy: ${privacyLevel})`,
    };
  }

  /**
   * Build an unsigned payment settlement transaction
   * Used for x402 payment protocol settlements
   * 
   * @param request Payment request details
   * @returns Unsigned transaction and blockhash info
   */
  async buildPaymentSettlementTransaction(
    request: BuildPaymentRequest
  ): Promise<UnsignedTransactionResponse> {
    if (!this.connection || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    const { paymentId, payerAddress, recipientAddress, amount } = request;

    // Validate addresses
    let payerPubkey: PublicKey;
    let recipientPubkey: PublicKey;

    try {
      payerPubkey = new PublicKey(payerAddress);
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (error) {
      throw new Error("Invalid Solana address format");
    }

    // Get associated token accounts for Token-2022
    const payerTokenAccount = await getAssociatedTokenAddress(
      this.mintAddress,
      payerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      this.mintAddress,
      recipientPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Build transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPubkey;

    // Check if recipient token account exists
    try {
      await getAccount(this.connection, recipientTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
    } catch (error) {
      // Account doesn't exist, add create instruction
      const createAtaIx = createAssociatedTokenAccountInstruction(
        payerPubkey, // payer
        recipientTokenAccount, // associated token account
        recipientPubkey, // owner
        this.mintAddress, // mint
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(createAtaIx);
    }

    // Convert amount to token units (assuming 9 decimals)
    const tokenAmount = BigInt(Math.floor(amount * 1e9));

    // Add transfer instruction
    const transferIx = createTransferInstruction(
      payerTokenAccount,
      recipientTokenAccount,
      payerPubkey,
      tokenAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    transaction.add(transferIx);

    // Serialize transaction to base58 (unsigned)
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const unsignedTransaction = bs58.encode(serializedTransaction);

    return {
      unsignedTransaction,
      blockhash,
      lastValidBlockHeight,
      message: `x402 Payment Settlement: ${amount} tokens for payment ${paymentId.slice(0, 8)}...`,
    };
  }

  /**
   * Submit a signed transaction to Solana
   * 
   * @param signedTransactionBase58 Base58-encoded signed transaction
   * @returns Transaction result with signature
   */
  async submitSignedTransaction(
    signedTransactionBase58: string
  ): Promise<TransactionSubmitResponse> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      // Decode base58 to buffer
      const transactionBuffer = bs58.decode(signedTransactionBase58);

      // Deserialize the transaction
      const transaction = Transaction.from(transactionBuffer);

      // Send the transaction
      const signature = await this.connection.sendRawTransaction(transactionBuffer, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // Confirm the transaction
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash: transaction.recentBlockhash!,
          lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        return {
          success: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        };
      }

      return {
        success: true,
        signature,
        confirmationStatus: "confirmed",
      };
    } catch (error) {
      // Handle specific Solana errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check for common error types
      if (errorMessage.includes("insufficient funds")) {
        return {
          success: false,
          error: "Insufficient funds for transaction",
        };
      }
      
      if (errorMessage.includes("blockhash not found") || errorMessage.includes("block height exceeded")) {
        return {
          success: false,
          error: "Transaction expired. Please try again.",
        };
      }

      if (errorMessage.includes("signature verification failed")) {
        return {
          success: false,
          error: "Invalid transaction signature",
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate that an address has sufficient balance for fees
   * 
   * @param address Wallet address to check
   * @returns Whether the address has enough SOL for fees
   */
  async validateFeeBalance(address: string): Promise<{ sufficient: boolean; balance: number }> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      const minBalance = 0.001 * LAMPORTS_PER_SOL; // Minimum ~0.001 SOL for fees

      return {
        sufficient: balance >= minBalance,
        balance: balance / LAMPORTS_PER_SOL,
      };
    } catch (error) {
      return {
        sufficient: false,
        balance: 0,
      };
    }
  }

  /**
   * Check if a token account exists and get its balance
   * 
   * @param ownerAddress Owner wallet address
   * @returns Token account info
   */
  async getTokenAccountInfo(ownerAddress: string): Promise<{
    exists: boolean;
    address?: string;
    balance?: number;
  }> {
    if (!this.connection || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    try {
      const ownerPubkey = new PublicKey(ownerAddress);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        this.mintAddress,
        ownerPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const accountInfo = await getAccount(
        this.connection,
        tokenAccountAddress,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      return {
        exists: true,
        address: tokenAccountAddress.toBase58(),
        balance: Number(accountInfo.amount) / 1e9,
      };
    } catch (error) {
      return {
        exists: false,
      };
    }
  }
}

// Export singleton instance
export const transactionBuilderService = new TransactionBuilderService();
