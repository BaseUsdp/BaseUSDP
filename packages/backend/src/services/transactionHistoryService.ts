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
   */
  async getTransactionHistory(
    walletAddress: string,
    options: TransactionHistoryOptions = {}
  ): Promise<TransactionHistoryResult> {
    if (!this.connection) {
      throw new Error("Service not initialized");
    }

    const { limit = 20, before, until } = options;
    const pubkey = new PublicKey(walletAddress);

    try {
      // Get signatures for the wallet
      const signatures = await this.connection.getSignaturesForAddress(
        pubkey,
        {
          limit: limit + 1, // Get one extra to check if there are more
          before,
          until,
        },
        "confirmed"
      );

      // Check if there are more transactions
      const hasMore = signatures.length > limit;
      const signaturesToProcess = signatures.slice(0, limit);

      if (signaturesToProcess.length === 0) {
        return {
          transactions: [],
          hasMore: false,
        };
      }

      // Parse transactions
      const transactions = await this.parseTransactions(
        signaturesToProcess,
        walletAddress
      );

      return {
        transactions,
        hasMore,
        oldestSignature: signaturesToProcess[signaturesToProcess.length - 1]?.signature,
      };
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      throw error;
    }
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

