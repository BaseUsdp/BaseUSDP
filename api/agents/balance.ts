/**
 * GET /api/agents/balance
 * Check owner's pool balance (AgentKey auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractAgentKey, verifyAgentKey } from '../lib/agent-auth.js';
import { isBaseChain } from '../lib/chain-config.js';
import {
  getPrivacyPoolContract,
  getTokenAddress,
  formatUsdc,
  getBaseProvider,
} from '../lib/void402-base.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = extractAgentKey(req);
  if (!agentKey) return res.status(401).json({ error: 'Agent API key required' });

  const auth = await verifyAgentKey(agentKey);
  if (!auth.valid || !auth.ownerWallet) {
    return res.status(403).json({ error: auth.error || 'Invalid agent key' });
  }

  if (!auth.scopes?.includes('balance')) {
    return res.status(403).json({ error: 'API key does not have balance scope' });
  }

  if (!isBaseChain()) {
    return res.status(400).json({ error: 'Only supported on Base chain' });
  }

  try {
    const provider = getBaseProvider();
    const readonlyPool = getPrivacyPoolContract(provider as any);

    const usdcAddress = getTokenAddress('USDC');
    const usdtAddress = getTokenAddress('USDT');

    const [usdcBalance] = await readonlyPool.getUserBalance(auth.ownerWallet, usdcAddress);
    const [usdtBalance] = await readonlyPool.getUserBalance(auth.ownerWallet, usdtAddress);

    return res.status(200).json({
      success: true,
      wallet: auth.ownerWallet,
      balances: {
        USDC: parseFloat(formatUsdc(usdcBalance)),
        USDT: parseFloat(formatUsdc(usdtBalance)),
      },
    });
  } catch (err: any) {
    console.error(`[Agent Balance] Error:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch balance' });
  }
}
