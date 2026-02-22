/**
 * POST /api/agents/transfer
 * Programmatic transfer by AI agent (AgentKey auth)
 * Delegates to existing ZK transfer logic
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractAgentKey, verifyAgentKey } from '../lib/agent-auth.js';
import { checkSpendingPolicy, logSpendingAttempt } from '../lib/agent-policy.js';
import { isBaseChain } from '../lib/chain-config.js';
import {
  isValidBaseAddress,
  getPrivacyPoolContract,
  getUsdcAddress,
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

  // Agent key auth
  const agentKey = extractAgentKey(req);
  if (!agentKey) return res.status(401).json({ error: 'Agent API key required' });

  const auth = await verifyAgentKey(agentKey);
  if (!auth.valid || !auth.agentId || !auth.ownerWallet) {
    return res.status(403).json({ error: auth.error || 'Invalid agent key' });
  }

  // Check scope
  if (!auth.scopes?.includes('transfer')) {
    return res.status(403).json({ error: 'API key does not have transfer scope' });
  }

  const { recipient_wallet, recipient_username, to, amount, token, force_external } = req.body || {};
  // "to" is a shorthand: if it looks like an address use as wallet, otherwise treat as username
  const resolvedRecipientWallet = recipient_wallet || (to && to.startsWith('0x') ? to : undefined);
  const resolvedRecipientUsername = recipient_username || (to && !to.startsWith('0x') ? to : undefined);

  if (!amount || !token) {
    return res.status(400).json({ error: 'amount and token are required' });
  }

  if (!['USDC', 'USDT'].includes(token)) {
    return res.status(400).json({ error: 'Token must be USDC or USDT' });
  }

  const transferAmount = parseFloat(amount);
  if (isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Check spending policy
  const policyCheck = await checkSpendingPolicy(
    auth.agentId,
    transferAmount,
    token,
    recipient_wallet
  );

  if (!policyCheck.allowed) {
    await logSpendingAttempt(auth.agentId, 'transfer', transferAmount, token, 'blocked', recipient_wallet, policyCheck.reason);
    return res.status(403).json({ error: policyCheck.reason || 'Policy violation' });
  }

  // Log the allowed attempt
  await logSpendingAttempt(auth.agentId, 'transfer', transferAmount, token, 'allowed', recipient_wallet);

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // === Delegate to Base chain transfer logic (same as zk/transfer.ts) ===
  if (!isBaseChain()) {
    return res.status(400).json({ error: 'Agent transfers are only supported on Base chain' });
  }

  // Resolve recipient
  let resolvedRecipient = resolvedRecipientWallet;
  if (!resolvedRecipient && resolvedRecipientUsername) {
    const cleanUsername = resolvedRecipientUsername.startsWith("@") ? resolvedRecipientUsername.substring(1) : resolvedRecipientUsername;
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("wallet_address")
      .ilike("username", cleanUsername)
      .maybeSingle();
    if (!userProfile) {
      return res.status(404).json({ error: `Username "${resolvedRecipientUsername}" not found` });
    }
    resolvedRecipient = userProfile.wallet_address;
  }

  if (!resolvedRecipient) {
    return res.status(400).json({ error: '"to" (username or 0x address), "recipient_wallet", or "recipient_username" is required' });
  }

  if (!isValidBaseAddress(resolvedRecipient)) {
    return res.status(400).json({ error: 'Invalid recipient address' });
  }

  const senderWallet = auth.ownerWallet;
  if (senderWallet.toLowerCase() === resolvedRecipient.toLowerCase()) {
    return res.status(400).json({ error: 'Self-transfers are not allowed' });
  }

  try {
    const tokenAddress = getTokenAddress(token);
    const provider = getBaseProvider();
    const amountInUnits = parseUsdc(transferAmount.toString());

    const baseIntPool = getBaseIntermediateWalletPool();
    await baseIntPool.initialize();

    // Find an intermediate wallet with sufficient balance
    let intWalletData: any = null;
    const readonlyPool = getPrivacyPoolContract(provider as any);
    const allWallets = baseIntPool.getAllWallets();
    for (const candidate of allWallets) {
      try {
        const [available] = await readonlyPool.getUserBalance(candidate.address, tokenAddress);
        if (available >= amountInUnits) {
          intWalletData = candidate;
          break;
        }
      } catch (e: any) {
        console.warn(`[Agent Transfer] Failed to check balance for ${candidate.address}: ${e.message}`);
      }
    }

    if (!intWalletData) {
      await logSpendingAttempt(auth.agentId, 'transfer', transferAmount, token, 'failed', resolvedRecipient, 'Insufficient pool balance');
      return res.status(400).json({ error: 'Insufficient pool balance' });
    }

    const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);

    // Fund intermediate with ETH if needed
    const intEthBalance = await provider.getBalance(intWalletData.address);
    const ethNeeded = ethersLib.parseEther("0.002");
    if (intEthBalance < ethNeeded) {
      const fundAmount = ethNeeded - intEthBalance;
      const funderKeys = [
        { name: 'collection', key: process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE },
        { name: 'mixer', key: process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY_BASE },
      ];
      for (const { name, key } of funderKeys) {
        if (!key) continue;
        try {
          const funder = new ethersLib.Wallet(key, provider);
          const funderBalance = await provider.getBalance(funder.address);
          if (funderBalance < fundAmount + ethersLib.parseEther("0.00015")) continue;
          const fundTx = await funder.sendTransaction({ to: intWalletData.address, value: fundAmount });
          await fundTx.wait();
          break;
        } catch {}
      }
    }

    const privacyPoolContract = getPrivacyPoolContract(intSigner);

    // Generate nonce and proof
    const privacyNonce = generatePrivacyNonce(senderWallet);
    const proofId = getProofId(privacyNonce);
    const { proofBytes, commitmentBytes, blindingFactorBytes } = generateMockProof(
      senderWallet,
      amountInUnits,
      privacyNonce,
    );

    // Upload proof
    const uploadTx = await privacyPoolContract.uploadProof(
      privacyNonce, amountInUnits, tokenAddress,
      proofBytes, commitmentBytes, blindingFactorBytes,
    );
    await uploadTx.wait();

    // Determine internal vs external
    let recipientIsVoid402User = false;
    if (!force_external && !resolvedRecipientUsername) {
      const { data: recipientProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .ilike('wallet_address', resolvedRecipient)
        .maybeSingle();
      if (recipientProfile) recipientIsVoid402User = true;
    } else if (resolvedRecipientUsername) {
      recipientIsVoid402User = true;
    }

    const relayerFee = 0n;
    let signature: string;

    if (recipientIsVoid402User) {
      const transferTx = await privacyPoolContract.internalTransfer(proofId, resolvedRecipient, relayerFee);
      const receipt = await transferTx.wait();
      signature = receipt.hash;
    } else {
      const transferTx = await privacyPoolContract.externalTransfer(proofId, resolvedRecipient, relayerFee);
      const receipt = await transferTx.wait();
      signature = receipt.hash;
    }

    // Log to zk_transactions with agent_id
    try {
      await supabase.from('zk_transactions').insert({
        sender_wallet: senderWallet,
        recipient_wallet: resolvedRecipient,
        amount: transferAmount,
        fee_percentage: 0,
        token_symbol: token,
        tx_hash: signature,
        status: 'completed',
        privacy_level: 'full',
        transaction_type: 'transfer',
        agent_id: auth.agentId,
      });
    } catch (logErr: any) {
      console.warn(`Failed to log agent transfer:`, logErr.message);
    }

    // Update spending log to completed
    await logSpendingAttempt(auth.agentId, 'transfer', transferAmount, token, 'completed', resolvedRecipient, undefined, signature);

    return res.status(200).json({
      success: true,
      signature,
      amount: transferAmount,
      token,
      recipient: resolvedRecipient,
    });
  } catch (err: any) {
    console.error(`[Agent Transfer] Error:`, err.message);
    await logSpendingAttempt(auth.agentId, 'transfer', transferAmount, token, 'failed', resolvedRecipient, err.message);
    return res.status(500).json({ error: 'Transfer failed: ' + err.message });
  }
}
