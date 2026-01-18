/**
 * Jupiter Aggregator Service
 * Handles token swaps via Jupiter Aggregator for privacy mixing
 * 
 * Uses Jupiter API v6 for getting quotes and executing swaps
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// Jupiter API base URL
// Use the correct Jupiter API endpoint
const JUPITER_API_URL = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
}

export interface JupiterSwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export class JupiterService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get token mint address from symbol
   */
  getMintAddress(token: 'SOL' | 'USDC' | 'USDT'): PublicKey {
    switch (token) {
      case 'SOL':
        return WSOL_MINT;
      case 'USDC':
        return USDC_MINT;
      case 'USDT':
        return USDT_MINT;
      default:
        throw new Error(`Unsupported token: ${token}`);
    }
  }

  /**
   * Get swap quote from Jupiter
   */
  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippageBps: number = 50 // 0.5% slippage
  ): Promise<JupiterQuote> {
    try {
      const url = `${JUPITER_API_URL}/quote?` +
        `inputMint=${inputMint.toBase58()}&` +
        `outputMint=${outputMint.toBase58()}&` +
        `amount=${amount.toString()}&` +
        `slippageBps=${slippageBps}`;
      
      console.log(`[JupiterService] Fetching quote from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout for Vercel serverless functions
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter quote failed (${response.status}): ${error}`);
      }

      return await response.json() as JupiterQuote;
    } catch (error: any) {
      // If network error, provide helpful message
      if (error?.code === 'ENOTFOUND' || error?.message?.includes('fetch failed')) {
        throw new Error(`Jupiter API unreachable. Please check JUPITER_API_URL environment variable. Current: ${JUPITER_API_URL}`);
      }
      throw error;
    }
  }

  /**
   * Execute swap via Jupiter
   * Returns unsigned transaction for signing
   */
  async executeSwap(
    quote: JupiterQuote,
    userPublicKey: PublicKey,
    wrapUnwrapSOL: boolean = false
  ): Promise<{ swapTransaction: string; userPublicKey: string }> {
    try {
      const url = `${JUPITER_API_URL}/swap`;
      console.log(`[JupiterService] Executing swap at: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userPublicKey.toBase58(),
          wrapUnwrapSOL,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
        // Add timeout for Vercel serverless functions
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter swap failed (${response.status}): ${error}`);
      }

      const swapResult = await response.json() as { swapTransaction: string; userPublicKey: string };
      return swapResult;
    } catch (error: any) {
      // If network error, provide helpful message
      if (error?.code === 'ENOTFOUND' || error?.message?.includes('fetch failed')) {
        throw new Error(`Jupiter API unreachable. Please check JUPITER_API_URL environment variable. Current: ${JUPITER_API_URL}`);
      }
      throw error;
    }
  }

  /**
   * Execute swap and submit transaction
   * Signs with provided keypair and submits to Solana
   */
  async executeSwapAndSubmit(
    quote: JupiterQuote,
    signer: Keypair,
    wrapUnwrapSOL: boolean = false
  ): Promise<JupiterSwapResult> {
    try {
      // Get swap transaction
      const swapResult = await this.executeSwap(quote, signer.publicKey, wrapUnwrapSOL);
      
      // Deserialize transaction
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      // Sign transaction
      transaction.sign([signer]);
      
      // Submit transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return {
        success: true,
        signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Swap tokens for privacy mixing
   * Example: USDC → USDT → USDC (breaks correlation)
   */
  async mixViaSwap(
    amount: bigint,
    fromToken: 'SOL' | 'USDC' | 'USDT',
    toToken: 'SOL' | 'USDC' | 'USDT',
    signer: Keypair
  ): Promise<JupiterSwapResult> {
    const inputMint = this.getMintAddress(fromToken);
    const outputMint = this.getMintAddress(toToken);
    
    // Get quote
    const quote = await this.getQuote(inputMint, outputMint, amount);
    
    // Execute swap
    return await this.executeSwapAndSubmit(quote, signer, fromToken === 'SOL' || toToken === 'SOL');
  }
}
