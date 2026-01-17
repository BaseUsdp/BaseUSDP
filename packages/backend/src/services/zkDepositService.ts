/**
 * ZK Deposit Service
 * Handles user deposits through the privacy layers:
 * 1. User → Collection Wallet
 * 2. Smart Split (2 parts)
 * 3. Jupiter Swaps (privacy mixing)
 * 4. Intermediate Wallet Assignment
 * 5. ZK Proof Account Creation
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, TransactionMessage, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection, deriveUserBalancePDA, derivePoolPDA, NOLVI_PAY_PROGRAM_ID } from '../lib/nolvi-solana.js';
import { getIntermediateWalletPool } from '../lib/intermediate-wallet-pool.js';
import { smartSplit, generatePrivacyNonce } from '../lib/zk-privacy-protection.js';
import { JupiterService } from './jupiterService.js';
import bs58 from 'bs58';

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface DepositRequest {
  userWallet: string;
  amount: number;
  token: 'SOL' | 'USDC' | 'USDT';
}

export interface DepositResult {
  success: boolean;
  depositId?: string;
  transaction?: string; // Base64 encoded unsigned transaction
  error?: string;
}

export interface ProcessDepositRequest {
  depositId: string;
  transactionSignature: string;
  userWallet: string;
  amount: number;
  token: 'SOL' | 'USDC' | 'USDT';
}

export interface ProcessDepositResult {
  success: boolean;
  depositId: string;
  intermediateWallet?: string;
  zkProofNonce?: number;
  zkProofPDA?: string;
  splitParts?: Array<{ amount: number; swapSignature?: string }>;
  error?: string;
}

export class ZKDepositService {
  private connection: Connection;
  private jupiterService: JupiterService;
  private collectionWallet: PublicKey | null = null;
  private collectionKeypair: Keypair | null = null;
  private mainWalletKeypair: Keypair | null = null;

  constructor() {
    this.connection = getSolanaConnection();
    this.jupiterService = new JupiterService(this.connection);
    this.initializeWallets();
  }

  /**
   * Initialize collection and main wallets from environment
   */
  private initializeWallets(): void {
    // Collection wallet
    const collectionAddress = process.env.COLLECTION_WALLET_ADDRESS;
    const collectionPrivateKey = process.env.COLLECTION_WALLET_PRIVATE_KEY;
    
    if (collectionAddress && collectionPrivateKey) {
      this.collectionWallet = new PublicKey(collectionAddress);
      
      try {
        // Try parsing as JSON array first
        const keyArray = JSON.parse(collectionPrivateKey);
        if (Array.isArray(keyArray)) {
          this.collectionKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        } else {
          throw new Error('Invalid format');
        }
      } catch {
        // Try as base58 string
        this.collectionKeypair = Keypair.fromSecretKey(bs58.decode(collectionPrivateKey));
      }
    }

    // Main wallet (for auto-funding)
    const mainPrivateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
    if (mainPrivateKey) {
      try {
        // Try parsing as JSON array first
        const keyArray = JSON.parse(mainPrivateKey);
        if (Array.isArray(keyArray)) {
          this.mainWalletKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        } else {
          // Try as base58 string
          this.mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(mainPrivateKey));
        }
      } catch (error) {
        console.warn('Failed to load main wallet:', error);
      }
    }
  }

  /**
   * Create deposit transaction
   * User deposits to collection wallet
   */
  async createDepositTransaction(request: DepositRequest): Promise<DepositResult> {
    try {
      if (!this.collectionWallet) {
        throw new Error('Collection wallet not configured');
      }

      const userPubkey = new PublicKey(request.userWallet);
      const tokenMint = this.getTokenMint(request.token);
      const amountLamports = this.convertToLamports(request.amount, request.token);

      // Get token accounts
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);
      const collectionTokenAccount = await getAssociatedTokenAddress(tokenMint, this.collectionWallet);

      // Build transaction
      const instructions = [];

      // Check if collection wallet's token account exists
      let collectionAccountExists = false;
      try {
        await getAccount(this.connection, collectionTokenAccount);
        collectionAccountExists = true;
      } catch {
        collectionAccountExists = false;
      }

      if (!collectionAccountExists) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            collectionTokenAccount,
            this.collectionWallet,
            tokenMint
          )
        );
      }

      // Transfer tokens from user to collection wallet
      instructions.push(
        createTransferInstruction(
          userTokenAccount,
          collectionTokenAccount,
          userPubkey,
          amountLamports
        )
      );

      // Build transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      const txMessage = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToLegacyMessage();

      const transaction = new VersionedTransaction(txMessage);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

      // Generate deposit ID
      const depositId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        depositId,
        transaction: serializedTx,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process deposit after user signs
   * Handles: smart split, Jupiter swaps, intermediate wallet assignment, ZK proof creation
   */
  async processDeposit(request: ProcessDepositRequest): Promise<ProcessDepositResult> {
    try {
      // Verify transaction was confirmed
      const signature = request.transactionSignature;
      const status = await this.connection.getSignatureStatus(signature);
      
      if (!status.value || status.value.err) {
        throw new Error('Deposit transaction failed or not confirmed');
      }

      // Smart split amount into 2 parts
      const split = smartSplit(request.amount, request.token);
      const tokenMint = this.getTokenMint(request.token);
      const collectionTokenAccount = await getAssociatedTokenAddress(tokenMint, this.collectionWallet!);

      // Get intermediate wallet (from database if available, otherwise from pool)
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      
      let intermediateWallet;
      if (dbService.isAvailable()) {
        // Check if user already has an intermediate wallet for this token
        const existingWallet = await dbService.getUserIntermediateWallet(request.wallet, request.token);
        if (existingWallet) {
          intermediateWallet = walletPool.getWalletByPublicKey(existingWallet);
        }
      }
      
      // Get new wallet if not found
      if (!intermediateWallet) {
        intermediateWallet = await walletPool.getAvailableWallet();
        
        // Save to database (per token)
        if (dbService.isAvailable()) {
          await dbService.setUserIntermediateWallet(request.wallet, intermediateWallet.publicKey, request.token);
        }
      }
      
      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = new PublicKey(intermediateWallet.publicKey);

      // Process splits with Jupiter swaps
      const splitParts: Array<{ amount: number; swapSignature?: string }> = [];
      
      for (let i = 0; i < 2; i++) {
        const splitAmount = i === 0 ? split.part1 : split.part2;
        const splitAmountLamports = this.convertToLamports(splitAmount, request.token);

        // Determine swap path for privacy
        // Part 1: USDC → USDT → USDC (if USDC/USDT)
        // Part 2: USDC → SOL → USDC (if USDC/USDT)
        // For SOL: SOL → USDC → SOL
        let swapPath: { from: 'SOL' | 'USDC' | 'USDT'; to: 'SOL' | 'USDC' | 'USDT' };
        
        if (request.token === 'SOL') {
          swapPath = i === 0 ? { from: 'SOL', to: 'USDC' } : { from: 'SOL', to: 'USDT' };
        } else if (request.token === 'USDC') {
          swapPath = i === 0 ? { from: 'USDC', to: 'USDT' } : { from: 'USDC', to: 'SOL' };
        } else {
          swapPath = i === 0 ? { from: 'USDT', to: 'USDC' } : { from: 'USDT', to: 'SOL' };
        }

        // Transfer split to intermediate wallet first
        const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
        
        // Check if intermediate wallet has token account
        let intermediateAccountExists = false;
        try {
          await getAccount(this.connection, intermediateTokenAccount);
          intermediateAccountExists = true;
        } catch {
          intermediateAccountExists = false;
        }

        // Transfer split amount to intermediate wallet
        const transferInstructions = [];
        
        if (!intermediateAccountExists && this.collectionKeypair) {
          transferInstructions.push(
            createAssociatedTokenAccountInstruction(
              this.collectionKeypair.publicKey,
              intermediateTokenAccount,
              intermediatePubkey,
              tokenMint
            )
          );
        }

        transferInstructions.push(
          createTransferInstruction(
            collectionTokenAccount,
            intermediateTokenAccount,
            this.collectionKeypair?.publicKey || this.collectionWallet!,
            splitAmountLamports
          )
        );

        // Execute transfer
        const { blockhash: transferBlockhash } = await this.connection.getLatestBlockhash();
        const transferTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: this.collectionKeypair?.publicKey || this.collectionWallet!,
            recentBlockhash: transferBlockhash,
            instructions: transferInstructions,
          }).compileToLegacyMessage()
        );

        if (this.collectionKeypair) {
          transferTx.sign([this.collectionKeypair]);
        }

        const transferSignature = await this.connection.sendRawTransaction(transferTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await this.connection.confirmTransaction(transferSignature, 'confirmed');

        // Now execute Jupiter swap for privacy
        const inputMint = this.jupiterService.getMintAddress(swapPath.from);
        const outputMint = this.jupiterService.getMintAddress(swapPath.to);
        
        // Get current balance after transfer
        const currentBalance = await getAccount(this.connection, intermediateTokenAccount);
        const swapAmount = currentBalance.amount;

        // Get quote and execute swap
        const quote = await this.jupiterService.getQuote(inputMint, outputMint, swapAmount);
        const swapResult = await this.jupiterService.executeSwapAndSubmit(
          quote,
          intermediateKeypair,
          swapPath.from === 'SOL' || swapPath.to === 'SOL'
        );

        splitParts.push({
          amount: splitAmount,
          swapSignature: swapResult.signature,
        });

        // Add random delay between swaps (1-3 minutes for privacy)
        if (i === 0) {
          const delay = Math.random() * 120000 + 60000; // 60-180 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Create ZK proof account (this will be done in Phase 3)
      // For now, generate nonce
      const zkProofNonce = generatePrivacyNonce(request.userWallet);

      // SECURITY: Log deposit transaction
      if (dbService.isAvailable()) {
        await dbService.logTransaction({
          user_wallet: request.wallet,
          intermediate_wallet: intermediateWallet.publicKey,
          type: 'deposit',
          amount: request.amount,
          token: request.token,
          nonce: zkProofNonce,
        });
      }

      return {
        success: true,
        depositId: request.depositId,
        intermediateWallet: intermediateWallet.publicKey,
        zkProofNonce,
        splitParts,
      };
    } catch (error) {
      return {
        success: false,
        depositId: request.depositId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get token mint address
   */
  private getTokenMint(token: 'SOL' | 'USDC' | 'USDT'): PublicKey {
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
   * Convert amount to lamports (smallest unit)
   */
  private convertToLamports(amount: number, token: 'SOL' | 'USDC' | 'USDT'): bigint {
    if (token === 'SOL') {
      return BigInt(Math.floor(amount * 1e9)); // SOL has 9 decimals
    } else {
      return BigInt(Math.floor(amount * 1e6)); // USDC/USDT have 6 decimals
    }
  }

  /**
   * Ensure intermediate wallet has SOL for fees
   */
  async ensureIntermediateWalletFunded(walletPubkey: PublicKey): Promise<void> {
    if (!this.mainWalletKeypair) {
      return; // Can't fund without main wallet
    }

    const balance = await this.connection.getBalance(walletPubkey);
    const MIN_SOL = 0.01 * 1e9; // 0.01 SOL minimum

    if (balance < MIN_SOL) {
      const amountToSend = MIN_SOL - balance;
      const { blockhash } = await this.connection.getLatestBlockhash();
      
      const transferTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: this.mainWalletKeypair.publicKey,
          recentBlockhash: blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: this.mainWalletKeypair.publicKey,
              toPubkey: walletPubkey,
              lamports: Number(amountToSend),
            }),
          ],
        }).compileToLegacyMessage()
      );

      transferTx.sign([this.mainWalletKeypair]);
      await this.connection.sendRawTransaction(transferTx.serialize());
    }
  }
}

// Singleton instance
let zkDepositServiceInstance: ZKDepositService | null = null;

export function getZKDepositService(): ZKDepositService {
  if (!zkDepositServiceInstance) {
    zkDepositServiceInstance = new ZKDepositService();
  }
  return zkDepositServiceInstance;
}
