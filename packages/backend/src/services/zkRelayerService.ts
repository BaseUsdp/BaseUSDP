/**
 * ZK Relayer Service
 * Submits transactions on behalf of users to hide sender identity
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection, deriveProofPDA, deriveUserBalancePDA, derivePoolPDA, NOLVI_PAY_PROGRAM_ID } from '../lib/nolvi-solana.js';
import { calculateRelayerDelay } from '../lib/zk-privacy-protection.js';
import bs58 from 'bs58';

// Instruction discriminator for external_transfer: [11, 179, 85, 190, 61, 53, 105, 169]
const EXTERNAL_TRANSFER_DISCRIMINATOR = Buffer.from([11, 179, 85, 190, 61, 53, 105, 169]);

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface RelayerSubmitRequest {
  nonce: number;
  recipient: string;
  senderWallet: string;
  relayerFee?: number;
}

export interface RelayerSubmitResult {
  success: boolean;
  signature?: string;
  transferAmount?: number;
  error?: string;
}

export interface ProofData {
  sender: PublicKey;
  amount: number;
  tokenMint: string;
  used: boolean;
}

export class ZKRelayerService {
  private connection: Connection;
  private relayerKeypair: Keypair | null = null;

  constructor() {
    this.connection = getSolanaConnection();
    this.initializeRelayerWallet();
  }

  /**
   * Initialize relayer wallet from environment
   */
  private initializeRelayerWallet(): void {
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.warn('⚠️ RELAYER_PRIVATE_KEY not set - relayer service will not work');
      return;
    }

    try {
      const keyArray = JSON.parse(relayerPrivateKey);
      if (Array.isArray(keyArray)) {
        this.relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } else {
        this.relayerKeypair = Keypair.fromSecretKey(bs58.decode(relayerPrivateKey));
      }
    } catch {
      this.relayerKeypair = Keypair.fromSecretKey(bs58.decode(relayerPrivateKey));
    }
  }

  /**
   * Build external transfer instruction
   */
  private buildExternalTransferInstruction({
    sender,
    proof,
    senderBalance,
    pool,
    tokenMint,
    poolTokenAccount,
    recipientTokenAccount,
    relayerFee,
  }: {
    sender: PublicKey;
    proof: PublicKey;
    senderBalance: PublicKey;
    pool: PublicKey;
    tokenMint: PublicKey;
    poolTokenAccount: PublicKey;
    recipientTokenAccount: PublicKey;
    relayerFee: number;
  }): TransactionInstruction {
    // Encode relayer_fee (u64, 8 bytes)
    const feeBuffer = Buffer.allocUnsafe(8);
    const feeBigInt = BigInt(relayerFee);
    for (let i = 0; i < 8; i++) {
      feeBuffer[i] = Number((feeBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }

    // Combine discriminator + relayer_fee
    const instructionData = Buffer.concat([
      EXTERNAL_TRANSFER_DISCRIMINATOR,
      feeBuffer,
    ]);

    return new TransactionInstruction({
      programId: NOLVI_PAY_PROGRAM_ID,
      keys: [
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: proof, isSigner: false, isWritable: true },
        { pubkey: senderBalance, isSigner: false, isWritable: true },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
  }

  /**
   * Read proof data from on-chain
   */
  async readProof(nonce: number): Promise<ProofData | null> {
    try {
      const proofPDA = await deriveProofPDA(nonce);
      const accountInfo = await this.connection.getAccountInfo(proofPDA);

      if (!accountInfo || accountInfo.data.length < 89) {
        return null;
      }

      // Proof account structure:
      // discriminator: bytes 0-8 (8 bytes)
      // sender: bytes 8-40 (32 bytes)
      // nonce: bytes 40-48 (8 bytes)
      // amount: bytes 48-56 (8 bytes)
      // token_mint: bytes 56-88 (32 bytes)
      // used: byte 88 (1 byte)

      const senderBytes = accountInfo.data.slice(8, 40);
      const sender = new PublicKey(senderBytes);

      const amountBuffer = accountInfo.data.slice(48, 56);
      const amount = Number(amountBuffer.readBigUInt64LE(0));

      const tokenMintBytes = accountInfo.data.slice(56, 88);
      const tokenMint = new PublicKey(tokenMintBytes).toBase58();

      const usedByte = accountInfo.data[88];
      const used = usedByte !== 0;

      return {
        sender,
        amount,
        tokenMint,
        used,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check relayer balance
   */
  async checkRelayerBalance(): Promise<{ sufficient: boolean; balance: number; error?: string }> {
    if (!this.relayerKeypair) {
      return {
        sufficient: false,
        balance: 0,
        error: 'Relayer wallet not configured',
      };
    }

    const balance = await this.connection.getBalance(this.relayerKeypair.publicKey);
    const MIN_BALANCE = 200_000; // 0.0002 SOL minimum

    return {
      sufficient: balance >= MIN_BALANCE,
      balance: balance / 1e9,
    };
  }

  /**
   * Submit payment via relayer
   */
  async submitPayment(request: RelayerSubmitRequest): Promise<RelayerSubmitResult> {
    try {
      if (!this.relayerKeypair) {
        return {
          success: false,
          error: 'Relayer wallet not configured',
        };
      }

      const relayerPubkey = this.relayerKeypair.publicKey;

      // Check relayer balance
      const balanceCheck = await this.checkRelayerBalance();
      if (!balanceCheck.sufficient) {
        return {
          success: false,
          error: `Relayer balance too low: ${balanceCheck.balance} SOL. Minimum: 0.0002 SOL`,
        };
      }

      // Read proof from on-chain
      const proofData = await this.readProof(request.nonce);
      if (!proofData) {
        return {
          success: false,
          error: 'Proof not found on-chain',
        };
      }

      // Check if proof is already used
      if (proofData.used) {
        return {
          success: false,
          error: 'Proof already used. Each proof can only be used once.',
        };
      }

      // SECURITY: Verify sender wallet owns the intermediate wallet (proof sender)
      const proofSender = proofData.sender.toString();
      
      // Determine token from proof data
      const proofToken = proofData.tokenMint === WSOL_MINT.toBase58() ? 'SOL' : 
                       proofData.tokenMint === USDC_MINT.toBase58() ? 'USDC' : 'USDT';
      
      // Verify ownership via database
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      if (dbService.isAvailable()) {
        const ownsWallet = await dbService.verifyUserOwnsIntermediateWallet(
          request.senderWallet,
          proofSender,
          proofToken
        );
        
        if (!ownsWallet) {
          return {
            success: false,
            error: 'Unauthorized: User does not own the intermediate wallet used in proof.',
          };
        }
      }

      // Calculate fees
      const poolMaintenanceFee = Math.max(Math.floor(proofData.amount / 200), 500);
      const maxAllowedRelayerFee = proofData.amount - poolMaintenanceFee;
      const relayerFee = request.relayerFee && request.relayerFee <= maxAllowedRelayerFee
        ? request.relayerFee
        : Math.max(Math.floor(proofData.amount * 0.01), 1000); // 1% default, min 1000

      if (relayerFee > maxAllowedRelayerFee) {
        return {
          success: false,
          error: `Relayer fee too high. Maximum: ${maxAllowedRelayerFee} lamports`,
        };
      }

      const totalFees = relayerFee + poolMaintenanceFee;
      const transferAmount = proofData.amount - totalFees;

      if (transferAmount <= 0) {
        return {
          success: false,
          error: 'Transfer amount too small after fees',
        };
      }

      // Derive PDAs
      const tokenMint = new PublicKey(proofData.tokenMint);
      const recipientWallet = new PublicKey(request.recipient);
      const senderBalancePDA = await deriveUserBalancePDA(proofSender, proofData.tokenMint);
      const poolPDA = await derivePoolPDA(proofData.tokenMint);
      const proofPDA = await deriveProofPDA(request.nonce);

      // Get token accounts
      const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);
      const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, recipientWallet);

      // Check if recipient token account exists
      let needsCreateATA = false;
      try {
        await getAccount(this.connection, recipientTokenAccount);
      } catch {
        needsCreateATA = true;
      }

      // Check sender balance
      const senderBalanceInfo = await this.connection.getAccountInfo(senderBalancePDA);
      if (!senderBalanceInfo || senderBalanceInfo.data.length < 80) {
        return {
          success: false,
          error: 'Sender balance account not found. Deposit may not have been processed yet.',
        };
      }

      const availableBuffer = senderBalanceInfo.data.slice(72, 80);
      const senderBalanceAvailable = Number(availableBuffer.readBigUInt64LE(0));

      if (senderBalanceAvailable < proofData.amount) {
        return {
          success: false,
          error: `Insufficient balance. Available: ${senderBalanceAvailable / (tokenMint.equals(WSOL_MINT) ? 1e9 : 1e6)} tokens, Required: ${proofData.amount / (tokenMint.equals(WSOL_MINT) ? 1e9 : 1e6)} tokens`,
        };
      }

      // Add privacy delay
      const delayMs = calculateRelayerDelay();
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Build transaction
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      const transaction = new Transaction();
      transaction.feePayer = relayerPubkey;
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Create recipient ATA if needed
      if (needsCreateATA) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            relayerPubkey,
            recipientTokenAccount,
            recipientWallet,
            tokenMint
          )
        );
      }

      // Add external transfer instruction
      const transferIx = this.buildExternalTransferInstruction({
        sender: relayerPubkey,
        proof: proofPDA,
        senderBalance: senderBalancePDA,
        pool: poolPDA,
        tokenMint,
        poolTokenAccount,
        recipientTokenAccount,
        relayerFee,
      });

      transaction.add(transferIx);
      transaction.sign(this.relayerKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      // SECURITY: Mark proof as used in database (prevent replay attacks)
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      if (dbService.isAvailable()) {
        await dbService.markProofUsed(
          request.nonce,
          request.senderWallet,
          proofSender,
          proofPDA.toString(),
          signature
        );
        await dbService.logTransaction({
          user_wallet: request.senderWallet,
          intermediate_wallet: proofSender,
          type: 'transfer',
          amount: transferAmount / (tokenMint.equals(WSOL_MINT) ? 1e9 : 1e6),
          token: proofData.tokenMint === WSOL_MINT.toBase58() ? 'SOL' : 
                proofData.tokenMint === USDC_MINT.toBase58() ? 'USDC' : 'USDT',
          recipient: request.recipient,
          transaction_signature: signature,
          nonce: request.nonce,
        });
      }

      return {
        success: true,
        signature,
        transferAmount: transferAmount / (tokenMint.equals(WSOL_MINT) ? 1e9 : 1e6),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
let zkRelayerServiceInstance: ZKRelayerService | null = null;

export function getZKRelayerService(): ZKRelayerService {
  if (!zkRelayerServiceInstance) {
    zkRelayerServiceInstance = new ZKRelayerService();
  }
  return zkRelayerServiceInstance;
}
