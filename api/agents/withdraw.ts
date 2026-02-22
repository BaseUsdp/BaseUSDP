/**
 * POST /api/agents/withdraw
 * Programmatic withdraw by AI agent (AgentKey auth)
 * Delegates to existing withdraw/external transfer logic
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractAgentKey, verifyAgentKey } from '../lib/agent-auth.js';
import { checkSpendingPolicy, logSpendingAttempt } from '../lib/agent-policy.js';
import { isBaseChain } from '../lib/chain-config.js';
import {
  isValidBaseAddress,
  getPrivacyPoolContract,
  getTokenAddress,
  parseUsdc,
  getBaseProvider,
} from '../lib/void402-base.js';
import { generatePrivacyNonce, getProofId, generateMockProof } from '../lib/privacy-utils-base.js';
import { getBaseIntermediateWalletPool } from '../lib/intermediate-wallet-pool-base.js';
import { ethers as ethersLib } from 'ethers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com", "https://www.void402.com",
  "https://orb402.com", "https://www.orb402.com",
  "http://localhost:5173", "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = extractAgentKey(req);
  if (!agentKey) return res.status(401).json({ error: 'Agent API key required' });

  const auth = await verifyAgentKey(agentKey);
  if (!auth.valid || !auth.agentId || !auth.ownerWallet) {
    return res.status(403).json({ error: auth.error || 'Invalid agent key' });
  }

  if (!auth.scopes?.includes('withdraw')) {
    return res.status(403).json({ error: 'API key does not have withdraw scope' });
  }

  const { recipient_wallet, amount, token } = req.body || {};

  if (!recipient_wallet || !amount || !token) {
    return res.status(400).json({ error: 'recipient_wallet, amount, and token are required' });
  }

  if (!['USDC', 'USDT'].includes(token)) {
    return res.status(400).json({ error: 'Token must be USDC or USDT' });
  }

  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  if (!isValidBaseAddress(recipient_wallet)) {
    return res.status(400).json({ error: 'Invalid recipient address' });
  }

  // Check spending policy
  const policyCheck = await checkSpendingPolicy(auth.agentId, withdrawAmount, token, recipient_wallet);
  if (!policyCheck.allowed) {
    await logSpendingAttempt(auth.agentId, 'withdraw', withdrawAmount, token, 'blocked', recipient_wallet, policyCheck.reason);
    return res.status(403).json({ error: policyCheck.reason || 'Policy violation' });
  }

  await logSpendingAttempt(auth.agentId, 'withdraw', withdrawAmount, token, 'allowed', recipient_wallet);

  if (!isBaseChain()) {
    return res.status(400).json({ error: 'Agent withdrawals are only supported on Base chain' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const tokenAddress = getTokenAddress(token);
    const provider = getBaseProvider();
    const amountInUnits = parseUsdc(withdrawAmount.toString());

    const baseIntPool = getBaseIntermediateWalletPool();
    await baseIntPool.initialize();

    let intWalletData: any = null;
    const readonlyPool = getPrivacyPoolContract(provider as any);
    for (const candidate of baseIntPool.getAllWallets()) {
      try {
        const [available] = await readonlyPool.getUserBalance(candidate.address, tokenAddress);
        if (available >= amountInUnits) {
          intWalletData = candidate;
          break;
        }
      } catch {}
    }

    if (!intWalletData) {
      await logSpendingAttempt(auth.agentId, 'withdraw', withdrawAmount, token, 'failed', recipient_wallet, 'Insufficient pool balance');
      return res.status(400).json({ error: 'Insufficient pool balance' });
    }

    const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);
    const privacyPoolContract = getPrivacyPoolContract(intSigner);

    const privacyNonce = generatePrivacyNonce(auth.ownerWallet);
    const proofId = getProofId(privacyNonce);
    const { proofBytes, commitmentBytes, blindingFactorBytes } = generateMockProof(
      auth.ownerWallet, amountInUnits, privacyNonce,
    );

    const uploadTx = await privacyPoolContract.uploadProof(
      privacyNonce, amountInUnits, tokenAddress,
      proofBytes, commitmentBytes, blindingFactorBytes,
    );
    await uploadTx.wait();

    // External transfer (withdrawal)
    const transferTx = await privacyPoolContract.externalTransfer(proofId, recipient_wallet, 0n);
    const receipt = await transferTx.wait();
    const signature = receipt.hash;

    // Log
    try {
      await supabase.from('zk_transactions').insert({
        sender_wallet: auth.ownerWallet,
        recipient_wallet,
        amount: withdrawAmount,
        fee_percentage: 0,
        token_symbol: token,
        tx_hash: signature,
        status: 'completed',
        privacy_level: 'full',
        transaction_type: 'withdraw',
        agent_id: auth.agentId,
      });
    } catch {}

    await logSpendingAttempt(auth.agentId, 'withdraw', withdrawAmount, token, 'completed', recipient_wallet, undefined, signature);

    return res.status(200).json({
      success: true,
      signature,
      amount: withdrawAmount,
      token,
      recipient: recipient_wallet,
    });
  } catch (err: any) {
    console.error(`[Agent Withdraw] Error:`, err.message);
    await logSpendingAttempt(auth.agentId, 'withdraw', withdrawAmount, token, 'failed', recipient_wallet, err.message);
    return res.status(500).json({ error: 'Withdrawal failed: ' + err.message });
  }
}
