/**
 * Void402 Submit Transaction API
 * POST /api/solana/submit-transaction
 * 
 * Submits a signed transaction to the Solana network.
 * Used by the frontend after the user signs a deposit transaction.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSolanaConnection } from '../lib/void402-solana.js';

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { signedTransaction } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({ error: 'signedTransaction is required' });
    }

    const connection = getSolanaConnection();

    // Decode base64 to Uint8Array (server-side compatible)
    const transactionBuffer = Buffer.from(signedTransaction, 'base64');

    // Send raw transaction
    const signature = await connection.sendRawTransaction(transactionBuffer, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✅ Transaction submitted: ${signature}`);

    return res.status(200).json({
      success: true,
      signature: signature,
    });
  } catch (error: any) {
    console.error('❌ Error submitting transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit transaction',
      message: error?.message || 'Unknown error',
    });
  }
}
