/**
 * Transaction Signing Service
 * Handles client-side transaction signing with Phantom/MetaMask wallets
 * 
 * NEW ARCHITECTURE FLOW:
 * 1. Frontend requests unsigned transaction from backend
 * 2. User signs transaction with their wallet (this service)
 * 3. Frontend submits signed transaction to backend
 * 4. Backend submits to Solana blockchain
 */

import { Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getApiUrl } from "@/utils/apiConfig";

// Wallet adapter interface (compatible with Phantom/MetaMask)
export interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>;
  connected: boolean;
}

// Types for transaction signing results
export interface SigningResult {
  success: boolean;
  signedTransaction?: string; // base58 encoded
  error?: string;
}

export interface SubmitResult {
  success: boolean;
  signature?: string;
  confirmationStatus?: string;
  error?: string;
}

export interface TransactionFlowResult {
  success: boolean;
  signature?: string;
  error?: string;
  step?: "build" | "sign" | "submit";
}

// Backend API response types
interface BuildTransactionResponse {
  success: boolean;
  unsignedTransaction?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;
  message?: string;
  error?: string;
}

interface SubmitTransactionResponse {
  success: boolean;
  signature?: string;
  confirmationStatus?: string;
  error?: string;
}

/**
 * Get the wallet provider from browser window
 */
export const getPhantomProvider = (): WalletAdapter | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).phantom?.solana || (window as any).solana;
  if (provider?.isPhantom) return provider;
  return null;
};

export const getMetaMaskEVMProvider = (): any | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).ethereum;
  if (provider?.isMetaMask && !provider?.isPhantom) return provider;
  return null;
};

/**
 * Deserialize a base58-encoded transaction
 */
export function deserializeTransaction(base58Transaction: string): Transaction {
  const buffer = bs58.decode(base58Transaction);
  return Transaction.from(buffer);
}

/**
 * Serialize a transaction to base58
 */
export function serializeTransaction(transaction: Transaction): string {
  const serialized = transaction.serialize({
    requireAllSignatures: true,
    verifySignatures: false,
  });
  return bs58.encode(serialized);
}

/**
 * Sign an unsigned transaction with the user's wallet
 * 
 * @param wallet Wallet adapter (Phantom/MetaMask)
 * @param unsignedTransactionBase58 Base58-encoded unsigned transaction
 * @returns Signing result with signed transaction
 */
export async function signTransaction(
  wallet: WalletAdapter,
  unsignedTransactionBase58: string
): Promise<SigningResult> {
  try {
    // Validate wallet is connected
    if (!wallet.connected || !wallet.publicKey) {
      return {
        success: false,
        error: "Wallet not connected. Please connect your wallet first.",
      };
    }

    // Deserialize the unsigned transaction
    const transaction = deserializeTransaction(unsignedTransactionBase58);

    // Verify the transaction's fee payer matches the connected wallet
    if (transaction.feePayer && !transaction.feePayer.equals(wallet.publicKey)) {
      console.warn(
        "Transaction fee payer doesn't match connected wallet. Updating fee payer."
      );
      transaction.feePayer = wallet.publicKey;
    }

    // Sign the transaction with the wallet
    // This will trigger the wallet popup for user confirmation
    const signedTransaction = await wallet.signTransaction(transaction);

    // Serialize the signed transaction
    const signedTransactionBase58 = serializeTransaction(signedTransaction as Transaction);

    return {
      success: true,
      signedTransaction: signedTransactionBase58,
    };
  } catch (error) {
    // Handle user rejection
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (
      errorMessage.includes("rejected") ||
      errorMessage.includes("cancelled") ||
      errorMessage.includes("User rejected")
    ) {
      return {
        success: false,
        error: "Transaction signing was cancelled by user",
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Complete transaction flow: build → sign → submit
 * 
 * @param wallet Wallet adapter
 * @param buildEndpoint Backend endpoint to build transaction
 * @param submitEndpoint Backend endpoint to submit transaction
 * @param buildPayload Payload for building the transaction
 * @param transactionType Type of transaction (transfer/payment)
 * @param backendUrl Backend API base URL
 * @returns Transaction flow result
 */
export async function signAndSubmitTransaction(
  wallet: WalletAdapter,
  buildPayload: Record<string, any>,
  transactionType: "transfer" | "payment",
  backendUrl?: string
): Promise<TransactionFlowResult> {
  try {
    // Use provided backend URL or get from config
    const apiUrl = backendUrl || getApiUrl();
    
    // Step 1: Build unsigned transaction
    const buildEndpoint =
      transactionType === "transfer"
        ? "/api/solana/build-transfer-transaction"
        : "/api/solana/build-payment-transaction";

    const buildResponse = await fetch(`${apiUrl}${buildEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload),
    });

    const buildResult: BuildTransactionResponse = await buildResponse.json();

    if (!buildResult.success || !buildResult.unsignedTransaction) {
      return {
        success: false,
        error: buildResult.error || "Failed to build transaction",
        step: "build",
      };
    }

    // Step 2: Sign transaction with wallet
    const signingResult = await signTransaction(wallet, buildResult.unsignedTransaction);

    if (!signingResult.success || !signingResult.signedTransaction) {
      return {
        success: false,
        error: signingResult.error || "Failed to sign transaction",
        step: "sign",
      };
    }

    // Step 3: Submit signed transaction
    const submitPayload: any = {
      signedTransaction: signingResult.signedTransaction,
      transactionType,
    };

    // Include paymentId if it's a payment transaction
    if (transactionType === "payment" && buildPayload.paymentId) {
      submitPayload.paymentId = buildPayload.paymentId;
    }

    const submitResponse = await fetch(`${apiUrl}/api/solana/submit-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitPayload),
    });

    const submitResult: SubmitTransactionResponse = await submitResponse.json();

    if (!submitResult.success) {
      return {
        success: false,
        error: submitResult.error || "Failed to submit transaction",
        step: "submit",
      };
    }

    return {
      success: true,
      signature: submitResult.signature,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

/**
 * Execute a confidential transfer with client-side signing
 * 
 * @param wallet Wallet adapter
 * @param toAddress Recipient address
 * @param amount Amount to transfer
 * @param privacyLevel Privacy level
 * @param backendUrl Backend API URL
 * @returns Transaction result
 */
export async function executeConfidentialTransfer(
  wallet: WalletAdapter,
  toAddress: string,
  amount: number,
  privacyLevel: "public" | "partial" | "full" = "full",
  backendUrl?: string
): Promise<TransactionFlowResult> {
  if (!wallet.connected || !wallet.publicKey) {
    return {
      success: false,
      error: "Wallet not connected",
    };
  }

  const fromAddress = wallet.publicKey.toBase58();

  return signAndSubmitTransaction(
    wallet,
    {
      from: fromAddress,
      to: toAddress,
      amount,
      privacyLevel,
    },
    "transfer",
    backendUrl
  );
}

/**
 * Execute an x402 payment settlement with client-side signing
 * 
 * @param wallet Wallet adapter
 * @param paymentId Payment ID
 * @param amount Payment amount
 * @param backendUrl Backend API URL
 * @returns Transaction result
 */
export async function executePaymentSettlement(
  wallet: WalletAdapter,
  paymentId: string,
  amount: number,
  backendUrl?: string
): Promise<TransactionFlowResult> {
  if (!wallet.connected || !wallet.publicKey) {
    return {
      success: false,
      error: "Wallet not connected",
    };
  }

  const payerAddress = wallet.publicKey.toBase58();

  return signAndSubmitTransaction(
    wallet,
    {
      paymentId,
      payerAddress,
      amount,
    },
    "payment",
    backendUrl
  );
}

/**
 * Get the active EVM provider (Phantom or MetaMask)
 */
function getActiveEVMProvider(): any {
  // Try Phantom EVM first, then MetaMask
  const phantomEth = (window as any)?.phantom?.ethereum;
  if (phantomEth?.isPhantom) return phantomEth;
  const metaMask = (window as any)?.ethereum;
  if (metaMask?.isMetaMask) return metaMask;
  return null;
}

/**
 * Send an EVM transaction via Phantom or MetaMask ethereum provider
 */
export async function sendEVMTransaction(txParams: {
  to: string;
  data: string;
  value?: string;
  from?: string;
}): Promise<string> {
  const ethProvider = getActiveEVMProvider();
  if (!ethProvider) {
    throw new Error("No EVM wallet provider found (Phantom or MetaMask)");
  }

  const accounts = await ethProvider.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No Ethereum accounts found");
  }

  const txHash = await ethProvider.request({
    method: "eth_sendTransaction",
    params: [{
      from: txParams.from || accounts[0],
      to: txParams.to,
      data: txParams.data,
      value: txParams.value || "0x0",
    }],
  });

  return txHash;
}

/**
 * Sign a message via EVM personal_sign (Phantom or MetaMask)
 */
export async function signEVMMessage(message: string): Promise<string> {
  const ethProvider = getActiveEVMProvider();
  if (!ethProvider) {
    throw new Error("No EVM wallet provider found (Phantom or MetaMask)");
  }

  const accounts = await ethProvider.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No Ethereum accounts found");
  }

  const signature = await ethProvider.request({
    method: "personal_sign",
    params: [message, accounts[0]],
  });

  return signature;
}

// Types are already exported at declaration above

