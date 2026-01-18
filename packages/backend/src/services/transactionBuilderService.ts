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
  SystemProgram,
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
    try {
      this.rpcUrl = rpcUrl;
      this.connection = new Connection(rpcUrl, "confirmed");
      this.mintAddress = new PublicKey(mintAddress);

      console.log("Transaction builder service initialized");
      console.log("RPC URL:", rpcUrl);
      console.log("Mint Address:", this.mintAddress.toBase58());
      
      // Verify connection is working
      await this.connection.getVersion();
      console.log("✅ Transaction builder service connection verified");
    } catch (error) {
      console.error("Failed to initialize transaction builder service:", error);
      // Reset connection on failure
      this.connection = null;
      throw error;
    }
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
      // This automatically creates the account for the recipient
      const createAtaIx = createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toTokenAccount, // associated token account
        toPubkey, // owner
        this.mintAddress, // mint
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(createAtaIx);
    }

    // Check if sender token account exists
    try {
      await getAccount(this.connection, fromTokenAccount, "confirmed", TOKEN_2022_PROGRAM_ID);
    } catch (error) {
      // Sender account doesn't exist - this is an error
      throw new Error(
        `Sender token account does not exist. Please create a token account first. ` +
        `Account address: ${fromTokenAccount.toBase58()}`
      );
    }

    // Convert amount to token units (assuming 9 decimals for Token-2022)
    const tokenAmount = BigInt(Math.floor(amount * 1e9));

    // Add transfer instruction based on privacy level
    // Note: Confidential transfers are currently disabled on Solana pending security audit
    // This code structure is ready for when they're re-enabled
    if (privacyLevel === "full" || privacyLevel === "partial") {
      // For confidential transfers, we would use confidential transfer extension instructions
      // Currently using standard transfer as confidential transfers are disabled
      // When re-enabled, this would use:
      // - createConfidentialTransferInstruction for full privacy
      // - createPartialConfidentialTransferInstruction for partial privacy
      
      // For now, use standard transfer (confidential transfers disabled)
      const transferIx = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        tokenAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(transferIx);
    } else {
      // Public transfer
      const transferIx = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        tokenAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      transaction.add(transferIx);
    }

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
   * @param signedTransactionEncoded Base64 or Base58-encoded signed transaction
   * @returns Transaction result with signature
   */
  async submitSignedTransaction(
    signedTransactionEncoded: string
  ): Promise<TransactionSubmitResponse> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      // Try to decode as base64 first (most common in web contexts)
      // If that fails, try base58 (legacy format)
      let transactionBuffer: Buffer;
      try {
        // Try base64 first
        transactionBuffer = Buffer.from(signedTransactionEncoded, 'base64');
      } catch {
        // Fallback to base58
        try {
          transactionBuffer = Buffer.from(bs58.decode(signedTransactionEncoded));
        } catch (decodeError) {
          throw new Error(`Invalid transaction encoding. Expected base64 or base58, got: ${decodeError instanceof Error ? decodeError.message : 'unknown error'}`);
        }
      }

      // Deserialize the transaction (try VersionedTransaction first, then legacy Transaction)
      let transaction: Transaction | any;
      let serializedTx: Buffer;
      try {
        // Try VersionedTransaction first (for newer transaction formats)
        const { VersionedTransaction } = await import('@solana/web3.js');
        transaction = VersionedTransaction.deserialize(transactionBuffer);
        serializedTx = Buffer.from(transaction.serialize());
      } catch {
        // Fallback to legacy Transaction
        transaction = Transaction.from(transactionBuffer);
        serializedTx = transactionBuffer;
      }

      // Retry logic for network errors
      let signature: string;
      let attempts = 0;
      const maxRetries = 3;
      
      while (attempts < maxRetries) {
        try {
          // Send the transaction
          signature = await this.connection.sendRawTransaction(serializedTx, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });
          break;
        } catch (err) {
          attempts++;
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          
          // Don't retry on non-network errors
          if (!errorMessage.includes("network") && !errorMessage.includes("ECONNREFUSED") && !errorMessage.includes("timeout")) {
            throw err;
          }
          
          if (attempts >= maxRetries) {
            return {
              success: false,
              error: "Network error. Please check your connection and try again.",
            };
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!signature!) {
        return {
          success: false,
          error: "Failed to send transaction after retries",
        };
      }

      // Confirm the transaction with timeout
      const confirmationPromise = this.connection.confirmTransaction(
        {
          signature,
          blockhash: transaction.recentBlockhash!,
          lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
        },
        "confirmed"
      );

      // Add timeout for confirmation (30 seconds)
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error("Transaction confirmation timeout")), 30000);
      });

      const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);

      if (confirmation && confirmation.value?.err) {
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
      if (errorMessage.includes("insufficient funds") || errorMessage.includes("insufficient balance")) {
        return {
          success: false,
          error: "Insufficient funds for transaction. Please ensure you have enough SOL for fees.",
        };
      }
      
      if (errorMessage.includes("blockhash not found") || errorMessage.includes("block height exceeded")) {
        return {
          success: false,
          error: "Transaction expired. Please try again.",
        };
      }

      if (errorMessage.includes("signature verification failed") || errorMessage.includes("invalid signature")) {
        return {
          success: false,
          error: "Invalid transaction signature. Please sign the transaction again.",
        };
      }

      if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("timeout")) {
        return {
          success: false,
          error: "Network error. Please check your connection and try again.",
        };
      }

      if (errorMessage.includes("confirmation timeout")) {
        return {
          success: false,
          error: "Transaction confirmation timed out. The transaction may still be processing. Please check the blockchain explorer.",
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

  /**
   * Build an unsigned transaction to create a Token-2022 account
   * This allows new users to receive tokens
   * 
   * SECURITY: Account creation is permissionless - anyone can create an account
   * for any wallet. The wallet owner pays the rent-exempt fee.
   * 
   * @param ownerAddress The wallet that will own the token account
   * @param payerAddress The wallet that will pay for account creation (usually same as owner)
   * @returns Unsigned transaction for account creation
   */
  async buildCreateTokenAccountTransaction(
    ownerAddress: string,
    payerAddress?: string
  ): Promise<UnsignedTransactionResponse> {
    if (!this.connection || !this.mintAddress) {
      throw new Error("Service not initialized");
    }

    // Default payer to owner if not specified
    const payer = payerAddress || ownerAddress;

    let ownerPubkey: PublicKey;
    let payerPubkey: PublicKey;

    try {
      ownerPubkey = new PublicKey(ownerAddress);
      payerPubkey = new PublicKey(payer);
    } catch (error) {
      throw new Error("Invalid Solana address format");
    }

    // Get the token account address
    const tokenAccountAddress = await getAssociatedTokenAddress(
      this.mintAddress,
      ownerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Check if account already exists
    try {
      await getAccount(this.connection, tokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
      throw new Error("Token account already exists for this wallet");
    } catch (error: any) {
      // If error is "Token account already exists", throw it
      if (error.message?.includes("already exists")) {
        throw error;
      }
      // Otherwise, account doesn't exist - continue with creation
    }

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Build transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPubkey;

    // Add create instruction
    const createAtaIx = createAssociatedTokenAccountInstruction(
      payerPubkey, // payer
      tokenAccountAddress, // associated token account
      ownerPubkey, // owner
      this.mintAddress, // mint
      TOKEN_2022_PROGRAM_ID
    );
    transaction.add(createAtaIx);

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
      message: `Create Token-2022 account for wallet ${ownerAddress.slice(0, 8)}...`,
    };
  }

  /**
   * Check if a wallet needs a token account to be created
   * 
   * @param ownerAddress Wallet address to check
   * @returns Whether account needs to be created and estimated cost
   */
  async checkTokenAccountNeeded(ownerAddress: string): Promise<{
    needsAccount: boolean;
    estimatedCost: number;
    accountAddress?: string;
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

      // Try to get the account
      try {
        await getAccount(this.connection, tokenAccountAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
        
        // Account exists
        return {
          needsAccount: false,
          estimatedCost: 0,
          accountAddress: tokenAccountAddress.toBase58(),
        };
      } catch {
        // Account doesn't exist - estimate the rent-exempt cost
        // Token-2022 accounts are ~165 bytes, rent-exempt is about 0.002 SOL
        const rentExemptBalance = await this.connection.getMinimumBalanceForRentExemption(165);
        
        return {
          needsAccount: true,
          estimatedCost: rentExemptBalance / LAMPORTS_PER_SOL,
          accountAddress: tokenAccountAddress.toBase58(),
        };
      }
    } catch (error) {
      throw new Error("Failed to check token account status");
    }
  }

  /**
   * Build a simple SOL transfer transaction (for testing)
   * This is a native SOL transfer, not a Token-2022 transfer
   * 
   * @param from Sender address
   * @param to Recipient address  
   * @param amount Amount in SOL
   * @returns Unsigned transaction
   */
  async buildSolTransfer(
    from: string,
    to: string,
    amount: number
  ): Promise<UnsignedTransactionResponse> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    let fromPubkey: PublicKey;
    let toPubkey: PublicKey;

    try {
      fromPubkey = new PublicKey(from);
      toPubkey = new PublicKey(to);
    } catch (error) {
      throw new Error("Invalid Solana address format");
    }

    // Check sender has sufficient balance
    const balance = await this.connection.getBalance(fromPubkey);
    const lamportsToSend = Math.floor(amount * LAMPORTS_PER_SOL);
    const estimatedFee = 5000; // ~0.000005 SOL

    if (balance < lamportsToSend + estimatedFee) {
      throw new Error(`Insufficient balance. Have: ${balance / LAMPORTS_PER_SOL} SOL, Need: ${(lamportsToSend + estimatedFee) / LAMPORTS_PER_SOL} SOL`);
    }

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Build transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Add SOL transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: lamportsToSend,
    });
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
      message: `Transfer ${amount} SOL from ${from.slice(0, 8)}... to ${to.slice(0, 8)}...`,
    };
  }
}

// Export singleton instance
export const transactionBuilderService = new TransactionBuilderService();
