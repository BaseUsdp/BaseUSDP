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
   * Helper to add delays between RPC calls to avoid rate limits
   */
  private async rateLimitedRpcCall<T>(
    operation: () => Promise<T>,
    delayMs: number = 2000, // 2 seconds default (matches industry standard 3-15s polling)
    maxRetries: number = 5
  ): Promise<T> {
    // Add delay BEFORE the call to space out requests (industry standard: 3-15s)
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        // Add delay AFTER successful call to prevent rapid-fire requests
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return result;
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') ||
                           error?.message?.includes('Too many requests') ||
                           error?.message?.includes('rate limits exceeded') ||
                           error?.message?.includes('Connection rate limits exceeded') ||
                           error?.code === 429;

        if (isRateLimit && attempt < maxRetries - 1) {
          // Exponential backoff: 5s, 10s, 20s, 40s, 80s (much longer delays)
          const retryDelay = Math.pow(2, attempt + 1) * 5000; // Start at 5 seconds
          console.warn(`[ZKDepositService] Rate limited (429), retrying after ${retryDelay/1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('RPC call failed after multiple retries');
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
        // First try as base58 string (most common format)
        this.collectionKeypair = Keypair.fromSecretKey(bs58.decode(collectionPrivateKey));
      } catch {
        // Fallback to JSON array format
        try {
          const keyArray = JSON.parse(collectionPrivateKey);
          if (Array.isArray(keyArray)) {
            this.collectionKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
          } else {
            console.warn('Failed to load collection wallet: Invalid format');
          }
        } catch (parseError) {
          console.warn('Failed to load collection wallet:', parseError instanceof Error ? parseError.message : 'Unknown error');
        }
      }
    }

    // Main wallet (for auto-funding)
    const mainPrivateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
    if (mainPrivateKey) {
      try {
        // First try as base58 string (most common format)
        this.mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(mainPrivateKey));
      } catch {
        // Fallback to JSON array format
        try {
          const keyArray = JSON.parse(mainPrivateKey);
          if (Array.isArray(keyArray)) {
            this.mainWalletKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
          } else {
            console.warn('Failed to load main wallet: Invalid format');
          }
        } catch (parseError) {
          console.warn('Failed to load main wallet:', parseError instanceof Error ? parseError.message : 'Unknown error');
        }
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

      // DEBUG: Log received request
      console.log(`[ZKDepositService] createDepositTransaction: amount=${request.amount}, token=${request.token}, type=${typeof request.amount}`);

      const userPubkey = new PublicKey(request.userWallet);
      const amountLamports = this.convertToLamports(request.amount, request.token);
      
      // DEBUG: Log converted lamports
      console.log(`[ZKDepositService] Converted ${request.amount} ${request.token} to ${amountLamports.toString()} lamports`);

      // FIX: Check balance and account for transaction fees (with rate limiting)
      if (request.token === 'SOL') {
        // For SOL, check native balance and ensure enough for transfer + fees
        const balance = await this.rateLimitedRpcCall(
          () => this.connection.getBalance(userPubkey),
          2000 // 2 seconds
        );
        // Use a more conservative fee estimate (10,000 lamports = 0.00001 SOL)
        // This accounts for potential fee variations and ensures we don't fail during simulation
        const estimatedFee = 10000; // ~0.00001 SOL for transaction fee (conservative estimate)
        const requiredBalance = Number(amountLamports) + estimatedFee;
        
        if (balance < requiredBalance) {
          const available = balance / 1e9; // Convert to SOL
          const needed = requiredBalance / 1e9;
          const maxDepositable = Math.max(0, (balance - estimatedFee) / 1e9);
          return {
            success: false,
            error: `Insufficient SOL balance. Available: ${available.toFixed(9)} SOL, Required: ${needed.toFixed(9)} SOL (including ~0.00001 SOL for transaction fees). Maximum you can deposit: ${maxDepositable.toFixed(9)} SOL.`,
          };
        }
      } else {
        // For USDC/USDT, check token account balance
        const tokenMint = this.getTokenMint(request.token);
        const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);
        
        try {
          const tokenAccount = await this.rateLimitedRpcCall(
            () => getAccount(this.connection, userTokenAccount),
            2000 // 2 seconds
          );
          const balance = tokenAccount.amount;
          
          if (balance < amountLamports) {
            const available = Number(balance) / (request.token === 'USDC' || request.token === 'USDT' ? 1e6 : 1e9);
            const needed = request.amount;
            return {
              success: false,
              error: `Insufficient ${request.token} balance. Available: ${available.toFixed(6)} ${request.token}, Required: ${needed.toFixed(6)} ${request.token}.`,
            };
          }
        } catch {
          return {
            success: false,
            error: `Token account not found. Please ensure you have ${request.token} in your wallet.`,
          };
        }
      }

      // Build transaction
      const instructions = [];
      const { blockhash } = await this.rateLimitedRpcCall(
        () => this.connection.getLatestBlockhash(),
        2000 // 2 seconds
      );

      // FIX 1: Handle SOL deposits as native SOL transfers (not WSOL)
      if (request.token === 'SOL') {
        // Re-check balance right before building transaction (in case it changed)
        const finalBalance = await this.rateLimitedRpcCall(
          () => this.connection.getBalance(userPubkey),
          2000 // 2 seconds
        );
        const estimatedFee = 10000; // ~0.00001 SOL
        const requiredBalance = Number(amountLamports) + estimatedFee;
        
        if (finalBalance < requiredBalance) {
          const available = finalBalance / 1e9;
          const maxDepositable = Math.max(0, (finalBalance - estimatedFee) / 1e9);
          return {
            success: false,
            error: `Insufficient SOL balance. Available: ${available.toFixed(9)} SOL, Required: ${(requiredBalance / 1e9).toFixed(9)} SOL. Maximum you can deposit: ${maxDepositable.toFixed(9)} SOL.`,
          };
        }
        
        // Native SOL transfer - no token accounts needed
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: userPubkey,
            toPubkey: this.collectionWallet,
            lamports: Number(amountLamports),
          })
        );
      } else {
        // FIX 2: For USDC/USDT, check if user's token account exists
        const tokenMint = this.getTokenMint(request.token);
        const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);
        const collectionTokenAccount = await getAssociatedTokenAddress(tokenMint, this.collectionWallet);

        // Check if user's token account exists (with rate limiting)
        let userAccountExists = false;
        try {
          await this.rateLimitedRpcCall(
            () => getAccount(this.connection, userTokenAccount),
            2000 // 2 seconds
          );
          userAccountExists = true;
        } catch {
          userAccountExists = false;
        }

        // If user doesn't have token account, create it (requires SOL for rent)
        if (!userAccountExists) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              userPubkey,
              userTokenAccount,
              userPubkey,
              tokenMint
            )
          );
        }

        // Check if collection wallet's token account exists (with rate limiting)
        let collectionAccountExists = false;
        try {
          await this.rateLimitedRpcCall(
            () => getAccount(this.connection, collectionTokenAccount),
            2000 // 2 seconds
          );
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
      }

      // Build transaction
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
      console.log('[ZKDepositService] processDeposit started:', {
        depositId: request.depositId,
        userWallet: request.userWallet,
        amount: request.amount,
        token: request.token,
        hasSignature: !!request.transactionSignature,
      });

      // Verify transaction was confirmed
      const signature = request.transactionSignature;
      console.log('[ZKDepositService] Checking transaction status for signature:', signature);
      
      const status = await this.rateLimitedRpcCall(
        () => this.connection.getSignatureStatus(signature),
        3000 // 3 seconds (transaction status checks can be slower)
      );
      
      console.log('[ZKDepositService] Transaction status:', {
        hasValue: !!status.value,
        err: status.value?.err,
        confirmationStatus: status.value?.confirmationStatus,
      });
      
      if (!status.value || status.value.err) {
        throw new Error('Deposit transaction failed or not confirmed');
      }

      // Smart split amount into 2 parts
      console.log('[ZKDepositService] Splitting amount:', request.amount, request.token);
      const split = smartSplit(request.amount, request.token);
      console.log('[ZKDepositService] Split result:', split);
      
      // FIX: For SOL deposits, funds arrive as native SOL (not WSOL token account)
      // For USDC/USDT, use token accounts
      let tokenMint: PublicKey;
      let collectionTokenAccount: PublicKey | null = null;
      
      if (request.token === 'SOL') {
        // SOL deposits are native SOL transfers, no token account needed
        tokenMint = WSOL_MINT; // Use WSOL for swaps later
        // No token account for SOL - it's native balance
      } else {
        tokenMint = this.getTokenMint(request.token);
        collectionTokenAccount = await getAssociatedTokenAddress(tokenMint, this.collectionWallet!);
      }

      // Get intermediate wallet (from database if available, otherwise from pool)
      console.log('[ZKDepositService] Getting database service...');
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      console.log('[ZKDepositService] Database service available:', dbService.isAvailable());
      
      console.log('[ZKDepositService] Initializing wallet pool...');
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      console.log('[ZKDepositService] Wallet pool initialized');
      
      const userWallet = request.userWallet;
      
      let intermediateWallet;
      if (dbService.isAvailable()) {
        console.log('[ZKDepositService] Checking for existing intermediate wallet for user:', userWallet);
        // Check if user already has an intermediate wallet for this token
        const existingWallet = await dbService.getUserIntermediateWallet(userWallet, request.token);
        if (existingWallet) {
          console.log('[ZKDepositService] Found existing intermediate wallet:', existingWallet);
          intermediateWallet = walletPool.getWalletByPublicKey(existingWallet);
        } else {
          console.log('[ZKDepositService] No existing intermediate wallet found');
        }
      }
      
      // Get new wallet if not found
      if (!intermediateWallet) {
        console.log('[ZKDepositService] Getting new intermediate wallet from pool...');
        intermediateWallet = await walletPool.getAvailableWallet();
        console.log('[ZKDepositService] Assigned intermediate wallet:', intermediateWallet.publicKey);
        
        // Save to database (per token)
        if (dbService.isAvailable()) {
          console.log('[ZKDepositService] Saving intermediate wallet to database...');
          await dbService.setUserIntermediateWallet(userWallet, intermediateWallet.publicKey, request.token);
          console.log('[ZKDepositService] Intermediate wallet saved to database');
        }
      }
      
      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = new PublicKey(intermediateWallet.publicKey);
      console.log('[ZKDepositService] Intermediate wallet keypair created:', intermediatePubkey.toString());

      // Process splits with Jupiter swaps
      console.log('[ZKDepositService] Starting split processing (2 parts)...');
      const splitParts: Array<{ amount: number; swapSignature?: string }> = [];
      
      for (let i = 0; i < 2; i++) {
        console.log(`[ZKDepositService] Processing split part ${i + 1}/2...`);
        const splitAmount = i === 0 ? split.part1 : split.part2;
        const splitAmountLamports = this.convertToLamports(splitAmount, request.token);
        console.log(`[ZKDepositService] Split part ${i + 1} amount: ${splitAmount} ${request.token} = ${splitAmountLamports.toString()} lamports`);

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
        console.log(`[ZKDepositService] Swap path for part ${i + 1}: ${swapPath.from} → ${swapPath.to}`);

        // PRIVACY FIX: Use a random intermediate wallet as a "mixer" before user's final wallet
        // This breaks the direct link: Collection → Random Mixer → User's Wallet
        console.log(`[ZKDepositService] Getting mixer wallet for part ${i + 1}...`);
        const walletPool = getIntermediateWalletPool();
        await walletPool.initialize();
        
        // Get a random mixer wallet (NOT the user's wallet)
        let mixerWallet = await walletPool.getAvailableWallet();
        console.log(`[ZKDepositService] Selected mixer wallet: ${mixerWallet.publicKey}`);
        // Make sure it's not the user's wallet
        while (mixerWallet.publicKey === intermediateWallet.publicKey) {
          console.log(`[ZKDepositService] Mixer wallet matches user wallet, getting new one...`);
          mixerWallet = await walletPool.getAvailableWallet();
        }
        
        const mixerKeypair = Keypair.fromSecretKey(Uint8Array.from(mixerWallet.privateKey));
        const mixerPubkey = new PublicKey(mixerWallet.publicKey);
        
        // PRIVACYUSD APPROACH: Combine ALL transfers in ONE atomic transaction
        // This prevents "Attempt to debit an account but found no record of a prior credit" errors
        // Collection → Mixer → User's Intermediate (all in one transaction)
        console.log(`[ZKDepositService] Building atomic multi-hop transfer (Collection → Mixer → User)...`);
        const allInstructions = [];
        
        if (request.token === 'SOL') {
          // Check collection wallet balance first
          console.log(`[ZKDepositService] Checking collection wallet balance for SOL transfer...`);
          const collectionBalance = await this.rateLimitedRpcCall(
            () => this.connection.getBalance(this.collectionWallet!),
            2000 // 2 seconds
          );
          console.log(`[ZKDepositService] Collection wallet balance: ${collectionBalance} lamports (${collectionBalance / 1e9} SOL), Required: ${Number(splitAmountLamports)} lamports (${Number(splitAmountLamports) / 1e9} SOL)`);
          
          if (collectionBalance < splitAmountLamports) {
            const errorMsg = `Collection wallet has insufficient balance. Required: ${Number(splitAmountLamports)} lamports (${Number(splitAmountLamports) / 1e9} SOL), Available: ${collectionBalance} lamports (${collectionBalance / 1e9} SOL)`;
            console.error(`[ZKDepositService] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          // Step 1: Collection → Mixer (native SOL)
          console.log(`[ZKDepositService] Adding Collection → Mixer SOL transfer...`);
          allInstructions.push(
            SystemProgram.transfer({
              fromPubkey: this.collectionWallet!,
              toPubkey: mixerPubkey,
              lamports: Number(splitAmountLamports),
            })
          );
          
          // Step 2: Mixer → User's Intermediate (native SOL)
          // Note: Collection wallet pays for the transaction fees
          console.log(`[ZKDepositService] Adding Mixer → User SOL transfer...`);
          allInstructions.push(
            SystemProgram.transfer({
              fromPubkey: mixerPubkey,
              toPubkey: intermediatePubkey,
              lamports: Number(splitAmountLamports),
            })
          );
        } else {
          // Token transfer (USDC/USDT)
          if (!collectionTokenAccount) {
            throw new Error('Collection token account not found for token transfer');
          }
          
          const mixerTokenAccount = await getAssociatedTokenAddress(tokenMint, mixerPubkey);
          let mixerAccountExists = false;
          try {
            await this.rateLimitedRpcCall(
              () => getAccount(this.connection, mixerTokenAccount),
              2000 // 2 seconds
            );
            mixerAccountExists = true;
          } catch {
            mixerAccountExists = false;
          }
          
          if (!mixerAccountExists && this.collectionKeypair) {
            allInstructions.push(
              createAssociatedTokenAccountInstruction(
                this.collectionKeypair.publicKey,
                mixerTokenAccount,
                mixerPubkey,
                tokenMint
              )
            );
          }

          // Step 3: Collection → Mixer (token transfer)
          console.log(`[ZKDepositService] Adding Collection → Mixer token transfer...`);
          allInstructions.push(
            createTransferInstruction(
              collectionTokenAccount,
              mixerTokenAccount,
              this.collectionKeypair?.publicKey || this.collectionWallet!,
              splitAmountLamports
            )
          );
          
          // Step 4: Mixer → User's Intermediate (token transfer)
          // This happens in the SAME transaction, so mixer account is credited before we debit it
          console.log(`[ZKDepositService] Adding Mixer → User token transfer...`);
          const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
          let intermediateAccountExists = false;
          try {
            await this.rateLimitedRpcCall(
              () => getAccount(this.connection, intermediateTokenAccount),
              2000 // 2 seconds
            );
            intermediateAccountExists = true;
          } catch {
            intermediateAccountExists = false;
          }
          
          // Create intermediate token account if needed (collection wallet pays)
          if (!intermediateAccountExists && this.collectionKeypair) {
            console.log(`[ZKDepositService] Adding create intermediate token account instruction...`);
            allInstructions.push(
              createAssociatedTokenAccountInstruction(
                this.collectionKeypair.publicKey, // Collection wallet pays for account creation
                intermediateTokenAccount,
                intermediatePubkey,
                tokenMint
              )
            );
          }
          
          allInstructions.push(
            createTransferInstruction(
              mixerTokenAccount,
              intermediateTokenAccount,
              mixerKeypair.publicKey, // Mixer wallet signs this transfer
              splitAmountLamports
            )
          );
        }

        // Execute ALL transfers in ONE atomic transaction (like privacyusd)
        console.log(`[ZKDepositService] Getting blockhash for atomic multi-hop transaction...`);
        const { blockhash } = await this.rateLimitedRpcCall(
          () => this.connection.getLatestBlockhash(),
          3000 // 3 seconds (blockhash is critical, allow more time)
        );
        console.log(`[ZKDepositService] Blockhash obtained: ${blockhash}`);
        
        console.log(`[ZKDepositService] Building atomic transaction with ${allInstructions.length} instruction(s)...`);
        const atomicTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: this.collectionKeypair?.publicKey || this.collectionWallet!, // Collection wallet pays all fees
            recentBlockhash: blockhash,
            instructions: allInstructions,
          }).compileToLegacyMessage()
        );

        // Sign with both collection wallet (payer) and mixer wallet (for mixer → user transfer)
        const signers = [this.collectionKeypair!];
        if (request.token !== 'SOL') {
          // For token transfers, mixer needs to sign the mixer → user transfer
          signers.push(mixerKeypair);
        }
        
        console.log(`[ZKDepositService] Signing atomic transaction with ${signers.length} signer(s)...`);
        atomicTx.sign(signers);
        console.log(`[ZKDepositService] Transaction signed`);

        console.log(`[ZKDepositService] Sending atomic multi-hop transaction to Solana network...`);
        const atomicSignature = await this.rateLimitedRpcCall(
          () => this.connection.sendRawTransaction(atomicTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          }),
          3000 // 3 seconds (transaction sending is critical)
        );
        console.log(`[ZKDepositService] Atomic transaction sent, signature: ${atomicSignature}`);

        console.log(`[ZKDepositService] Confirming atomic transaction...`);
        await this.rateLimitedRpcCall(
          () => this.connection.confirmTransaction(atomicSignature, 'confirmed'),
          5000 // 5 seconds (confirmation can take time)
        );
        console.log(`[ZKDepositService] Atomic transaction confirmed: Collection → Mixer → User (all in one transaction)`);

        // Now execute Jupiter swap for privacy
        // Note: Funds are now in user's intermediate wallet after the atomic transfer
        console.log(`[ZKDepositService] Preparing Jupiter swap for privacy mixing...`);
        const inputMint = this.jupiterService.getMintAddress(swapPath.from);
        const outputMint = this.jupiterService.getMintAddress(swapPath.to);
        
        // Get current balance after transfer (with rate limiting)
        let swapAmount: bigint;
        if (request.token === 'SOL') {
          // For SOL, get native balance
          console.log(`[ZKDepositService] Getting intermediate wallet SOL balance for swap...`);
          const solBalance = await this.rateLimitedRpcCall(
            () => this.connection.getBalance(intermediatePubkey),
            2000 // 2 seconds
          );
          swapAmount = BigInt(solBalance);
          console.log(`[ZKDepositService] Intermediate wallet SOL balance: ${solBalance} lamports (${solBalance / 1e9} SOL)`);
        } else {
          // For tokens, get token account balance
          console.log(`[ZKDepositService] Getting intermediate wallet token account balance for swap...`);
          const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
          const currentBalance = await this.rateLimitedRpcCall(
            () => getAccount(this.connection, intermediateTokenAccount),
            2000 // 2 seconds
          );
          swapAmount = currentBalance.amount;
        }

        // Get quote and execute swap
        // NOTE: If Jupiter API is unavailable, skip swap but continue deposit
        // Funds will remain in original token (still in intermediate wallet)
        try {
          console.log(`[ZKDepositService] Attempting Jupiter swap for part ${i + 1}...`);
          const quote = await this.jupiterService.getQuote(inputMint, outputMint, swapAmount);
          const swapResult = await this.jupiterService.executeSwapAndSubmit(
            quote,
            intermediateKeypair,
            swapPath.from === 'SOL' || swapPath.to === 'SOL'
          );

          // Check if swap failed
          if (!swapResult.success) {
            console.warn(`[ZKDepositService] Jupiter swap failed for part ${i + 1}:`, swapResult.error);
            // Continue anyway - funds are still in intermediate wallet, just not swapped
            // This is better than failing the entire deposit
          } else {
            console.log(`[ZKDepositService] Jupiter swap successful for part ${i + 1}, signature: ${swapResult.signature}`);
          }
        } catch (swapError: any) {
          // If Jupiter API is unreachable, log warning but don't fail deposit
          console.warn(`[ZKDepositService] Jupiter swap skipped for part ${i + 1} (API unavailable):`, swapError?.message || swapError);
          console.warn(`[ZKDepositService] Funds remain in ${swapPath.from} (not swapped to ${swapPath.to})`);
          // Continue - deposit is still successful, just without swap
        }

        splitParts.push({
          amount: splitAmount,
          swapSignature: swapResult.signature || undefined,
        });

        // Add random delay between swaps (1-3 minutes for privacy)
        if (i === 0) {
          const delay = Math.random() * 120000 + 60000; // 60-180 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Create ZK proof account (this will be done in Phase 3)
      // For now, generate nonce
      const zkProofNonce = generatePrivacyNonce(userWallet);

      // SECURITY: Log deposit transaction
      if (dbService.isAvailable()) {
        await dbService.logTransaction({
          user_wallet: userWallet,
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
      console.error('[ZKDepositService] processDeposit error:', error);
      console.error('[ZKDepositService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
    // Ensure amount is a number
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    if (isNaN(numAmount)) {
      throw new Error(`Invalid amount: ${amount} (type: ${typeof amount})`);
    }
    
    // DEBUG: Log conversion
    console.log(`[convertToLamports] Converting ${numAmount} ${token} to lamports (input type: ${typeof amount})`);
    
    if (token === 'SOL') {
      const lamports = BigInt(Math.floor(numAmount * 1e9)); // SOL has 9 decimals
      const solEquivalent = Number(lamports) / 1e9;
      console.log(`[convertToLamports] ${numAmount} SOL = ${lamports.toString()} lamports (${solEquivalent} SOL)`);
      return lamports;
    } else {
      const lamports = BigInt(Math.floor(numAmount * 1e6)); // USDC/USDT have 6 decimals
      console.log(`[convertToLamports] ${numAmount} ${token} = ${lamports.toString()} lamports`);
      return lamports;
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
