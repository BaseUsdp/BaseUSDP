/**
 * ZK Proof Routes
 * API endpoints for uploading zero-knowledge proofs
 */

import { Router, Request, Response } from 'express';
import { getZKProofService } from '../services/zkProofService.js';
import { getDatabaseService } from '../services/databaseService.js';
import { generalRateLimiter } from '../middleware/index.js';

const router = Router();
const proofService = getZKProofService();

/**
 * POST /api/zk-pay/upload-proof
 * Upload a zero-knowledge proof to on-chain
 */
router.post('/upload-proof', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      sender_wallet,
      token,
      amount,
      nonce,
      proof_bytes,
      commitment_bytes,
      blinding_factor_bytes,
      server_sign,
      wallet_signature,
      message_to_sign,
    } = req.body;

    // Validation
    if (!sender_wallet || !token || !amount || nonce === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sender_wallet, token, amount, nonce',
      });
    }

    if (!['SOL', 'USDC', 'USDT'].includes(token)) {
      return res.status(400).json({
        success: false,
        error: 'Token must be SOL, USDC, or USDT',
      });
    }

    const nonceNumber = typeof nonce === 'string' ? parseInt(nonce, 10) : Number(nonce);
    if (isNaN(nonceNumber) || !Number.isInteger(nonceNumber) || nonceNumber < 0) {
      return res.status(400).json({
        success: false,
        error: 'Nonce must be a valid positive integer',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero',
      });
    }

    // Convert proof data to buffers
    const proofBytes = proof_bytes ? Buffer.from(proof_bytes, 'base64') : Buffer.alloc(0);
    const commitmentBytes = commitment_bytes ? Buffer.from(commitment_bytes, 'base64') : Buffer.alloc(0);
    const blindingFactorBytes = blinding_factor_bytes ? Buffer.from(blinding_factor_bytes, 'base64') : Buffer.alloc(0);

    // SECURITY: Check if proof nonce is already used (prevent replay attacks)
    const dbService = getDatabaseService();
    if (dbService.isAvailable()) {
      const isUsed = await dbService.isProofUsed(nonceNumber);
      if (isUsed) {
        return res.status(400).json({
          success: false,
          error: 'Proof nonce already used. Each proof can only be used once.',
        });
      }
    }

    // Upload proof
    const result = await proofService.uploadProof({
      senderWallet: sender_wallet,
      token,
      amount,
      nonce: nonceNumber,
      proofBytes,
      commitmentBytes,
      blindingFactorBytes,
      serverSign: server_sign || false,
      walletSignature: wallet_signature,
      messageToSign: message_to_sign,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // SECURITY: Log audit event
    if (dbService.isAvailable()) {
      await dbService.logAuditEvent(
        'zk_proof_upload',
        sender_wallet,
        req.ip,
        req.get('user-agent'),
        {
          nonce: nonceNumber,
          amount,
          token,
          proof_pda: result.proofPDA,
        }
      );
    }

    res.json({
      success: true,
      signature: result.signature,
      unsigned_tx_base64: result.unsignedTransaction,
      proof_pda: result.proofPDA,
      nonce: nonceNumber,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
