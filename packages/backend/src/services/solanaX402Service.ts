/**
 * Solana x402 Payment Service
 * Handles x402 payment processing on Solana with Token-2022 confidential transfers
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createHash } from "crypto";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Token2022Service } from "./token2022Service.js";
import { solanaTransactionService } from "./solanaTransactionService.js";
import bs58 from "bs58";

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
   * @param amount Payment amount (for on-chain verification)
   * @param paymentHash Payment hash
   * @param connection Solana connection
   * @returns Transaction signature
   */
  async createOnChainPaymentRequest(
    paymentId: string,
    payerAddress: string,
    payeeAddress: string,
    amount: number,
    paymentHash: string,
    connection: Connection
  ): Promise<string> {
    if (!this.facilitatorProgramId) {
      throw new Error("Service not initialized");
    }

    try {
      // Convert paymentId and paymentHash to [u8; 32]
      const paymentIdBytes = await this.stringToBytes32(paymentId);
      const paymentHashBytes = this.hexToBytes32(paymentHash);

      const payerPubkey = new PublicKey(payerAddress);
      const payeePubkey = new PublicKey(payeeAddress);

      // Derive payment request PDA
      const [paymentRequestPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("payment_request"),
          paymentIdBytes,
        ],
        this.facilitatorProgramId
      );

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash("confirmed");

      // Build Anchor instruction manually
      // Anchor instruction format: discriminator (8 bytes) + method args
      // create_payment_request(payment_id: [u8; 32], amount: u64, payment_hash: [u8; 32])
      
      // Discriminator for create_payment_request (first 8 bytes of sha256("global:create_payment_request"))
      // In Anchor, this is typically the first 8 bytes of the method name hash
      const methodName = "create_payment_request";
      const methodHash = createHash("sha256")
        .update(`global:${methodName}`)
        .digest();
      const discriminator = methodHash.slice(0, 8);

      // Build instruction data
      // Format: discriminator (8) + payment_id (32) + amount (8) + payment_hash (32)
      const amountBytes = Buffer.allocUnsafe(8);
      amountBytes.writeBigUInt64LE(BigInt(Math.floor(amount * 1e9)), 0);
      
      const instructionData = Buffer.concat([
        Buffer.from(discriminator),
        Buffer.from(paymentIdBytes),
        amountBytes,
        Buffer.from(paymentHashBytes),
      ]);

      // Build accounts array for Anchor instruction
      // Accounts: payment_request, payer, payee, system_program
      const accounts = [
        {
          pubkey: paymentRequestPDA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: payerPubkey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: payeePubkey,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ];

      // Create instruction
      const instruction = {
        programId: this.facilitatorProgramId,
        keys: accounts,
        data: instructionData,
      };

      // Build transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payerPubkey;
      transaction.add(instruction);

      // Note: This transaction needs to be signed by the payer
      // In production, this would be sent to the client for signing
      // For now, we return the serialized unsigned transaction
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Return base58 encoded transaction (client will sign and submit)
      return bs58.encode(serialized);
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

