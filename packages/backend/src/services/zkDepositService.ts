/**
 * ZK Deposit Service
 * Handles user deposits through the privacy layers:
 * 1. User → Collection Wallet
 * 2. Smart Split (2 parts)
 * 3. Jupiter Swaps (privacy mixing)
 * 4. Intermediate Wallet Assignment
 * 5. ZK Proof Account Creation
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, TransactionMessage, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection, deriveUserBalancePDA, derivePoolPDA, NOLVI_PAY_PROGRAM_ID } from '../lib/nolvi-solana.js';
import { getIntermediateWalletPool } from '../lib/intermediate-wallet-pool.js';
import { smartSplit, generatePrivacyNonce } from '../lib/zk-privacy-protection.js';
import { getChangeNowService } from './changenowService.js';
import bs58 from 'bs58';

// Instruction discriminator for deposit: [242, 35, 198, 137, 82, 225, 242, 182]
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

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
  userBalancePDA?: string;
  poolPDA?: string;
  zkProofNonce?: number;
  zkProofPDA?: string;
  splitParts?: Array<{ amount: number; exchangeId?: string; exchangeSignature?: string }>;
  depositSignature?: string;
  pendingChangenow?: boolean; // True if ChangeNow deposits are still processing
  error?: string;
}

export class ZKDepositService {
  private connection: Connection;
  private changenowService = getChangeNowService();
  private collectionWallet: PublicKey | null = null;
  private collectionKeypair: Keypair | null = null;
  private mainWalletKeypair: Keypair | null = null;

  constructor() {
    this.connection = getSolanaConnection();
    this.initializeWallets();
  }

  /**
   * Helper to add delays between RPC calls to avoid rate limits
   * Respects Solana Public RPC limits:
   * - 100 requests per 10 seconds (10 RPS)
   * - 40 requests per 10 seconds per method (4 RPS per method)
   */
  private async rateLimitedRpcCall<T>(
    operation: () => Promise<T>,
    method?: string, // RPC method name for per-method rate limiting
    maxRetries: number = 5
  ): Promise<T> {
    // Import rate limiter
    const { getRPCRateLimiter, extractRPCMethod } = await import('../lib/rpcRateLimiter.js');
    const rateLimiter = getRPCRateLimiter();
    
    // Use provided method or try to extract it
    const rpcMethod = method || extractRPCMethod(operation);
    
    // Wait if needed to respect rate limits
    await rateLimiter.waitIfNeeded(rpcMethod);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') ||
                           error?.message?.includes('Too many requests') ||
                           error?.message?.includes('rate limits exceeded') ||
                           error?.message?.includes('Connection rate limits exceeded') ||
                           error?.code === 429;

        if (isRateLimit && attempt < maxRetries - 1) {
          // Exponential backoff: wait longer if we hit rate limit
          // Calculate delay based on 10-second window
          const retryDelay = Math.min(
            Math.pow(2, attempt) * 1000, // 1s, 2s, 4s, 8s, 16s
            10000 // Cap at 10 seconds (window size)
          );
          console.warn(`[ZKDepositService] Rate limited (429), retrying after ${retryDelay/1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Wait again through rate limiter before retry
          await rateLimiter.waitIfNeeded(rpcMethod);
          continue;
        }
        throw error;
      }
    }
    throw new Error('RPC call failed after multiple retries');
  }

  /**
   * Build deposit instruction to move funds from intermediate wallet to ZK pool
   * Exported for use in relayer service (x402 auto-deposit)
   */
  buildDepositInstruction({
    user,
    userBalance,
    pool,
    tokenMint,
    userTokenAccount,
    poolTokenAccount,
    amountLamports,
  }: {
    user: PublicKey;
    userBalance: PublicKey;
    pool: PublicKey;
    tokenMint: PublicKey;
    userTokenAccount: PublicKey;
    poolTokenAccount: PublicKey;
    amountLamports: bigint;
  }): TransactionInstruction {
    const args = Buffer.alloc(8);
    args.writeBigUInt64LE(amountLamports, 0);
    
    const instructionData = Buffer.concat([DEPOSIT_DISCRIMINATOR, args]);
    
    return new TransactionInstruction({
      programId: NOLVI_PAY_PROGRAM_ID,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: userBalance, isSigner: false, isWritable: true },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
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

      // Check if amount is too small to split (will be processed as single deposit)
      const changenowMinAmount = this.changenowService.getMinimumAmount(request.token);
      const minAmountDecimal = request.token === 'SOL' 
        ? Number(changenowMinAmount) / 1e9 
        : Number(changenowMinAmount) / 1e6;
      
      const splitThreshold = request.token === 'SOL' ? 6 : 5; // $5 for USDC/USDT, 6 SOL for SOL
      if (request.amount <= splitThreshold) {
        console.log(`[ZKDepositService] Amount ${request.amount} ${request.token} is at or below split threshold (${splitThreshold} ${request.token}), will process as single deposit`);
        // Note: This is fine - we'll process as single deposit, but ChangeNow exchange might be skipped if below minimum
        if (request.amount < minAmountDecimal) {
          console.warn(`[ZKDepositService] Amount ${request.amount} ${request.token} is below ChangeNow minimum (${minAmountDecimal} ${request.token}), ChangeNow exchange will be skipped`);
        }
      }

      const userPubkey = new PublicKey(request.userWallet);
      const amountLamports = this.convertToLamports(request.amount, request.token);
      
      // DEBUG: Log converted lamports
      console.log(`[ZKDepositService] Converted ${request.amount} ${request.token} to ${amountLamports.toString()} lamports`);

      // FIX: Check balance and account for transaction fees (with rate limiting)
      if (request.token === 'SOL') {
        // For SOL, check native balance and ensure enough for transfer + fees
        const balance = await this.rateLimitedRpcCall(
          () => this.connection.getBalance(userPubkey),
          'getBalance'
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
            'getAccount'
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
        'getLatestBlockhash'
      );

      // FIX 1: Handle SOL deposits as native SOL transfers (not WSOL)
      if (request.token === 'SOL') {
        // Re-check balance right before building transaction (in case it changed)
        const finalBalance = await this.rateLimitedRpcCall(
          () => this.connection.getBalance(userPubkey),
          'getBalance'
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
            'getAccount'
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
            'getAccount'
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
        'getSignatureStatus'
      );
      
      console.log('[ZKDepositService] Transaction status:', {
        hasValue: !!status.value,
        err: status.value?.err,
        confirmationStatus: status.value?.confirmationStatus,
      });
      
      if (!status.value || status.value.err) {
        throw new Error('Deposit transaction failed or not confirmed');
      }

      // Check if amount is too small to split (after split, parts would be below ChangeNow minimum)
      const changenowMinAmount = this.changenowService.getMinimumAmount(request.token);
      const minAmountDecimal = request.token === 'SOL' 
        ? Number(changenowMinAmount) / 1e9 
        : Number(changenowMinAmount) / 1e6;
      
      // If amount is <= $5 (USDC/USDT) or <= 6 SOL, don't split
      // After splitting, each part would be below ChangeNow's $3 (USDC/USDT) or 3 SOL minimum
      // User requested: if amount <= $5, don't split
      let shouldSplit = request.token === 'SOL' 
        ? request.amount > 6 // 6 SOL threshold (2 * 3 SOL minimum)
        : request.amount > 5; // $5 threshold for USDC/USDT
      
      let split: { part1: number; part2: number };
      if (shouldSplit) {
        // Smart split amount into 2 parts
        console.log('[ZKDepositService] Splitting amount:', request.amount, request.token);
        split = smartSplit(request.amount, request.token);
        console.log('[ZKDepositService] Split result:', split);
        
        // Verify split parts are above minimum
        if (split.part1 < minAmountDecimal || split.part2 < minAmountDecimal) {
          console.warn(`[ZKDepositService] Split parts would be below ChangeNow minimum (${minAmountDecimal} ${request.token}), processing as single deposit`);
          shouldSplit = false;
          split = { part1: request.amount, part2: 0 };
        }
      } else {
        console.log(`[ZKDepositService] Amount ${request.amount} ${request.token} is too small to split (minimum for split: ${request.token === 'SOL' ? 6 : 5} ${request.token}), processing as single deposit`);
        split = { part1: request.amount, part2: 0 };
      }
      
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

      // TRUE POOLING: Use shared pool (5-10 wallets), but REUSE same wallet for same user
      // This provides true privacy - multiple users share same intermediate wallets
      // But each user's deposits accumulate in the same User Balance PDA
      console.log('[ZKDepositService] Initializing wallet pool for true pooling...');
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      console.log('[ZKDepositService] Wallet pool initialized');
      
      // CRITICAL FIX: Check if user already has an intermediate wallet in database
      // If yes, reuse it so all deposits accumulate in the same User Balance PDA
      // If no, get a random one from the pool (true pooling - multiple users can share)
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      let intermediateWallet: { publicKey: string; privateKey: number[] };
      let isReusingWallet = false;
      
      if (dbService.isAvailable()) {
        // Check for existing intermediate wallet first (preferred for balance accumulation)
        const existingIntermediateWallet = await dbService.getUserIntermediateWallet(request.userWallet, request.token);
        
        if (existingIntermediateWallet) {
          // User already has an intermediate wallet - reuse it so deposits accumulate
          console.log('[ZKDepositService] Found existing intermediate wallet for user, reusing:', existingIntermediateWallet);
          const existingWalletData = walletPool.getWalletByPublicKey(existingIntermediateWallet);
          
          if (existingWalletData) {
            intermediateWallet = existingWalletData;
            isReusingWallet = true;
            console.log('[ZKDepositService] ✅ Reusing existing intermediate wallet - deposits will accumulate in same User Balance PDA');
          } else {
            // Wallet not in current pool (might be from old pool) - get new one
            console.log('[ZKDepositService] ⚠️ Existing intermediate wallet not in current pool, getting new one from pool...');
            console.log('[ZKDepositService] ⚠️ NOTE: Previous deposits may be in different User Balance PDA');
            intermediateWallet = await walletPool.getAvailableWallet();
            console.log('[ZKDepositService] Assigned new intermediate wallet (shared pool):', intermediateWallet.publicKey);
          }
        } else {
          // First deposit for this user - get random wallet from pool
          console.log('[ZKDepositService] First deposit for this user, getting random intermediate wallet from pool (true pooling)...');
          intermediateWallet = await walletPool.getAvailableWallet();
          console.log('[ZKDepositService] Assigned intermediate wallet (shared pool):', intermediateWallet.publicKey);
        }
      } else {
        // Database not available - just get random wallet
        console.log('[ZKDepositService] Database not available, getting random intermediate wallet from pool...');
        intermediateWallet = await walletPool.getAvailableWallet();
        console.log('[ZKDepositService] Assigned intermediate wallet (shared pool):', intermediateWallet.publicKey);
      }
      
      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = new PublicKey(intermediateWallet.publicKey);
      console.log('[ZKDepositService] Intermediate wallet keypair created:', intermediatePubkey.toString());

      // Process splits (or single deposit if amount too small)
      const numParts = shouldSplit ? 2 : 1;
      console.log(`[ZKDepositService] Starting split processing (${numParts} part${numParts > 1 ? 's' : ''})...`);
      const splitParts: Array<{ amount: number; exchangeId?: string; exchangeSignature?: string }> = [];
      
      for (let i = 0; i < numParts; i++) {
        const splitAmount = i === 0 ? split.part1 : split.part2;
        
        // Skip zero amounts (when not splitting)
        if (splitAmount <= 0) {
          continue;
        }
        
        console.log(`[ZKDepositService] Processing split part ${i + 1}/${numParts}...`);
        const splitAmountLamports = this.convertToLamports(splitAmount, request.token);
        console.log(`[ZKDepositService] Split part ${i + 1} amount: ${splitAmount} ${request.token} = ${splitAmountLamports.toString()} lamports`);

        // ChangeNow uses same token for privacy mixing (e.g., USDC → USDC)
        // This is off-chain and hidden, providing true privacy
        console.log(`[ZKDepositService] ChangeNow exchange path for part ${i + 1}: ${request.token} → ${request.token} (off-chain, hidden)`);

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
            'getBalance'
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
              'getAccount'
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
              'getAccount'
            );
            intermediateAccountExists = true;
          } catch {
            intermediateAccountExists = false;
          }
          
          // Create intermediate token account if needed (collection wallet pays)
          if (!intermediateAccountExists) {
            if (this.collectionKeypair) {
              console.log(`[ZKDepositService] Adding create intermediate token account instruction...`);
              allInstructions.push(
                createAssociatedTokenAccountInstruction(
                  this.collectionKeypair.publicKey, // Collection wallet pays for account creation
                  intermediateTokenAccount,
                  intermediatePubkey,
                  tokenMint
                )
              );
            } else {
              console.warn(`[ZKDepositService] WARNING: Intermediate token account doesn't exist and collectionKeypair is not available. Account creation instruction cannot be added.`);
            }
          } else {
            console.log(`[ZKDepositService] Intermediate token account already exists: ${intermediateTokenAccount.toString()}`);
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
          'getLatestBlockhash'
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
          'sendRawTransaction'
        );
        console.log(`[ZKDepositService] Atomic transaction sent, signature: ${atomicSignature}`);

        console.log(`[ZKDepositService] Confirming atomic transaction...`);
        
        // Try to confirm with timeout handling
        let confirmed = false;
        try {
          const confirmationResult = await this.rateLimitedRpcCall(
            () => this.connection.confirmTransaction(atomicSignature, 'confirmed'),
            'confirmTransaction'
          );
          
          // Verify transaction was successful
          if (confirmationResult.value?.err) {
            throw new Error(`Atomic transaction failed: ${JSON.stringify(confirmationResult.value.err)}`);
          }
          
          confirmed = true;
          console.log(`[ZKDepositService] Atomic transaction confirmed: Collection → Mixer → User (all in one transaction)`);
        } catch (error: any) {
          // If confirmation times out, check if transaction actually succeeded
          if (error.name === 'TransactionExpiredTimeoutError' || error.message?.includes('not confirmed in')) {
            console.warn(`[ZKDepositService] ⚠️ Transaction confirmation timed out, checking status...`);
            
            // Check transaction status directly
            const status = await this.rateLimitedRpcCall(
              () => this.connection.getSignatureStatus(atomicSignature),
              'getSignatureStatus'
            );
            
            if (status.value && !status.value.err && status.value.confirmationStatus) {
              console.log(`[ZKDepositService] ✅ Transaction actually succeeded! Status: ${status.value.confirmationStatus}`);
              confirmed = true;
            } else if (status.value?.err) {
              throw new Error(`Atomic transaction failed: ${JSON.stringify(status.value.err)}`);
            } else {
              // Transaction might still be processing or failed
              throw new Error(`Transaction status unknown. Check signature ${atomicSignature} on Solana Explorer.`);
            }
          } else {
            throw error;
          }
        }

        // Now execute ChangeNow privacy exchange (replaces Jupiter - off-chain, hidden)
        // Note: Funds are now in user's intermediate wallet after the atomic transfer
        console.log(`[ZKDepositService] Preparing ChangeNow privacy exchange for part ${i + 1}...`);
        
        // CRITICAL: Use the split amount, NOT the full wallet balance
        // The intermediate wallet may have leftover funds from previous deposits
        // We only want to send the specific split part amount to ChangeNow
        const exchangeAmount = splitAmountLamports;
        console.log(`[ZKDepositService] Using split amount for ChangeNow: ${exchangeAmount.toString()} lamports (${splitAmount} ${request.token})`);
        
        // Verify the intermediate wallet has at least this amount
        let actualBalance: bigint;
        if (request.token === 'SOL') {
          const solBalance = await this.rateLimitedRpcCall(
            () => this.connection.getBalance(intermediatePubkey),
            'getBalance'
          );
          actualBalance = BigInt(solBalance);
          console.log(`[ZKDepositService] Intermediate wallet SOL balance: ${solBalance} lamports (${solBalance / 1e9} SOL)`);
        } else {
          const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
          
          // Retry logic: account might not be immediately available after transaction confirmation
          let currentBalance;
          let retries = 3;
          let accountFound = false;
          
          while (retries > 0 && !accountFound) {
            try {
              currentBalance = await this.rateLimitedRpcCall(
                () => getAccount(this.connection, intermediateTokenAccount),
                'getAccount'
              );
              accountFound = true;
            } catch (error: any) {
              if (error.name === 'TokenAccountNotFoundError' && retries > 1) {
                console.log(`[ZKDepositService] Token account not found yet, retrying... (${retries - 1} retries left)`);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                console.error(`[ZKDepositService] Failed to get token account after retries:`, error);
                throw error;
              }
            }
          }
          
          if (!accountFound || !currentBalance) {
            throw new Error(`Token account not found for intermediate wallet ${intermediatePubkey.toString()} after transaction confirmation`);
          }
          
          actualBalance = currentBalance.amount;
          console.log(`[ZKDepositService] Intermediate wallet token account balance: ${currentBalance.amount.toString()} (${Number(currentBalance.amount) / (request.token === 'USDC' || request.token === 'USDT' ? 1e6 : 1e9)} ${request.token})`);
        }
        
        // Verify we have enough balance for this split part
        if (actualBalance < exchangeAmount) {
          throw new Error(`Insufficient balance in intermediate wallet. Required: ${exchangeAmount.toString()} lamports, Available: ${actualBalance.toString()} lamports`);
        }

        // Check minimum amount for ChangeNow
        const minAmount = this.changenowService.getMinimumAmount(request.token);
        if (exchangeAmount < minAmount) {
          console.warn(`[ZKDepositService] Amount ${exchangeAmount.toString()} is below ChangeNow minimum ${minAmount.toString()}, skipping exchange for part ${i + 1}`);
          splitParts.push({
            amount: splitAmount,
            exchangeId: undefined,
            exchangeSignature: undefined,
          });
          continue;
        }

        // Create ChangeNow exchange (same token for privacy - e.g., USDC → USDC)
        // This is off-chain and hidden, providing true privacy
        let exchangeResult: { success: boolean; exchangeId?: string; payinAddress?: string; signature?: string; error?: string } | null = null;
        
        try {
          console.log(`[ZKDepositService] Creating ChangeNow exchange for part ${i + 1} (${request.token} → ${request.token})...`);
          
          // Use same token for privacy mixing (like privacyusd)
          const exchangeId = `${request.depositId}_split_${i + 1}`;
          const changenowResult = await this.changenowService.createExchange(
            request.token,
            request.token, // Same token for privacy
            exchangeAmount,
            exchangeId
          );

          if (!changenowResult.success || !changenowResult.payinAddress) {
            throw new Error(changenowResult.error || 'Failed to create ChangeNow exchange');
          }

          console.log(`[ZKDepositService] ChangeNow exchange created: ${changenowResult.transactionId}`);
          console.log(`[ZKDepositService] Payin address: ${changenowResult.payinAddress}`);

          // Send funds from intermediate wallet to ChangeNow payinAddress (like privacyusd)
          const changenowPayinPubkey = new PublicKey(changenowResult.payinAddress);
          
          let sendSignature: string | undefined;
          if (request.token === 'SOL') {
            // Native SOL transfer
            const { blockhash: exchangeBlockhash } = await this.rateLimitedRpcCall(
              () => this.connection.getLatestBlockhash(),
              'getLatestBlockhash'
            );
            
            const exchangeTx = new VersionedTransaction(
              new TransactionMessage({
                payerKey: intermediatePubkey,
                recentBlockhash: exchangeBlockhash,
                instructions: [
                  SystemProgram.transfer({
                    fromPubkey: intermediatePubkey,
                    toPubkey: changenowPayinPubkey,
                    lamports: Number(exchangeAmount),
                  }),
                ],
              }).compileToLegacyMessage()
            );
            
            exchangeTx.sign([intermediateKeypair]);
            sendSignature = await this.rateLimitedRpcCall(
              () => this.connection.sendRawTransaction(exchangeTx.serialize(), {
                skipPreflight: false,
                maxRetries: 3,
              }),
              'sendRawTransaction'
            );
          } else {
            // Token transfer (USDC/USDT)
            const changenowTokenAccount = await getAssociatedTokenAddress(tokenMint, changenowPayinPubkey);
            const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
            
            // Check if ChangeNow token account exists
            let changenowAccountExists = false;
            try {
              await this.rateLimitedRpcCall(
                () => getAccount(this.connection, changenowTokenAccount),
                'getAccount'
              );
              changenowAccountExists = true;
            } catch {
              changenowAccountExists = false;
            }

            // CRITICAL: Fund intermediate wallet with SOL for rent and fees before ChangeNow transfer
            // Creating token accounts requires rent, and transfers need fees
            const intermediateSolBalance = await this.rateLimitedRpcCall(
              () => this.connection.getBalance(intermediatePubkey),
              'getBalance'
            );
            
            const MIN_SOL_FOR_CHANGENOW = 10_000_000; // 0.01 SOL (for rent + fees)
            
            const exchangeInstructions = [];
            
            // Fund intermediate wallet if needed (collection wallet pays)
            if (intermediateSolBalance < MIN_SOL_FOR_CHANGENOW && this.collectionKeypair) {
              console.log(`[ZKDepositService] ⚠️ Intermediate wallet has insufficient SOL (${intermediateSolBalance} lamports), funding with ${MIN_SOL_FOR_CHANGENOW} lamports for ChangeNow transfer...`);
              exchangeInstructions.push(
                SystemProgram.transfer({
                  fromPubkey: this.collectionKeypair.publicKey,
                  toPubkey: intermediatePubkey,
                  lamports: MIN_SOL_FOR_CHANGENOW,
                })
              );
            }
            
            const { blockhash: exchangeBlockhash } = await this.rateLimitedRpcCall(
              () => this.connection.getLatestBlockhash(),
              'getLatestBlockhash'
            );
            
            // Create token account if needed (intermediate wallet pays)
            if (!changenowAccountExists) {
              exchangeInstructions.push(
                createAssociatedTokenAccountInstruction(
                  intermediatePubkey,
                  changenowTokenAccount,
                  changenowPayinPubkey,
                  tokenMint
                )
              );
            }

            // Transfer token
            exchangeInstructions.push(
              createTransferInstruction(
                intermediateTokenAccount,
                changenowTokenAccount,
                intermediatePubkey,
                exchangeAmount
              )
            );

            const exchangeTx = new VersionedTransaction(
              new TransactionMessage({
                payerKey: intermediatePubkey,
                recentBlockhash: exchangeBlockhash,
                instructions: exchangeInstructions,
              }).compileToLegacyMessage()
            );
            
            // Sign with intermediate wallet (and collection wallet if it funded SOL)
            const exchangeSigners = [intermediateKeypair];
            if (intermediateSolBalance < MIN_SOL_FOR_CHANGENOW && this.collectionKeypair) {
              exchangeSigners.push(this.collectionKeypair);
            }
            exchangeTx.sign(exchangeSigners);
            
            // Retry logic for ChangeNow transfer (token account might not be ready immediately)
            let transferRetries = 3;
            let transferSuccess = false;
            
            while (transferRetries > 0 && !transferSuccess) {
              try {
                // Add a small delay before retrying (except first attempt)
                if (transferRetries < 3) {
                  const delay = (4 - transferRetries) * 1000; // 1s, 2s delays
                  console.log(`[ZKDepositService] Retrying ChangeNow transfer after ${delay}ms delay... (${transferRetries} retries left)`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                sendSignature = await this.rateLimitedRpcCall(
                  () => this.connection.sendRawTransaction(exchangeTx.serialize(), {
                    skipPreflight: false,
                    maxRetries: 3,
                  }),
                  'sendRawTransaction'
                );
                transferSuccess = true;
              } catch (error: any) {
                transferRetries--;
                if (transferRetries === 0) {
                  throw error;
                }
                // Check if it's a simulation error (account not ready)
                if (error.message?.includes('no record of a prior credit') || 
                    error.message?.includes('Simulation failed') ||
                    error.message?.includes('Attempt to debit')) {
                  console.warn(`[ZKDepositService] Token account not ready yet, will retry... (${transferRetries} retries left)`);
                  // Continue to retry
                } else {
                  throw error;
                }
              }
            }
          }

          // Wait for confirmation (with timeout handling)
          if (sendSignature) {
            try {
              await this.rateLimitedRpcCall(
                () => this.connection.confirmTransaction(sendSignature, 'confirmed'),
                'confirmTransaction'
              );
            } catch (error: any) {
              // If confirmation times out, check if transaction actually succeeded
              if (error.name === 'TransactionExpiredTimeoutError' || error.message?.includes('not confirmed in')) {
                console.warn(`[ZKDepositService] ⚠️ ChangeNow transfer confirmation timed out, checking status...`);
                
                const status = await this.rateLimitedRpcCall(
                  () => this.connection.getSignatureStatus(sendSignature),
                  'getSignatureStatus'
                );
                
                if (status.value && !status.value.err && status.value.confirmationStatus) {
                  console.log(`[ZKDepositService] ✅ ChangeNow transfer actually succeeded! Status: ${status.value.confirmationStatus}`);
                } else if (status.value?.err) {
                  throw new Error(`ChangeNow transfer failed: ${JSON.stringify(status.value.err)}`);
                } else {
                  // Transaction might still be processing
                  console.warn(`[ZKDepositService] ⚠️ ChangeNow transfer status unknown - may still be processing`);
                  // Continue anyway - ChangeNow will process it
                }
              } else {
                throw error;
              }
            }
          }

          console.log(`[ZKDepositService] ✅ ChangeNow exchange successful for part ${i + 1}`);
          console.log(`[ZKDepositService] Exchange ID: ${changenowResult.transactionId}`);
          console.log(`[ZKDepositService] Transaction signature: ${sendSignature}`);
          console.log(`[ZKDepositService] Funds sent to ChangeNow, will arrive at MIXER_WITHDRAWAL_WALLET (off-chain, hidden)`);

          exchangeResult = {
            success: true,
            exchangeId: changenowResult.transactionId,
            payinAddress: changenowResult.payinAddress,
            signature: sendSignature,
          };
        } catch (exchangeError: any) {
          // If ChangeNow fails, log warning but continue
          console.warn(`[ZKDepositService] ChangeNow exchange failed for part ${i + 1}:`, exchangeError?.message || exchangeError);
          console.warn(`[ZKDepositService] Funds remain in intermediate wallet (not exchanged)`);
          exchangeResult = { success: false, error: exchangeError?.message || 'Unknown error' };
        }

        splitParts.push({
          amount: splitAmount,
          exchangeId: exchangeResult?.exchangeId,
          exchangeSignature: exchangeResult?.signature,
        });

        // PRIVACY FIX: If this part did NOT go through ChangeNow, deposit it immediately
        // This prevents recombination - each part deposits separately
        if (!exchangeResult?.success || !exchangeResult?.exchangeId) {
          console.log(`[ZKDepositService] Part ${i + 1} did not go through ChangeNow - depositing immediately to prevent recombination...`);
          
          // Derive PDAs for this deposit
          const finalTokenMint = this.getTokenMint(request.token);
          const poolPDA = await derivePoolPDA(finalTokenMint.toBase58());
          const userBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), finalTokenMint.toBase58());
          const intermediateTokenAccount = await getAssociatedTokenAddress(finalTokenMint, intermediatePubkey);
          const poolTokenAccount = await getAssociatedTokenAddress(finalTokenMint, poolPDA, true);
          
          // Check intermediate wallet balance for this part
          let partBalance: bigint;
          if (request.token === 'SOL') {
            const solBalance = await this.rateLimitedRpcCall(
              () => this.connection.getBalance(intermediatePubkey),
              'getBalance'
            );
            partBalance = BigInt(solBalance);
          } else {
            const tokenBalance = await this.rateLimitedRpcCall(
              () => getAccount(this.connection, intermediateTokenAccount),
              'getAccount'
            );
            partBalance = tokenBalance.amount;
          }
          
          if (partBalance > BigInt(0)) {
            console.log(`[ZKDepositService] Depositing part ${i + 1} (${partBalance.toString()} lamports) immediately...`);
            
            // Deposit this part (reuse deposit logic from below)
            // We'll create a helper function or inline it here
            // For now, we'll mark it to be deposited and do it after the loop
            // Actually, let's do it inline to avoid code duplication
            await this.depositPartToPool({
              intermediatePubkey,
              intermediateKeypair,
              intermediateTokenAccount,
              partBalance,
              finalTokenMint,
              poolPDA,
              userBalancePDA,
              poolTokenAccount,
              partIndex: i + 1,
            });
            
            console.log(`[ZKDepositService] ✅ Part ${i + 1} deposited separately to pool`);
          }
        }

        // Add random delay between swaps (1-3 minutes for privacy) - only if splitting
        if (shouldSplit && i === 0) {
          const delay = Math.random() * 120000 + 60000; // 60-180 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // CRITICAL: Move funds to ZK pool via deposit instruction
      // PRIVACY FIX: Deposit each split part SEPARATELY to prevent recombination correlation
      // This ensures the pool receives separate deposits (e.g., 4.16 and 5.84) instead of one $10 deposit
      
      console.log('[ZKDepositService] Moving funds to ZK pool (depositing each part separately for privacy)...');
      
      // Determine final token after swaps (use original token if swap failed)
      const finalToken = request.token;
      const finalTokenMint = this.getTokenMint(finalToken);
      
      // Derive PDAs for ZK pool (same for all parts - they all go to same User Balance PDA)
      const poolPDA = await derivePoolPDA(finalTokenMint.toBase58());
      const userBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), finalTokenMint.toBase58());
      
      console.log('[ZKDepositService] Pool PDA:', poolPDA.toBase58());
      console.log('[ZKDepositService] User Balance PDA:', userBalancePDA.toBase58());
      
      // CRITICAL: Save database mappings EARLY (before processing parts)
      // This ensures balance updates even if the function times out during ChangeNow polling
      const zkProofNonce = generatePrivacyNonce(request.userWallet);
      // dbService already imported above
      if (dbService.isAvailable()) {
        console.log(`[ZKDepositService] Saving to database EARLY: user=${request.userWallet}, token=${request.token}, userBalancePDA=${userBalancePDA.toBase58()}, intermediateWallet=${intermediateWallet.publicKey}`);
        
        // Store intermediate wallet FIRST (needed for proof uploads)
        const savedWallet = await dbService.setUserIntermediateWallet(request.userWallet, intermediateWallet.publicKey, request.token);
        console.log(`[ZKDepositService] Intermediate wallet saved: ${savedWallet ? 'SUCCESS' : 'FAILED'}`);
        
        // Store User Balance PDA mapping LAST (user wallet → User Balance PDA)
        const savedPDA = await dbService.setUserBalancePDA(request.userWallet, userBalancePDA.toBase58(), request.token);
        console.log(`[ZKDepositService] User Balance PDA saved: ${savedPDA ? 'SUCCESS' : 'FAILED'}`);
        console.log(`[ZKDepositService] ✅ Database mappings saved early (before deposit processing)`);
      } else {
        console.warn(`[ZKDepositService] ⚠️ Database not available - User Balance PDA mapping NOT saved!`);
      }
      
      // Get token accounts
      const intermediateTokenAccount = await getAssociatedTokenAddress(finalTokenMint, intermediatePubkey);
      const poolTokenAccount = await getAssociatedTokenAddress(finalTokenMint, poolPDA, true);
      
      // Variable to store all deposit signatures
      const depositSignatures: string[] = [];
      
      // PRIVACY FIX: Process and deposit each split part separately
      // This prevents recombination - each part deposits individually with delays
      for (let partIndex = 0; partIndex < splitParts.length; partIndex++) {
        const part = splitParts[partIndex];
        const partAmount = partIndex === 0 ? split.part1 : split.part2;
        
        if (partAmount <= 0) continue; // Skip zero parts
        
        console.log(`[ZKDepositService] Processing deposit for part ${partIndex + 1}/${splitParts.length} (${partAmount} ${request.token})...`);
        
        let partDepositAmountLamports: bigint = BigInt(0);
        
        // Check if this part went through ChangeNow
        if (part.exchangeId && part.exchangeSignature) {
          // This part went through ChangeNow - DON'T wait for it to complete (Vercel timeout risk)
          // Instead, save the exchange ID to database and return immediately
          console.log(`[ZKDepositService] Part ${partIndex + 1} went through ChangeNow (ID: ${part.exchangeId}) - saving to database for later completion`);
          
          // Store pending ChangeNow exchange in database so it can be completed automatically
          if (dbService.isAvailable()) {
            try {
              // Store as a transaction with type 'deposit' and exchange ID in transaction_signature field
              // We'll use a special format: "PENDING_CHANGENOW:{exchangeId}"
              await dbService.logTransaction({
                user_wallet: request.userWallet,
                intermediate_wallet: intermediateWallet.publicKey,
                type: 'deposit',
                amount: partAmount,
                token: request.token,
                transaction_signature: `PENDING_CHANGENOW:${part.exchangeId}`,
                nonce: zkProofNonce,
              });
              console.log(`[ZKDepositService] ✅ Saved pending ChangeNow exchange ${part.exchangeId} to database`);
            } catch (error) {
              console.error(`[ZKDepositService] Failed to save pending exchange:`, error);
            }
          }
          
          console.log(`[ZKDepositService] ⚠️ Exchange ${part.exchangeId} will be processed automatically when balance is checked`);
          console.log(`[ZKDepositService] ⚠️ Funds will arrive at MIXER_WITHDRAWAL_WALLET when ChangeNow completes`);
          
          // Skip this part - it will be handled asynchronously
          partDepositAmountLamports = BigInt(0);
          continue; // Skip to next part
        } else {
          // This part did NOT go through ChangeNow - check intermediate wallet directly
          console.log(`[ZKDepositService] Part ${partIndex + 1} did not go through ChangeNow - checking intermediate wallet...`);
          
          try {
            const intermediateBalance = await this.rateLimitedRpcCall(
              () => getAccount(this.connection, intermediateTokenAccount),
              'getAccount'
            );
            partDepositAmountLamports = intermediateBalance.amount;
            console.log(`[ZKDepositService] Part ${partIndex + 1} balance in intermediate wallet:`, partDepositAmountLamports.toString(), 'lamports');
          } catch (error: any) {
            if (error.name === 'TokenAccountNotFoundError') {
              console.warn(`[ZKDepositService] ⚠️ No funds found for part ${partIndex + 1} in intermediate wallet`);
              partDepositAmountLamports = BigInt(0);
            } else {
              throw error;
            }
          }
        }
        
        // Deposit this part separately to the pool (PRIVACY: prevents recombination correlation)
        if (partDepositAmountLamports > BigInt(0)) {
          console.log(`[ZKDepositService] Depositing part ${partIndex + 1} (${partDepositAmountLamports.toString()} lamports) to ZK pool separately...`);
          
          const partDepositSig = await this.depositPartToPool({
            intermediatePubkey,
            intermediateKeypair,
            intermediateTokenAccount,
            partBalance: partDepositAmountLamports,
            finalTokenMint,
            poolPDA,
            userBalancePDA,
            poolTokenAccount,
            partIndex: partIndex + 1,
          });
          
          depositSignatures.push(partDepositSig);
          
          // Add delay between deposits for privacy (only if not last part)
          if (partIndex < splitParts.length - 1) {
            const delay = Math.random() * 60000 + 30000; // 30-90 seconds between deposits
            console.log(`[ZKDepositService] Waiting ${Math.round(delay / 1000)}s before next deposit for privacy...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          console.log(`[ZKDepositService] Part ${partIndex + 1} has no funds to deposit (went through ChangeNow or failed)`);
        }
      }
      
      // Variable to store deposit signature (for return value - use last one or undefined)
      const depositSignature = depositSignatures.length > 0 ? depositSignatures[depositSignatures.length - 1] : undefined;
      
      // CRITICAL: Save database mappings BEFORE any potential timeout
      // This ensures balance updates even if ChangeNow polling times out
      // Log deposit transaction (only count successfully deposited parts)
      if (dbService.isAvailable()) {
        const depositedAmount = depositSignatures.length > 0 ? request.amount : 0; // Will be updated when ChangeNow completes
        await dbService.logTransaction({
          user_wallet: request.userWallet,
          intermediate_wallet: intermediateWallet.publicKey,
          type: 'deposit',
          amount: depositedAmount,
          token: request.token,
          nonce: zkProofNonce,
        });
        console.log(`[ZKDepositService] ✅ Deposit transaction logged`);
      }
      
      // If no parts were deposited (all went through ChangeNow), log a warning
      if (depositSignatures.length === 0) {
        console.warn('[ZKDepositService] ⚠️ No parts were deposited directly - all went through ChangeNow');
        console.warn('[ZKDepositService] ⚠️ ChangeNow funds will arrive at MIXER_WITHDRAWAL_WALLET and need separate handling');
        console.warn('[ZKDepositService] ⚠️ User Balance PDA has been saved - balance will update when ChangeNow completes');
        console.warn('[ZKDepositService] ⚠️ Exchange IDs saved in splitParts - can be processed via webhook/background job');
        
        // Return success but note that deposits are pending
        return {
          success: true,
          depositId: request.depositId,
          intermediateWallet: intermediateWallet.publicKey,
          userBalancePDA: userBalancePDA.toBase58(),
          poolPDA: poolPDA.toBase58(),
          zkProofNonce,
          splitParts,
          depositSignature: undefined,
          // Add flag to indicate pending ChangeNow deposits
          pendingChangenow: true,
        };
      } else {
        console.log(`[ZKDepositService] ✅ Successfully deposited ${depositSignatures.length} part(s) separately to ZK pool`);
      }

      return {
        success: true,
        depositId: request.depositId,
        intermediateWallet: intermediateWallet.publicKey, // Temporary wallet (for this deposit only)
        userBalancePDA: userBalancePDA.toBase58(), // This is what tracks your balance
        poolPDA: poolPDA.toBase58(), // Shared pool
        zkProofNonce,
        splitParts,
        depositSignature,
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
   * Helper: Deposit a specific amount to the ZK pool
   * Used to deposit each split part separately for privacy
   */
  private async depositPartToPool(params: {
    intermediatePubkey: PublicKey;
    intermediateKeypair: Keypair;
    intermediateTokenAccount: PublicKey;
    partBalance: bigint;
    finalTokenMint: PublicKey;
    poolPDA: PublicKey;
    userBalancePDA: PublicKey;
    poolTokenAccount: PublicKey;
    partIndex: number;
  }): Promise<string> {
    const {
      intermediatePubkey,
      intermediateKeypair,
      intermediateTokenAccount,
      partBalance,
      finalTokenMint,
      poolPDA,
      userBalancePDA,
      poolTokenAccount,
      partIndex,
    } = params;
    
    // Check if pool token account exists
    let poolAccountExists = false;
    try {
      await this.rateLimitedRpcCall(
        () => getAccount(this.connection, poolTokenAccount),
        'getAccount'
      );
      poolAccountExists = true;
    } catch {
      poolAccountExists = false;
    }
    
    // Build deposit transaction
    const depositInstructions = [];
    
    // Fund intermediate wallet with SOL if needed
    const intermediateWalletBalance = await this.rateLimitedRpcCall(
      () => this.connection.getBalance(intermediatePubkey),
      'getBalance'
    );
    
    const MIN_SOL_FOR_DEPOSIT = 5_000_000; // 0.005 SOL
    
    if (intermediateWalletBalance < MIN_SOL_FOR_DEPOSIT && this.collectionKeypair) {
      depositInstructions.push(
        SystemProgram.transfer({
          fromPubkey: this.collectionKeypair.publicKey,
          toPubkey: intermediatePubkey,
          lamports: MIN_SOL_FOR_DEPOSIT,
        })
      );
    }
    
    // Create pool token account if needed
    if (!poolAccountExists && this.collectionKeypair) {
      depositInstructions.push(
        createAssociatedTokenAccountInstruction(
          this.collectionKeypair.publicKey,
          poolTokenAccount,
          poolPDA,
          finalTokenMint
        )
      );
    }
    
    // Build deposit instruction
    const depositIx = this.buildDepositInstruction({
      user: intermediatePubkey,
      userBalance: userBalancePDA,
      pool: poolPDA,
      tokenMint: finalTokenMint,
      userTokenAccount: intermediateTokenAccount,
      poolTokenAccount: poolTokenAccount,
      amountLamports: partBalance,
    });
    depositInstructions.push(depositIx);
    
    // Get blockhash and build transaction
    const { blockhash: depositBlockhash } = await this.rateLimitedRpcCall(
      () => this.connection.getLatestBlockhash(),
      'getLatestBlockhash'
    );
    
    const depositTx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: this.collectionKeypair?.publicKey || this.collectionWallet!,
        recentBlockhash: depositBlockhash,
        instructions: depositInstructions,
      }).compileToLegacyMessage()
    );
    
    // Sign with collection wallet (payer) and intermediate wallet (user for deposit)
    const depositSigners = [this.collectionKeypair!, intermediateKeypair];
    depositTx.sign(depositSigners);
    
    console.log(`[ZKDepositService] Sending deposit instruction for part ${partIndex} to ZK pool...`);
    const depositSignature = await this.rateLimitedRpcCall(
      () => this.connection.sendRawTransaction(depositTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      }),
      'sendRawTransaction'
    );
    console.log(`[ZKDepositService] Deposit instruction for part ${partIndex} sent, signature:`, depositSignature);
    
    // Wait for confirmation (with timeout handling)
    try {
      await this.rateLimitedRpcCall(
        () => this.connection.confirmTransaction(depositSignature, 'confirmed'),
        'confirmTransaction'
      );
      console.log(`[ZKDepositService] ✅ Part ${partIndex} successfully deposited to ZK pool!`);
    } catch (error: any) {
      if (error.name === 'TransactionExpiredTimeoutError' || error.message?.includes('not confirmed in')) {
        const status = await this.rateLimitedRpcCall(
          () => this.connection.getSignatureStatus(depositSignature),
          'getSignatureStatus'
        );
        
        if (status.value && !status.value.err && status.value.confirmationStatus) {
          console.log(`[ZKDepositService] ✅ Part ${partIndex} deposit actually succeeded!`);
        } else if (status.value?.err) {
          throw new Error(`Part ${partIndex} deposit failed: ${JSON.stringify(status.value.err)}`);
        } else {
          throw new Error(`Part ${partIndex} deposit status unknown. Check signature ${depositSignature}`);
        }
      } else {
        throw error;
      }
    }
    
    return depositSignature;
  }

  /**
   * Complete a pending ChangeNow deposit
   * Called when ChangeNow exchange finishes (via webhook or manual check)
   */
  async completeChangenowDeposit(params: {
    exchangeId: string;
    userWallet: string;
    token: 'SOL' | 'USDC' | 'USDT';
    partAmount: number;
  }): Promise<{ success: boolean; depositSignature?: string; error?: string }> {
    const { exchangeId, userWallet, token, partAmount } = params;
    
    try {
      console.log(`[ZKDepositService] Completing ChangeNow deposit for exchange ${exchangeId}...`);
      
      // Get user's intermediate wallet and User Balance PDA from database
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      if (!dbService.isAvailable()) {
        throw new Error('Database not available');
      }
      
      const intermediateWalletAddress = await dbService.getUserIntermediateWallet(userWallet, token);
      if (!intermediateWalletAddress) {
        throw new Error('Intermediate wallet not found for user');
      }
      
      // Get intermediate wallet from pool
      const walletPool = getIntermediateWalletPool();
      await walletPool.initialize();
      const intermediateWallet = walletPool.getWalletByPublicKey(intermediateWalletAddress);
      
      if (!intermediateWallet) {
        throw new Error(`Intermediate wallet ${intermediateWalletAddress} not found in pool`);
      }
      
      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = new PublicKey(intermediateWallet.publicKey);
      
      // Derive PDAs
      const finalTokenMint = this.getTokenMint(token);
      const poolPDA = await derivePoolPDA(finalTokenMint.toBase58());
      const userBalancePDA = await deriveUserBalancePDA(intermediatePubkey.toBase58(), finalTokenMint.toBase58());
      const intermediateTokenAccount = await getAssociatedTokenAddress(finalTokenMint, intermediatePubkey);
      const poolTokenAccount = await getAssociatedTokenAddress(finalTokenMint, poolPDA, true);
      
      // Check ChangeNow status
      const changenowStatus = await this.changenowService.getTransactionStatus(exchangeId);
      
      if (!changenowStatus || changenowStatus.status !== 'finished') {
        return {
          success: false,
          error: `ChangeNow exchange ${exchangeId} is not finished yet. Status: ${changenowStatus?.status || 'unknown'}`,
        };
      }
      
      // Get actual amount after fees
      let actualAmountAfterFees: bigint;
      if (changenowStatus.toAmount) {
        const toAmountDecimal = parseFloat(changenowStatus.toAmount);
        actualAmountAfterFees = this.convertToLamports(toAmountDecimal, token);
        console.log(`[ZKDepositService] ChangeNow actual amount after fees: ${toAmountDecimal} ${token} = ${actualAmountAfterFees.toString()} lamports`);
      } else {
        // Fallback to expected amount
        actualAmountAfterFees = this.convertToLamports(partAmount, token);
        console.log(`[ZKDepositService] ChangeNow toAmount not available, using expected: ${partAmount} ${token}`);
      }
      
      // Transfer from MIXER_WITHDRAWAL_WALLET to intermediate wallet
      const mixerWithdrawalWallet = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;
      const mixerWithdrawalPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY;
      
      if (!mixerWithdrawalWallet || !mixerWithdrawalPrivateKey) {
        throw new Error('MIXER_WITHDRAWAL_WALLET not configured');
      }
      
      const mixerWalletPubkey = new PublicKey(mixerWithdrawalWallet);
      const mixerTokenAccount = await getAssociatedTokenAddress(finalTokenMint, mixerWalletPubkey);
      
      // Check mixer balance
      const mixerBalance = await this.rateLimitedRpcCall(
        () => getAccount(this.connection, mixerTokenAccount),
        'getAccount'
      );
      
      if (mixerBalance.amount < actualAmountAfterFees) {
        return {
          success: false,
          error: `MIXER_WITHDRAWAL_WALLET has insufficient funds. Has: ${mixerBalance.amount.toString()}, Need: ${actualAmountAfterFees.toString()}`,
        };
      }
      
      // Load mixer keypair
      let mixerKeypair: Keypair;
      try {
        mixerKeypair = Keypair.fromSecretKey(bs58.decode(mixerWithdrawalPrivateKey));
      } catch {
        try {
          const keyArray = JSON.parse(mixerWithdrawalPrivateKey);
          mixerKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        } catch {
          throw new Error('Invalid MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY format');
        }
      }
      
      // Transfer from MIXER_WITHDRAWAL_WALLET to intermediate wallet
      const transferInstructions = [];
      
      // Check if intermediate token account exists
      let intermediateAccountExists = false;
      try {
        await this.rateLimitedRpcCall(
          () => getAccount(this.connection, intermediateTokenAccount),
          'getAccount'
        );
        intermediateAccountExists = true;
      } catch {
        intermediateAccountExists = false;
      }
      
      // Create intermediate token account if needed
      if (!intermediateAccountExists && this.collectionKeypair) {
        transferInstructions.push(
          createAssociatedTokenAccountInstruction(
            this.collectionKeypair.publicKey,
            intermediateTokenAccount,
            intermediatePubkey,
            finalTokenMint
          )
        );
      }
      
      // Transfer actual amount after fees
      transferInstructions.push(
        createTransferInstruction(
          mixerTokenAccount,
          intermediateTokenAccount,
          mixerKeypair.publicKey,
          actualAmountAfterFees
        )
      );
      
      // Build and send transfer transaction
      const { blockhash: transferBlockhash } = await this.rateLimitedRpcCall(
        () => this.connection.getLatestBlockhash(),
        'getLatestBlockhash'
      );
      
      const transferTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: mixerKeypair.publicKey,
          recentBlockhash: transferBlockhash,
          instructions: transferInstructions,
        }).compileToLegacyMessage()
      );
      
      const transferSigners = [mixerKeypair];
      if (this.collectionKeypair && !intermediateAccountExists) {
        transferSigners.push(this.collectionKeypair);
      }
      transferTx.sign(transferSigners);
      
      const transferSignature = await this.rateLimitedRpcCall(
        () => this.connection.sendRawTransaction(transferTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        }),
        'sendRawTransaction'
      );
      
      console.log(`[ZKDepositService] Transfer from MIXER_WITHDRAWAL_WALLET sent, signature:`, transferSignature);
      
      // Wait for confirmation
      try {
        await this.rateLimitedRpcCall(
          () => this.connection.confirmTransaction(transferSignature, 'confirmed'),
          'confirmTransaction'
        );
        console.log(`[ZKDepositService] ✅ Funds transferred from MIXER_WITHDRAWAL_WALLET`);
      } catch (error: any) {
        if (error.name === 'TransactionExpiredTimeoutError' || error.message?.includes('not confirmed in')) {
          const status = await this.rateLimitedRpcCall(
            () => this.connection.getSignatureStatus(transferSignature),
            'getSignatureStatus'
          );
          
          if (status.value && !status.value.err && status.value.confirmationStatus) {
            console.log(`[ZKDepositService] ✅ Transfer actually succeeded!`);
          } else if (status.value?.err) {
            throw new Error(`Transfer failed: ${JSON.stringify(status.value.err)}`);
          } else {
            throw new Error(`Transfer status unknown. Check signature ${transferSignature}`);
          }
        } else {
          throw error;
        }
      }
      
      // Now deposit to pool
      const depositSignature = await this.depositPartToPool({
        intermediatePubkey,
        intermediateKeypair,
        intermediateTokenAccount,
        partBalance: actualAmountAfterFees,
        finalTokenMint,
        poolPDA,
        userBalancePDA,
        poolTokenAccount,
        partIndex: 1, // Single part completion
      });
      
      console.log(`[ZKDepositService] ✅ ChangeNow deposit completed! Signature: ${depositSignature}`);
      
      return {
        success: true,
        depositSignature,
      };
    } catch (error) {
      console.error('[ZKDepositService] Error completing ChangeNow deposit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete all pending ChangeNow deposits for a user
   * Checks database for pending exchanges and completes them
   */
  async completePendingChangenowDeposits(params: {
    userWallet: string;
    token: 'SOL' | 'USDC' | 'USDT';
  }): Promise<{ completed: number; failed: number }> {
    const { userWallet, token } = params;
    let completed = 0;
    let failed = 0;
    
    try {
      console.log(`[ZKDepositService] Checking for pending ChangeNow deposits for ${userWallet} / ${token}...`);
      
      // Get user's intermediate wallet to find recent deposits
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      if (!dbService.isAvailable()) {
        console.warn('[ZKDepositService] Database not available, cannot check pending deposits');
        return { completed: 0, failed: 0 };
      }
      
      // Query database for pending ChangeNow transactions
      const pendingTransactions = await dbService.getPendingChangenowTransactions(userWallet, token);
      
      if (!pendingTransactions || pendingTransactions.length === 0) {
        console.log('[ZKDepositService] No pending ChangeNow deposits found');
        return { completed: 0, failed: 0 };
      }
      
      console.log(`[ZKDepositService] Found ${pendingTransactions.length} pending ChangeNow deposit(s)`);
      
      // Complete each pending deposit
      for (const tx of pendingTransactions) {
        try {
          // Extract exchange ID from transaction_signature
          // Format: "PENDING_CHANGENOW:{exchangeId}"
          const exchangeId = tx.transaction_signature?.replace('PENDING_CHANGENOW:', '');
          if (!exchangeId) {
            console.warn('[ZKDepositService] Invalid pending transaction format:', tx.transaction_signature);
            continue;
          }
          
          console.log(`[ZKDepositService] Completing pending ChangeNow deposit: ${exchangeId} (${tx.amount} ${tx.token})`);
          
          // Complete this ChangeNow deposit
          const result = await this.completeChangenowDeposit({
            exchangeId,
            userWallet,
            token: tx.token as 'SOL' | 'USDC' | 'USDT',
            partAmount: tx.amount,
          });
          
          if (result.success) {
            completed++;
            console.log(`[ZKDepositService] ✅ Completed ChangeNow deposit ${exchangeId}`);
            
            // Update transaction signature to mark as completed (remove from pending list)
            // We'll update it to the actual deposit signature
            if (dbService.isAvailable()) {
              const { supabase } = dbService as any;
              if (supabase) {
                await supabase
                  .from('transactions')
                  .update({ transaction_signature: result.depositSignature || `COMPLETED:${exchangeId}` })
                  .eq('user_wallet', userWallet)
                  .eq('token', token)
                  .eq('transaction_signature', tx.transaction_signature);
              }
            }
          } else {
            failed++;
            console.warn(`[ZKDepositService] ⚠️ Failed to complete ChangeNow deposit ${exchangeId}:`, result.error);
          }
        } catch (error) {
          failed++;
          console.error(`[ZKDepositService] Error completing pending deposit:`, error);
        }
      }
      
      console.log(`[ZKDepositService] ✅ Completed ${completed} pending deposit(s), ${failed} failed`);
      return { completed, failed };
    } catch (error) {
      console.error('[ZKDepositService] Error completing pending deposits:', error);
      return { completed, failed };
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
