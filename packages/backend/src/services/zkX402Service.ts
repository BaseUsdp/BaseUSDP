/**
 * ZK x402 Service
 * Integrates x402 payments with ZK proof system
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import { getSolanaConnection, deriveProofPDA } from '../lib/nolvi-solana.js';
import { getZKRelayerService } from './zkRelayerService.js';
import { getZKProofService } from './zkProofService.js';
import { generatePrivacyNonce } from '../lib/zk-privacy-protection.js';

export interface ZKX402PaymentRequest {
  amount: number;
  recipient: string;
  serviceId: string;
  token: 'SOL' | 'USDC' | 'USDT';
  metadata?: Record<string, any>;
}

export interface ZKX402PaymentResponse {
  paymentId: string;
  paymentHash: string;
  nonce: number;
  proofPDA?: string;
  status: 'pending' | 'settled' | 'failed';
}

export interface ZKX402PaymentVerification {
  paymentId: string;
  proofNonce: number;
  verified: boolean;
  transactionSignature?: string;
}

export class ZKX402Service {
  private connection: Connection;
  private paymentRequests: Map<string, ZKX402PaymentResponse> = new Map();
  private relayerService = getZKRelayerService();
  private proofService = getZKProofService();

  constructor() {
    this.connection = getSolanaConnection();
  }

  /**
   * Create x402 payment request with ZK proof
   */
  async createPaymentRequest(
    request: ZKX402PaymentRequest,
    userWallet: string
  ): Promise<ZKX402PaymentResponse> {
    // Generate payment ID
    const paymentId = this.generatePaymentId(request.serviceId);

    // Generate privacy nonce for ZK proof
    const nonce = generatePrivacyNonce(userWallet);

    // Create payment hash (includes amount, recipient, and nonce for verification)
    const paymentHash = createHash('sha256')
      .update(paymentId + request.amount.toString() + request.recipient + nonce.toString())
      .digest('hex');

    const paymentResponse: ZKX402PaymentResponse = {
      paymentId,
      paymentHash,
      nonce,
      recipient: request.recipient,
      amount: request.amount,
      token: request.token,
      status: 'pending',
    };

    // Store payment request in database (if available)
    const { getDatabaseService } = await import('./databaseService.js');
    const dbService = getDatabaseService();
    
    if (dbService.isAvailable()) {
      await dbService.createPaymentRequest({
        payment_id: paymentId,
        user_wallet: userWallet,
        recipient: request.recipient,
        amount: request.amount,
        token: request.token,
        nonce,
        payment_hash: paymentHash,
        status: 'pending',
      });
    }
    
    // Also store in memory as fallback
    this.paymentRequests.set(paymentId, paymentResponse);

    return paymentResponse;
  }

  /**
   * Verify payment by checking if proof was used
   * This is called after the relayer submits the payment
   */
  async verifyPayment(paymentId: string): Promise<ZKX402PaymentVerification> {
    // Try database first, then memory
    const { getDatabaseService } = await import('./databaseService.js');
    const dbService = getDatabaseService();
    
    let payment: ZKX402PaymentResponse | null = null;
    
    if (dbService.isAvailable()) {
      const dbPayment = await dbService.getPaymentRequest(paymentId);
      if (dbPayment) {
        payment = {
          paymentId: dbPayment.payment_id,
          paymentHash: dbPayment.payment_hash,
          nonce: dbPayment.nonce,
          recipient: dbPayment.recipient,
          amount: dbPayment.amount,
          token: dbPayment.token,
          status: dbPayment.status,
          proofPDA: dbPayment.proof_pda,
        };
      }
    }
    
    // Fallback to memory
    if (!payment) {
      payment = this.paymentRequests.get(paymentId) || null;
    }
    
    if (!payment) {
      return {
        paymentId,
        proofNonce: 0,
        verified: false,
      };
    }

    try {
      // Read proof from on-chain to check if it was used
      const proofPDA = await deriveProofPDA(payment.nonce);
      const accountInfo = await this.connection.getAccountInfo(proofPDA);

      if (!accountInfo || accountInfo.data.length < 89) {
        return {
          paymentId,
          proofNonce: payment.nonce,
          verified: false,
        };
      }

      // Check if proof was used (byte 88)
      const usedByte = accountInfo.data[88];
      const isUsed = usedByte !== 0;

      if (!isUsed) {
        return {
          paymentId,
          proofNonce: payment.nonce,
          verified: false,
        };
      }

      // Payment is verified - proof was used
      payment.status = 'settled';

      return {
        paymentId,
        proofNonce: payment.nonce,
        verified: true,
        transactionSignature: undefined, // Could be stored separately
      };
    } catch (error) {
      return {
        paymentId,
        proofNonce: payment.nonce,
        verified: false,
      };
    }
  }

  /**
   * Settle x402 payment using ZK proof and relayer
   * This creates the proof, uploads it, and submits via relayer
   */
  async settlePayment(
    paymentId: string,
    userWallet: string,
    proofBytes: Buffer,
    commitmentBytes: Buffer,
    blindingFactorBytes: Buffer,
    walletSignature?: string,
    messageToSign?: string
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    const payment = this.paymentRequests.get(paymentId);
    if (!payment) {
      return {
        success: false,
        error: 'Payment request not found',
      };
    }

    if (payment.status !== 'pending') {
      return {
        success: false,
        error: `Payment is already ${payment.status}`,
      };
    }

    try {
      // Step 1: Upload ZK proof
      const uploadResult = await this.proofService.uploadProof({
        senderWallet: userWallet,
        token: payment.token || 'USDC', // Default to USDC if not specified
        amount: payment.amount || 0, // This should be set when creating payment
        nonce: payment.nonce,
        proofBytes,
        commitmentBytes,
        blindingFactorBytes,
        serverSign: !!walletSignature,
        walletSignature,
        messageToSign,
      });

      if (!uploadResult.success) {
        return {
          success: false,
          error: `Failed to upload proof: ${uploadResult.error}`,
        };
      }

      // Step 2: Submit payment via relayer
      const relayerResult = await this.relayerService.submitPayment({
        nonce: payment.nonce,
        recipient: payment.recipient,
        senderWallet: userWallet,
      });

      if (!relayerResult.success) {
        return {
          success: false,
          error: `Failed to submit payment: ${relayerResult.error}`,
        };
      }

      // Step 3: Update payment status in database
      const { getDatabaseService } = await import('./databaseService.js');
      const dbService = getDatabaseService();
      
      if (dbService.isAvailable()) {
        await dbService.updatePaymentStatus(paymentId, 'settled', uploadResult.proofPDA);
        await dbService.markProofUsed(
          payment.nonce,
          userWallet,
          payment.recipient, // Intermediate wallet would be looked up
          uploadResult.proofPDA || '',
          relayerResult.signature
        );
        await dbService.logTransaction({
          user_wallet: userWallet,
          type: 'payment',
          amount: payment.amount || 0,
          token: payment.token || 'USDC',
          recipient: payment.recipient,
          transaction_signature: relayerResult.signature,
          nonce: payment.nonce,
        });
      }
      
      // Also update in memory
      payment.status = 'settled';
      payment.proofPDA = uploadResult.proofPDA;

      return {
        success: true,
        signature: relayerResult.signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<ZKX402PaymentResponse | null> {
    // Try database first, then memory
    const { getDatabaseService } = await import('./databaseService.js');
    const dbService = getDatabaseService();
    
    if (dbService.isAvailable()) {
      const dbPayment = await dbService.getPaymentRequest(paymentId);
      if (dbPayment) {
        return {
          paymentId: dbPayment.payment_id,
          paymentHash: dbPayment.payment_hash,
          nonce: dbPayment.nonce,
          recipient: dbPayment.recipient,
          amount: dbPayment.amount,
          token: dbPayment.token,
          status: dbPayment.status,
          proofPDA: dbPayment.proof_pda,
        };
      }
    }
    
    // Fallback to memory
    return this.paymentRequests.get(paymentId) || null;
  }

  /**
   * Generate payment ID
   */
  private generatePaymentId(serviceId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `x402_${serviceId}_${timestamp}_${random}`;
  }
}

// Singleton instance
let zkX402ServiceInstance: ZKX402Service | null = null;

export function getZKX402Service(): ZKX402Service {
  if (!zkX402ServiceInstance) {
    zkX402ServiceInstance = new ZKX402Service();
  }
  return zkX402ServiceInstance;
}
