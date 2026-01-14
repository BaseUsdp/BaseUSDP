/**
 * x402 Payment Service
 * Handles x402 payment processing with privacy
 */

import { fheService } from "./fheService.js";
import { encryptedTransactionService } from "./encryptedTransactionService.js";

export interface X402PaymentRequest {
  amount: number;
  recipient: string;
  serviceId: string;
  metadata?: Record<string, any>;
}

export interface X402PaymentResponse {
  paymentId: string;
  paymentHash: string;
  encryptedAmount: {
    data: string;
    securityZone: number;
  };
  status: "pending" | "settled" | "failed";
}

export class X402Service {
  private paymentRequests: Map<string, X402PaymentResponse> = new Map();

  /**
   * Create x402 payment request with privacy
   * @param request Payment request
   * @returns Payment response
   */
  async createPaymentRequest(
    request: X402PaymentRequest
  ): Promise<X402PaymentResponse> {
    // Create encrypted payment payload
    const paymentPayload = await fheService.createEncryptedPaymentPayload(
      request.amount,
      request.recipient
    );

    // Generate payment ID
    const paymentId = this.generatePaymentId(request.serviceId);

    const paymentResponse: X402PaymentResponse = {
      paymentId,
      paymentHash: paymentPayload.paymentHash,
      encryptedAmount: paymentPayload.encryptedAmount,
      status: "pending",
    };

    // Store payment request
    this.paymentRequests.set(paymentId, paymentResponse);

    return paymentResponse;
  }

  /**
   * Verify x402 payment
   * @param paymentId Payment identifier
   * @param encryptedAmount Encrypted amount from client
   * @returns Whether payment is valid
   */
  async verifyPayment(
    paymentId: string,
    encryptedAmount: string | { data: string; securityZone: number }
  ): Promise<boolean> {
    const payment = this.paymentRequests.get(paymentId);
    if (!payment) {
      return false;
    }

    // Verify encrypted amount matches
    return fheService.verifyEncryptedPayment(
      encryptedAmount,
      payment.paymentHash,
      payment.encryptedAmount.data // Use data string for hash comparison
    );
  }

  /**
   * Settle x402 payment on-chain
   * @param paymentId Payment identifier
   * @param payerAddress Payer wallet address
   * @param signer Wallet signer
   * @returns Transaction result
   */
  async settlePayment(
    paymentId: string,
    payerAddress: string,
    signer: any // ethers.Signer
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const payment = this.paymentRequests.get(paymentId);
    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (payment.status !== "pending") {
      return { success: false, error: "Payment already processed" };
    }

    try {
      // Execute encrypted transfer via facilitator
      // This would call the Void402Facilitator contract
      // Placeholder implementation

      payment.status = "settled";
      return { success: true };
    } catch (error) {
      payment.status = "failed";
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get payment status
   * @param paymentId Payment identifier
   * @returns Payment response or null
   */
  getPaymentStatus(paymentId: string): X402PaymentResponse | null {
    return this.paymentRequests.get(paymentId) || null;
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(serviceId: string): string {
    const crypto = require("crypto");
    return crypto
      .createHash("sha256")
      .update(serviceId + Date.now().toString())
      .digest("hex")
      .substring(0, 32);
  }
}

export const x402Service = new X402Service();

