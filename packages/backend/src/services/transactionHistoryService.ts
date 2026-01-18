/**
 * Transaction History Service
 * Fetches and parses transaction history from Solana
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Transaction types
export interface TransactionRecord {
  signature: string;
  timestamp: number;
  type: "transfer" | "payment" | "deposit" | "withdraw" | "unknown";
  status: "success" | "failed";
  from?: string;
  to?: string;
  amount?: number;
  fee: number;
  slot: number;
  memo?: string;
}

export interface TransactionHistoryResult {
  transactions: TransactionRecord[];
  hasMore: boolean;
  oldestSignature?: string;
}

export interface TransactionHistoryOptions {
  limit?: number;
  before?: string;  // Signature to start from (for pagination)
  until?: string;   // Signature to end at
  // Filtering options
  type?: "transfer" | "payment" | "deposit" | "withdraw";
  status?: "success" | "failed";
  minAmount?: number;
  maxAmount?: number;
  startDate?: number;  // Unix timestamp (ms)
  endDate?: number;    // Unix timestamp (ms)
}

export class TransactionHistoryService {
  private connection: Connection | null = null;
  private mintAddress: PublicKey | null = null;

  /**
   * Initialize service with Solana connection
   */
  initialize(connection: Connection, mintAddress?: string): void {
    this.connection = connection;
    if (mintAddress) {
      this.mintAddress = new PublicKey(mintAddress);
    }
    console.log("Transaction history service initialized");
  }

  /**
   * Get transaction history for a wallet address
   * Supports filtering by type, status, amount, and date
   */
  async getTransactionHistory(
    walletAddress: string,
    options: TransactionHistoryOptions = {}
  ): Promise<TransactionHistoryResult> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    const { 
      limit = 20, 
      before, 
      until,
      // Filtering options
      type,
      status,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    } = options;
    
    const pubkey = new PublicKey(walletAddress);
    const hasFilters = !!(type || status || minAmount !== undefined || maxAmount !== undefined || startDate || endDate);

    try {
      // Limit fetch size to avoid rate limits
      // If we have filters, we need to fetch more transactions to apply filters
      // But cap at 50 to avoid hitting rate limits
      const fetchLimit = hasFilters ? Math.min(limit * 3, 50) : Math.min(limit + 1, 50);
      
      // Get signatures for the wallet with retry logic
      let signatures: ConfirmedSignatureInfo[];
      try {
        signatures = await this.getSignaturesWithRetry(
          pubkey,
          {
            limit: fetchLimit,
            before,
            until,
          }
        );
      } catch (error: any) {
        // If rate limited, return empty result instead of failing
        if (error?.message?.includes('429') || error?.code === 429) {
          console.warn('Rate limited when fetching signatures, returning empty result');
          return {
            transactions: [],
            hasMore: false,
          };
        }
        throw error;
      }

      if (signatures.length === 0) {
        return {
          transactions: [],
          hasMore: false,
        };
      }

      // Parse all fetched transactions
      let transactions = await this.parseTransactions(
        signatures,
        walletAddress
      );

      // Apply filters
      if (hasFilters) {
        transactions = this.applyFilters(transactions, {
          type,
          status,
          minAmount,
          maxAmount,
          startDate,
          endDate,
        });
      }

      // Check if there are more transactions
      const hasMore = hasFilters 
        ? transactions.length > limit 
        : signatures.length > limit;
      
      // Limit to requested number
      const limitedTransactions = transactions.slice(0, limit);

      return {
        transactions: limitedTransactions,
        hasMore,
        oldestSignature: limitedTransactions.length > 0 
          ? limitedTransactions[limitedTransactions.length - 1]?.signature
          : undefined,
      };
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      throw error;
    }
  }

  /**
   * Apply filters to transaction list
   */
  private applyFilters(
    transactions: TransactionRecord[],
    filters: {
      type?: string;
      status?: string;
      minAmount?: number;
      maxAmount?: number;
      startDate?: number;
      endDate?: number;
    }
  ): TransactionRecord[] {
    return transactions.filter((tx) => {
      // Filter by type
      if (filters.type && tx.type !== filters.type) {
        return false;
      }

      // Filter by status
      if (filters.status && tx.status !== filters.status) {
        return false;
      }

      // Filter by minimum amount
      if (filters.minAmount !== undefined && tx.amount !== undefined) {
        if (tx.amount < filters.minAmount) {
          return false;
        }
      }

      // Filter by maximum amount
      if (filters.maxAmount !== undefined && tx.amount !== undefined) {
        if (tx.amount > filters.maxAmount) {
          return false;
        }
      }

      // Filter by start date
      if (filters.startDate && tx.timestamp < filters.startDate) {
        return false;
      }

      // Filter by end date
      if (filters.endDate && tx.timestamp > filters.endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Parse transaction signatures into detailed records
   * Uses batching and rate limiting to avoid 429 errors
   */
  private async parseTransactions(
    signatures: ConfirmedSignatureInfo[],
    walletAddress: string
  ): Promise<TransactionRecord[]> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    const transactions: TransactionRecord[] = [];
    const signatureStrings = signatures.map((s) => s.signature);

    // Batch transactions to avoid rate limits (max 5 per batch, increased delay)
    const BATCH_SIZE = 5; // Reduced from 10 to avoid rate limits
    const BATCH_DELAY = 500; // Increased from 200ms to 500ms delay between batches

    for (let i = 0; i < signatureStrings.length; i += BATCH_SIZE) {
      const batch = signatureStrings.slice(i, i + BATCH_SIZE);
      
      try {
        // Fetch batch with retry logic
        let parsedBatch = await this.fetchTransactionsWithRetry(batch);
        
        for (let j = 0; j < batch.length; j++) {
          const sigInfo = signatures[i + j];
          const parsed = parsedBatch[j];
          const record = this.parseTransaction(sigInfo, parsed, walletAddress);
          transactions.push(record);
        }

        // Add delay between batches (except for the last one)
        if (i + BATCH_SIZE < signatureStrings.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      } catch (error) {
        console.error(`Error fetching transaction batch ${i}-${i + BATCH_SIZE}:`, error);
        // Continue with next batch even if this one fails
        // Add placeholder records for failed transactions
        for (let j = 0; j < batch.length; j++) {
          const sigInfo = signatures[i + j];
          transactions.push({
            signature: sigInfo.signature,
            timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
            type: "unknown",
            status: sigInfo.err ? "failed" : "success",
            fee: 0,
            slot: sigInfo.slot,
          });
        }
      }
    }

    return transactions;
  }

  /**
   * Fetch transactions with retry logic for rate limiting
   */
  private async fetchTransactionsWithRetry(
    signatures: string[],
    maxRetries: number = 3
  ): Promise<(ParsedTransactionWithMeta | null)[]> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const parsed = await this.connection.getParsedTransactions(
          signatures,
          { maxSupportedTransactionVersion: 0 }
        );
        return parsed;
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') || 
                           error?.message?.includes('Too many requests') ||
                           error?.code === 429;
        
        if (isRateLimit && attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Rate limited, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }

    throw new Error('Failed to fetch transactions after retries');
  }

  /**
   * Parse a single transaction
   */
  private parseTransaction(
    sigInfo: ConfirmedSignatureInfo,
    parsed: ParsedTransactionWithMeta | null,
    walletAddress: string
  ): TransactionRecord {
    const record: TransactionRecord = {
      signature: sigInfo.signature,
      timestamp: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
      type: "unknown",
      status: sigInfo.err ? "failed" : "success",
      fee: 0,
      slot: sigInfo.slot,
    };

    if (!parsed) {
      return record;
    }

    // Extract fee
    record.fee = parsed.meta?.fee || 0;

    // Extract memo if present
    if (sigInfo.memo) {
      record.memo = sigInfo.memo;
    }

    // Try to determine transaction type and extract details
    const instructions = parsed.transaction.message.instructions;
    
    for (const instruction of instructions) {
      if ("parsed" in instruction) {
        const parsedInstruction = instruction.parsed;
        
        // Token transfer
        if (
          parsedInstruction.type === "transfer" ||
          parsedInstruction.type === "transferChecked"
        ) {
          record.type = "transfer";
          const info = parsedInstruction.info;
          
          record.from = info.authority || info.source;
          record.to = info.destination;
          record.amount = parseFloat(info.amount) / 1e9 || info.tokenAmount?.uiAmount;
        }
        
        // Deposit to confidential
        if (parsedInstruction.type === "depositConfidential") {
          record.type = "deposit";
          const info = parsedInstruction.info;
          record.amount = parseFloat(info.amount) / 1e9;
        }
        
        // Withdraw from confidential
        if (parsedInstruction.type === "withdrawConfidential") {
          record.type = "withdraw";
          const info = parsedInstruction.info;
          record.amount = parseFloat(info.amount) / 1e9;
        }
      }
    }

    // Determine if this is incoming or outgoing
    if (record.from === walletAddress) {
      // Outgoing transfer
    } else if (record.to === walletAddress) {
      // Incoming transfer
    }

    return record;
  }

  /**
   * Get a single transaction by signature
   */
  async getTransaction(signature: string): Promise<TransactionRecord | null> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      const sigInfo = await this.connection.getSignatureStatus(signature);
      const parsed = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!parsed) {
        return null;
      }

      // Create a minimal sigInfo-like object
      const confirmationStatus = sigInfo.value?.confirmationStatus;
      const minSigInfo: ConfirmedSignatureInfo = {
        signature,
        slot: parsed.slot,
        err: sigInfo.value?.err || null,
        memo: null,
        blockTime: parsed.blockTime,
        confirmationStatus,
      };

      return this.parseTransaction(minSigInfo, parsed, "");
    } catch (error) {
      console.error("Error fetching transaction:", error);
      return null;
    }
  }

  /**
   * Get signatures with retry logic for rate limiting
   */
  private async getSignaturesWithRetry(
    pubkey: PublicKey,
    options: { limit?: number; before?: string; until?: string },
    maxRetries: number = 3
  ): Promise<ConfirmedSignatureInfo[]> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    // Import rate limiter
    const { getRPCRateLimiter } = await import('../lib/rpcRateLimiter.js');
    const rateLimiter = getRPCRateLimiter();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait if needed to respect rate limits
        await rateLimiter.waitIfNeeded('getSignaturesForAddress');
        
        const signatures = await this.connection.getSignaturesForAddress(
          pubkey,
          options,
          "confirmed"
        );
        return signatures;
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') || 
                           error?.message?.includes('Too many requests') ||
                           error?.code === 429;
        
        if (isRateLimit && attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s (capped at 10s)
          const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);
          console.warn(`Rate limited when fetching signatures, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Wait again through rate limiter before retry
          await rateLimiter.waitIfNeeded('getSignaturesForAddress');
          continue;
        }
        
        throw error;
      }
    }

    throw new Error('Failed to fetch signatures after retries');
  }

  /**
   * Get transaction count for a wallet
   */
  async getTransactionCount(walletAddress: string): Promise<number> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      const pubkey = new PublicKey(walletAddress);
      
      // Limit to 100 to avoid rate limits
      const signatures = await this.getSignaturesWithRetry(
        pubkey,
        { limit: 100 }
      );

      return signatures.length;
    } catch (error) {
      console.error("Error getting transaction count:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const transactionHistoryService = new TransactionHistoryService();


