/**
 * ZK Relayer Routes
 * API endpoints for relayer service (submitting payments)
 */

import { Router, Request, Response } from 'express';
import { getZKRelayerService } from '../services/zkRelayerService.js';
import { generalRateLimiter } from '../middleware/index.js';

const router = Router();
const relayerService = getZKRelayerService();

/**
 * POST /api/zk-pay/relayer/submit
 * Submit payment via relayer (hides sender identity)
 */
router.post('/relayer/submit', generalRateLimiter, async (req: Request, res: Response) => {
  try {
    const { nonce, recipient, sender_wallet, relayer_fee } = req.body;

    if (!nonce || !recipient || !sender_wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nonce, recipient, sender_wallet',
      });
    }

    const nonceNumber = typeof nonce === 'string' ? parseInt(nonce, 10) : Number(nonce);
    if (isNaN(nonceNumber) || !Number.isInteger(nonceNumber) || nonceNumber < 0) {
      return res.status(400).json({
        success: false,
        error: 'Nonce must be a valid positive integer',
      });
    }

    const result = await relayerService.submitPayment({
      nonce: nonceNumber,
      recipient,
      senderWallet: sender_wallet,
      relayerFee: relayer_fee,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      tx_signature: result.signature,
      transfer_amount: result.transferAmount,
      fee: relayer_fee || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
