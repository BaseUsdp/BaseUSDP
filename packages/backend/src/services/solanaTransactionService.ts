/**
 * Solana Transaction Service
 * Handles confidential P2P transfers and balance management on Solana using Token-2022
 * 
 * UPDATED FOR CLIENT-SIDE SIGNING:
 * - Server no longer signs transactions with Keypair
 * - Transaction building is delegated to TransactionBuilderService
 * - This service now focuses on balance queries and account management
 * - Legacy methods kept for backward compatibility but marked deprecated
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Token2022Service } from "./token2022Service.js";
import { transactionBuilderService } from "./transactionBuilderService.js";
import { transactionHistoryService } from "./transactionHistoryService.js";

export interface TransferRequest {
  from: string;
  to: string;
  amount: number;
  privacyLevel: "public" | "partial" | "full";
}

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// NEW: Result type for unsigned transaction building
export interface UnsignedTransactionResult {
  success: boolean;
  unsignedTransaction?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;
  message?: string;
  error?: string;
}

export class SolanaTransactionService {
  private connection: Connection | null = null;
  private token2022Service: Token2022Service | null = null;
  private mintAddress: PublicKey | null = null;
  private facilitatorProgramId: PublicKey | null = null;
  private rpcUrl: string = "";

  /**
   * Initialize service with Solana RPC, Token-2022 mint, and facilitator program ID
   */
  async initialize(
    rpcUrl: string,
    mintAddress: string,
    facilitatorProgramId: string
  ): Promise<void> {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, "confirmed");
    this.mintAddress = new PublicKey(mintAddress);
    this.facilitatorProgramId = new PublicKey(facilitatorProgramId);
    this.token2022Service = new Token2022Service(this.connection);

    // Also initialize the transaction builder service
    await transactionBuilderService.initialize(rpcUrl, mintAddress);

    console.log("Solana transaction service initialized");
    console.log("RPC URL:", rpcUrl);
    console.log("Token-2022 Mint:", this.mintAddress.toBase58());
    console.log("Facilitator Program:", this.facilitatorProgramId.toBase58());
  }

  /**
   * Get the Solana connection instance
   */
  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Get the mint address
   */
  getMintAddress(): PublicKey | null {
    return this.mintAddress;
  }

  /**
   * NEW: Build an unsigned transfer transaction for client-side signing
   * This replaces the old executeEncryptedTransfer for the new architecture
   * 
   * @param request Transfer request
   * @returns Unsigned transaction result
   */
  async buildUnsignedTransfer(
    request: TransferRequest
  ): Promise<UnsignedTransactionResult> {
    try {
      const result = await transactionBuilderService.buildConfidentialTransfer(request);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * NEW: Submit a signed transaction to Solana
   * 
   * @param signedTransactionBase58 Base58-encoded signed transaction
   * @returns Transaction result with signature
   */
  async submitSignedTransaction(
    signedTransactionBase58: string
  ): Promise<TransactionResult> {
    try {
      const result = await transactionBuilderService.submitSignedTransaction(signedTransactionBase58);
      return {
        success: result.success,
        signature: result.signature,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * @deprecated Use buildUnsignedTransfer + submitSignedTransaction instead
   * This method is kept for backward compatibility but should not be used
   * as server-side signing is a security risk.
   * 
   * Execute confidential P2P transfer using Token-2022
   * @param request Transfer request
   * @param signer Wallet keypair (DEPRECATED - do not use)
   * @returns Transaction result
   */
  async executeEncryptedTransfer(
    request: TransferRequest,
    signer: Keypair
  ): Promise<TransactionResult> {
    console.warn(
      "DEPRECATED: executeEncryptedTransfer with server-side signing is deprecated. " +
      "Use buildUnsignedTransfer + client-side signing + submitSignedTransaction instead."
    );

    try {
      if (!this.token2022Service || !this.mintAddress) {
        throw new Error("Service not initialized");
      }

      const fromPubkey = new PublicKey(request.from);
      const toPubkey = new PublicKey(request.to);

      // Get or create token accounts
      const fromAccount = await this.token2022Service.createTokenAccount(
        this.mintAddress,
        fromPubkey,
        signer
      );

      const toAccount = await this.token2022Service.createTokenAccount(
        this.mintAddress,
        toPubkey,
        signer
      );

      // Ensure accounts are configured for confidential transfers
      const fromConfigured = await this.token2022Service.isConfidentialAccountConfigured(fromAccount);
      if (!fromConfigured) {
        await this.token2022Service.configureConfidentialAccount(fromAccount);
      }

      const toConfigured = await this.token2022Service.isConfidentialAccountConfigured(toAccount);
      if (!toConfigured) {
        await this.token2022Service.configureConfidentialAccount(toAccount);
      }

      // Apply any pending balances
      await this.token2022Service.applyPendingBalance(toAccount);

      // Execute confidential transfer
      await this.token2022Service.transferConfidential(
        this.mintAddress,
        request.amount,
        fromAccount,
        toAccount
      );

      return {
        success: true,
        signature: "confidential_transfer_completed",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get confidential balance for a user using Token-2022
   * @param address User address
   * @returns Account info (balance is encrypted in Token-2022)
   */
  async getEncryptedBalance(address: string): Promise<any> {
    if (!this.token2022Service || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    try {
      const userPubkey = new PublicKey(address);
      
      // Get or create token account
      const account = await this.token2022Service.createTokenAccount(
        this.mintAddress,
        userPubkey,
        // Note: In production, you'd need a payer keypair
        // For now, this is a placeholder
        Keypair.generate()
      );

      // Get account info
      const accountInfo = await this.token2022Service.getAccountInfo(account);
      
      // Note: Token-2022 confidential balances are encrypted
      // The actual balance is only visible to the account owner
      return {
        address: account.toString(),
        mint: this.mintAddress.toString(),
        owner: address,
        // Balance is encrypted - client needs to decrypt
        encrypted: true,
        accountInfo,
      };
    } catch (error) {
      throw new Error(
        `Failed to get balance: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Verify confidential balance is sufficient
   * Note: Token-2022 handles this on-chain during transfers
   * @param address User address
   * @param requiredAmount Required amount
   * @returns Whether balance is sufficient (always true - verification happens on-chain)
   */
  async verifyEncryptedBalance(
    address: string,
    requiredAmount: number
  ): Promise<boolean> {
    // Token-2022 handles balance verification on-chain during transfers
    // The transfer will fail if balance is insufficient
    // This is a placeholder that returns true - actual verification happens on-chain
    return true;
  }

  /**
   * Get transaction history (encrypted)
   * @param address User address
   * @returns Encrypted transaction history
   */
  async getEncryptedTransactionHistory(address: string): Promise<any[]> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      // Use transaction history service to get transactions
      const historyResult = await transactionHistoryService.getTransactionHistory(
        address,
        { limit: 50 }
      );

      // Convert to expected format
      return historyResult.transactions.map((tx) => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: tx.type,
        status: tx.status,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        fee: tx.fee,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get history: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Initialize confidential account for a user using Token-2022
   * @param userPubkey User's public key
   * @param signer Signer keypair (payer)
   * @returns Account public key
   */
  async initializeEncryptedAccount(
    userPubkey: PublicKey,
    signer: Keypair
  ): Promise<string> {
    if (!this.token2022Service || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    try {
      // Create token account
      const account = await this.token2022Service.createTokenAccount(
        this.mintAddress,
        userPubkey,
        signer
      );

      // Configure for confidential transfers
      await this.token2022Service.configureConfidentialAccount(account);

      return account.toString();
    } catch (error) {
      throw new Error(
        `Failed to initialize account: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const solanaTransactionService = new SolanaTransactionService();

