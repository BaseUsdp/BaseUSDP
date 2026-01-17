/**
 * ZK Proof Service
 * Handles uploading zero-knowledge proofs to on-chain
 */

import { Connection, PublicKey, Keypair, VersionedTransaction, TransactionMessage, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { getSolanaConnection, deriveProofPDA, deriveUserBalancePDA, NOLVI_PAY_PROGRAM_ID } from '../lib/nolvi-solana.js';
import { getIntermediateWalletPool } from '../lib/intermediate-wallet-pool.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

// Instruction discriminator for upload_proof: [57, 235, 171, 213, 237, 91, 79, 2]
const UPLOAD_PROOF_DISCRIMINATOR = Buffer.from([57, 235, 171, 213, 237, 91, 79, 2]);

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface UploadProofRequest {
  senderWallet: string;
  token: 'SOL' | 'USDC' | 'USDT';
  amount: number;
  nonce: number;
  proofBytes: Buffer;
  commitmentBytes: Buffer;
  blindingFactorBytes: Buffer;
  serverSign?: boolean;
  walletSignature?: string;
  messageToSign?: string;
}

export interface UploadProofResult {
  success: boolean;
  signature?: string;
  unsignedTransaction?: string; // Base64 encoded
  proofPDA?: string;
  error?: string;
}

export class ZKProofService {
  private connection: Connection;
  private collectionKeypair: Keypair | null = null;

  constructor() {
    this.connection = getSolanaConnection();
    this.initializeCollectionWallet();
  }

  /**
   * Initialize collection wallet from environment
   */
  private initializeCollectionWallet(): void {
    const collectionPrivateKey = process.env.COLLECTION_WALLET_PRIVATE_KEY;
    if (collectionPrivateKey) {
      try {
        const keyArray = JSON.parse(collectionPrivateKey);
        if (Array.isArray(keyArray)) {
          this.collectionKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        } else {
          this.collectionKeypair = Keypair.fromSecretKey(bs58.decode(collectionPrivateKey));
        }
      } catch {
        this.collectionKeypair = Keypair.fromSecretKey(bs58.decode(collectionPrivateKey));
      }
    }
  }

  /**
   * Build upload proof instruction
   */
  private buildUploadProofInstruction({
    sender,
    proof,
    tokenMint,
    nonce,
    amount,
    proofBytes,
    commitmentBytes,
    blindingFactorBytes,
  }: {
    sender: PublicKey;
    proof: PublicKey;
    tokenMint: PublicKey;
    nonce: number;
    amount: number;
    proofBytes: Buffer;
    commitmentBytes: Buffer;
    blindingFactorBytes: Buffer;
  }): TransactionInstruction {
    // Encode nonce (u64, 8 bytes)
    const nonceBuffer = Buffer.allocUnsafe(8);
    const nonceBigInt = BigInt(nonce);
    for (let i = 0; i < 8; i++) {
      nonceBuffer[i] = Number((nonceBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }

    // Encode amount (u64, 8 bytes)
    const amountBuffer = Buffer.allocUnsafe(8);
    const amountBigInt = BigInt(amount);
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }

    // Encode Vec<u8> fields (4 bytes length + data)
    const proofLengthBuffer = Buffer.allocUnsafe(4);
    proofLengthBuffer.writeUInt32LE(proofBytes.length, 0);

    const commitmentLengthBuffer = Buffer.allocUnsafe(4);
    commitmentLengthBuffer.writeUInt32LE(commitmentBytes.length, 0);

    const blindingLengthBuffer = Buffer.allocUnsafe(4);
    blindingLengthBuffer.writeUInt32LE(blindingFactorBytes.length, 0);

    // Combine all data
    const instructionData = Buffer.concat([
      UPLOAD_PROOF_DISCRIMINATOR,
      nonceBuffer,
      amountBuffer,
      proofLengthBuffer,
      proofBytes,
      commitmentLengthBuffer,
      commitmentBytes,
      blindingLengthBuffer,
      blindingFactorBytes,
    ]);

    return new TransactionInstruction({
      programId: NOLVI_PAY_PROGRAM_ID,
      keys: [
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: proof, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
  }

  /**
   * Verify wallet signature
   */
  private verifyWalletSignature(
    message: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message);
      // Try base58 first (Solana standard), then base64
      let signatureBytes: Uint8Array;
      try {
        signatureBytes = bs58.decode(signature);
      } catch {
        // Fallback to base64
        signatureBytes = Buffer.from(signature, 'base64');
      }
      const publicKeyBytes = new PublicKey(publicKey).toBytes();

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch {
      return false;
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
   * Check user balance (security check)
   */
  async checkUserBalance(
    intermediateWallet: string,
    token: 'SOL' | 'USDC' | 'USDT',
    amount: number
  ): Promise<{ sufficient: boolean; available: number; error?: string }> {
    try {
      const tokenMint = this.getTokenMint(token);
      const userBalancePDA = await deriveUserBalancePDA(intermediateWallet, tokenMint.toBase58());

      const accountInfo = await this.connection.getAccountInfo(userBalancePDA);
      if (!accountInfo || accountInfo.data.length < 80) {
        return {
          sufficient: false,
          available: 0,
          error: 'Balance account not found. Please deposit first.',
        };
      }

      // Read available balance (bytes 72-80, after discriminator + wallet + token_mint)
      const amountBuffer = accountInfo.data.slice(72, 80);
      const available = Number(amountBuffer.readBigUInt64LE(0));

      const amountLamports = token === 'SOL' ? Math.floor(amount * 1e9) : Math.floor(amount * 1e6);

      return {
        sufficient: available >= amountLamports,
        available: token === 'SOL' ? available / 1e9 : available / 1e6,
      };
    } catch (error) {
      return {
        sufficient: false,
        available: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload proof (server-side signing)
   */
  async uploadProofServerSign(request: UploadProofRequest): Promise<UploadProofResult> {
    try {
      // Verify wallet signature
      if (!request.walletSignature || !request.messageToSign) {
        return {
          success: false,
          error: 'Wallet signature required for server-side signing',
        };
      }

      const isValid = this.verifyWalletSignature(
        request.messageToSign,
        request.walletSignature,
        request.senderWallet
      );

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid wallet signature',
        };
      }

      // Get intermediate wallet for user from database
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      let intermediateWallet;
      if (dbService.isAvailable()) {
        // Look up user's intermediate wallet from database (per token)
        const intermediateWalletPubkey = await dbService.getUserIntermediateWallet(request.senderWallet, request.token);
        if (intermediateWalletPubkey) {
          // Find wallet in pool
          const walletPool = getIntermediateWalletPool();
          await walletPool.initialize();
          intermediateWallet = walletPool.getWalletByPublicKey(intermediateWalletPubkey) || null;
        }
      }
      
      // Fallback to pool if database not available or wallet not found
      if (!intermediateWallet) {
        const walletPool = getIntermediateWalletPool();
        await walletPool.initialize();
        intermediateWallet = await walletPool.getAvailableWallet();
        
        // Save to database if available (per token)
        if (dbService.isAvailable() && intermediateWallet) {
          await dbService.setUserIntermediateWallet(request.senderWallet, intermediateWallet.publicKey, request.token);
        }
      }
      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = new PublicKey(intermediateWallet.publicKey);

      // Check balance
      const balanceCheck = await this.checkUserBalance(
        intermediateWallet.publicKey,
        request.token,
        request.amount
      );

      if (!balanceCheck.sufficient) {
        return {
          success: false,
          error: balanceCheck.error || `Insufficient balance. Available: ${balanceCheck.available} ${request.token}`,
        };
      }

      // SECURITY: Check if proof nonce is already used (prevent replay attacks)
      if (dbService.isAvailable()) {
        const isUsed = await dbService.isProofUsed(request.nonce);
        if (isUsed) {
          return {
            success: false,
            error: 'Proof nonce already used. Each proof can only be used once.',
          };
        }
      }

      // Derive proof PDA
      const proofPDA = await deriveProofPDA(request.nonce);
      const tokenMint = this.getTokenMint(request.token);

      // Build instruction
      const instruction = this.buildUploadProofInstruction({
        sender: intermediatePubkey,
        proof: proofPDA,
        tokenMint,
        nonce: request.nonce,
        amount: request.token === 'SOL' ? Math.floor(request.amount * 1e9) : Math.floor(request.amount * 1e6),
        proofBytes: request.proofBytes,
        commitmentBytes: request.commitmentBytes,
        blindingFactorBytes: request.blindingFactorBytes,
      });

      // Ensure intermediate wallet has SOL for fees
      const intermediateBalance = await this.connection.getBalance(intermediatePubkey);
      const PROOF_ACCOUNT_RENT = 9_396_000; // ~0.009396 SOL
      const TRANSACTION_FEE = 5_000;
      const MIN_REQUIRED_BALANCE = PROOF_ACCOUNT_RENT + TRANSACTION_FEE + 1_000_000;

      if (intermediateBalance < MIN_REQUIRED_BALANCE && this.collectionKeypair) {
        // Fund intermediate wallet
        const solToSend = MIN_REQUIRED_BALANCE - intermediateBalance;
        const { blockhash } = await this.connection.getLatestBlockhash();
        
        const fundingTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: this.collectionKeypair.publicKey,
            recentBlockhash: blockhash,
            instructions: [
              SystemProgram.transfer({
                fromPubkey: this.collectionKeypair.publicKey,
                toPubkey: intermediatePubkey,
                lamports: Number(solToSend),
              }),
            ],
          }).compileToLegacyMessage()
        );

        fundingTx.sign([this.collectionKeypair]);
        await this.connection.sendRawTransaction(fundingTx.serialize());
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Build and sign transaction
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      const txMessage = new TransactionMessage({
        payerKey: intermediatePubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToLegacyMessage();

      const transaction = new VersionedTransaction(txMessage);
      transaction.sign([intermediateKeypair]);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'processed');

      // SECURITY: Mark proof as used in database (prevent replay attacks)
      if (dbService.isAvailable()) {
        await dbService.markProofUsed(
          request.nonce,
          request.senderWallet,
          intermediateWallet.publicKey,
          proofPDA.toString(),
          signature
        );
        await dbService.logTransaction({
          user_wallet: request.senderWallet,
          intermediate_wallet: intermediateWallet.publicKey,
          type: 'transfer',
          amount: request.amount,
          token: request.token,
          transaction_signature: signature,
          nonce: request.nonce,
        });
      }

      return {
        success: true,
        signature,
        proofPDA: proofPDA.toString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload proof (client-side signing)
   */
  async uploadProofClientSign(request: UploadProofRequest): Promise<UploadProofResult> {
    try {
      const walletPubkey = new PublicKey(request.senderWallet);
      const proofPDA = await deriveProofPDA(request.nonce);
      const tokenMint = this.getTokenMint(request.token);

      // Build instruction
      const instruction = this.buildUploadProofInstruction({
        sender: walletPubkey,
        proof: proofPDA,
        tokenMint,
        nonce: request.nonce,
        amount: request.token === 'SOL' ? Math.floor(request.amount * 1e9) : Math.floor(request.amount * 1e6),
        proofBytes: request.proofBytes,
        commitmentBytes: request.commitmentBytes,
        blindingFactorBytes: request.blindingFactorBytes,
      });

      // Build unsigned transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      const txMessage = new TransactionMessage({
        payerKey: walletPubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToLegacyMessage();

      const transaction = new VersionedTransaction(txMessage);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

      return {
        success: true,
        unsignedTransaction: serializedTx,
        proofPDA: proofPDA.toString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload proof (main method)
   */
  async uploadProof(request: UploadProofRequest): Promise<UploadProofResult> {
    if (request.serverSign) {
      return this.uploadProofServerSign(request);
    } else {
      return this.uploadProofClientSign(request);
    }
  }
}

// Singleton instance
let zkProofServiceInstance: ZKProofService | null = null;

export function getZKProofService(): ZKProofService {
  if (!zkProofServiceInstance) {
    zkProofServiceInstance = new ZKProofService();
  }
  return zkProofServiceInstance;
}
