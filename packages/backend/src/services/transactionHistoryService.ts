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
      // If we have filters, we need to fetch more transactions to apply filters
      // Then return the requested limit after filtering
      const fetchLimit = hasFilters ? Math.max(limit * 3, 100) : limit + 1;
      
      // Get signatures for the wallet
      const signatures = await this.connection.getSignaturesForAddress(
        pubkey,
        {
          limit: fetchLimit,
          before,
          until,
        },
        "confirmed"
      );

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
   */
  private async parseTransactions(
    signatures: ConfirmedSignatureInfo[],
    walletAddress: string
  ): Promise<TransactionRecord[]> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    const transactions: TransactionRecord[] = [];

    // Fetch full transaction details in batches
    const signatureStrings = signatures.map((s) => s.signature);
    const parsedTransactions = await this.connection.getParsedTransactions(
      signatureStrings,
      { maxSupportedTransactionVersion: 0 }
    );

    for (let i = 0; i < signatures.length; i++) {
      const sigInfo = signatures[i];
      const parsed = parsedTransactions[i];

      const record = this.parseTransaction(sigInfo, parsed, walletAddress);
      transactions.push(record);
    }

    return transactions;
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
   * Get transaction count for a wallet
   */
  async getTransactionCount(walletAddress: string): Promise<number> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    try {
      const pubkey = new PublicKey(walletAddress);
      
      // Get all signatures (this could be slow for wallets with many transactions)
      // In production, you might want to limit or estimate this
      const signatures = await this.connection.getSignaturesForAddress(
        pubkey,
        { limit: 1000 },
        "confirmed"
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


