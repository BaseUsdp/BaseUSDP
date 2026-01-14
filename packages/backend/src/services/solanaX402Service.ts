/**
 * Solana x402 Payment Service
 * Handles x402 payment processing on Solana with Token-2022 confidential transfers
 */

import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { createHash } from "crypto";
import { Token2022Service } from "./token2022Service.js";
import { solanaTransactionService } from "./solanaTransactionService.js";

export interface X402PaymentRequest {
  amount: number;
  recipient: string;
  serviceId: string;
  metadata?: Record<string, any>;
}

export interface X402PaymentResponse {
  paymentId: string;
  paymentHash: string;
  encryptedAmount: Uint8Array;
  status: "pending" | "settled" | "failed";
}

export class SolanaX402Service {
  private paymentRequests: Map<string, X402PaymentResponse> = new Map();
  private facilitatorProgramId: PublicKey | null = null;
  private token2022Service: Token2022Service | null = null;

  /**
   * Initialize service with facilitator program ID and Token-2022 service
   */
  async initialize(
    facilitatorProgramId: string,
    connection: Connection
  ): Promise<void> {
    this.facilitatorProgramId = new PublicKey(facilitatorProgramId);
    this.token2022Service = new Token2022Service(connection);
    console.log("Solana x402 service initialized");
    console.log("Facilitator Program:", this.facilitatorProgramId.toBase58());
  }

  /**
   * Create x402 payment request with privacy using Token-2022
   * @param request Payment request
   * @returns Payment response
   */
  async createPaymentRequest(
    request: X402PaymentRequest
  ): Promise<X402PaymentResponse> {
    // Generate payment ID
    const paymentId = this.generatePaymentId(request.serviceId);

    // Create payment hash (amount is confidential in Token-2022)
    const paymentHash = createHash("sha256")
      .update(paymentId + request.amount.toString() + request.recipient)
      .digest();

    const paymentResponse: X402PaymentResponse = {
      paymentId,
      paymentHash: Buffer.from(paymentHash).toString("hex"),
      encryptedAmount: new Uint8Array(0), // Amount is handled by Token-2022
      status: "pending",
    };

    // Store payment request
    this.paymentRequests.set(paymentId, paymentResponse);

    return paymentResponse;
  }

  /**
   * Create payment request on-chain
   * @param paymentId Payment identifier
   * @param payerAddress Payer wallet address
   * @param payeeAddress Payee wallet address
   * @param encryptedAmount Encrypted amount
   * @param paymentHash Payment hash
   * @param signer Signer keypair
   * @returns Transaction signature
   */
  async createOnChainPaymentRequest(
    paymentId: string,
    payerAddress: string,
    payeeAddress: string,
    encryptedAmount: Uint8Array,
    paymentHash: string,
    signer: Keypair
  ): Promise<string> {
    if (!this.facilitatorProgramId) {
      throw new Error("Service not initialized");
    }

    try {
      // TODO: Build instruction to create payment request
      // This would call void_facilitator::create_payment_request
      
      // Convert paymentId and paymentHash to [u8; 32]
      const paymentIdBytes = await this.stringToBytes32(paymentId);
      const paymentHashBytes = this.hexToBytes32(paymentHash);

      const transaction = new Transaction();
      // Add instruction here:
      // - Call facilitator program
      // - Pass payment_id, encrypted_amount, payment_hash
      // - Set payer and payee

      // Placeholder - actual implementation would use Anchor IDL
      // const instruction = await program.methods
      //   .createPaymentRequest(paymentIdBytes, encryptedAmount, paymentHashBytes)
      //   .accounts({...})
      //   .instruction();

      // transaction.add(instruction);

      // For now, return placeholder
      return "placeholder_signature";
    } catch (error) {
      throw new Error(
        `Failed to create payment request: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Verify x402 payment
   * @param paymentId Payment identifier
   * @param encryptedAmount Encrypted amount from client (not used with Token-2022)
   * @returns Whether payment is valid
   */
  async verifyPayment(
    paymentId: string,
    encryptedAmount: Uint8Array
  ): Promise<boolean> {
    const payment = this.paymentRequests.get(paymentId);
    if (!payment) {
      return false;
    }

    // With Token-2022, verification happens on-chain during settlement
    // This just checks if payment request exists
    return payment.status === "pending";
  }

  /**
   * Settle x402 payment on-chain using Token-2022 confidential transfers
   * @param paymentId Payment identifier
   * @param payerAddress Payer wallet address
   * @param payeeAddress Payee wallet address
   * @param amount Payment amount
   * @param signer Wallet signer
   * @returns Transaction result
   */
  async settlePayment(
    paymentId: string,
    payerAddress: string,
    payeeAddress: string,
    amount: number,
    signer: Keypair
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    const payment = this.paymentRequests.get(paymentId);
    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (payment.status !== "pending") {
      return { success: false, error: "Payment already processed" };
    }

    try {
      if (!this.facilitatorProgramId || !this.token2022Service) {
        throw new Error("Service not initialized");
      }

      // Use solanaTransactionService to execute confidential transfer
      const transferResult = await solanaTransactionService.executeEncryptedTransfer(
        {
          from: payerAddress,
          to: payeeAddress,
          amount: amount,
          privacyLevel: "full",
        },
        signer
      );

      if (transferResult.success) {
        payment.status = "settled";
        return { success: true, signature: transferResult.signature };
      } else {
        payment.status = "failed";
        return {
          success: false,
          error: transferResult.error || "Transfer failed",
        };
      }
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
    return createHash("sha256")
      .update(serviceId + Date.now().toString())
      .digest("hex")
      .substring(0, 32);
  }

  /**
   * Convert string to [u8; 32]
   */
  private async stringToBytes32(str: string): Promise<Uint8Array> {
    const hash = createHash("sha256").update(str).digest();
    return new Uint8Array(hash.slice(0, 32));
  }

  /**
   * Convert hex string to [u8; 32]
   */
  private hexToBytes32(hex: string): Uint8Array {
    const buffer = Buffer.from(hex, "hex");
    return new Uint8Array(buffer.slice(0, 32));
  }
}

export const solanaX402Service = new SolanaX402Service();

