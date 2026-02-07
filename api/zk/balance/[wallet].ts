/**
 * Void402 Balance API (1:1 with Nolvipay)
 * GET /api/zk/balance/:wallet?token=USDC
 * 
 * Gets user's private balance (visible only to them)
 * REQUIRES bearer token authentication
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import { extractBearerToken, verifyBearerToken } from "../../lib/bearer-auth.js";
import { 
  deriveUserBalancePDA,
  isValidSolanaAddress,
  getSolanaConnection,
} from "../../lib/void402-solana.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const wallet = req.query.wallet as string;
    const token = req.query.token as string || 'USDC';

    if (!wallet) {
      return res.status(400).json({ error: "Wallet is required" });
    }

    if (!isValidSolanaAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: "Token must be USDC or USDT" });
    }

    // Check bearer token authentication (soft check - return 0 balance if not authenticated)
    const bearerToken = extractBearerToken(req);
    
    if (!bearerToken) {
      console.log(`[Balance] No bearer token for ${wallet} - returning 0 balance`);
      return res.status(200).json({
        balance: 0,
        token: token,
        available: 0,
        deposited: 0,
        withdrawn: 0,
        message: 'Not authenticated - showing 0 balance'
      });
    }

    // Verify bearer token (soft check)
    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    
    if (!tokenVerification.valid) {
      console.log(`[Balance] Invalid token for ${wallet}: ${tokenVerification.error} - returning 0 balance`);
      return res.status(200).json({
        balance: 0,
        token: token,
        available: 0,
        deposited: 0,
        withdrawn: 0,
        message: tokenVerification.error || 'Session invalid - showing 0 balance'
      });
    }

    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;
    
    // Look up user's intermediate wallet from database
    let walletMapping = null;
    try {
      const { data, error: lookupError } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', wallet)
        .maybeSingle();
      
      if (lookupError) {
        console.log(`[Balance] No mapping found for ${wallet} - ${token}:`, lookupError.message);
        return res.status(200).json({
          balance: 0,
          token: token,
          available: 0,
          deposited: 0,
          withdrawn: 0,
        });
      }
      
      walletMapping = data;
      
      if (!walletMapping || !walletMapping.intermediate_wallet) {
        console.log(`[Balance] No intermediate wallet assigned for ${wallet} - ${token}`);
        return res.status(200).json({
          balance: 0,
          token: token,
          available: 0,
          deposited: 0,
          withdrawn: 0,
        });
      }
      
      console.log(`[Balance] Found mapping for ${wallet}: ${walletMapping.intermediate_wallet.substring(0, 8)}...`);
    } catch (dbError: any) {
      console.error('[Balance] Database error:', dbError);
      return res.status(200).json({
        balance: 0,
        token: token,
        available: 0,
        deposited: 0,
        withdrawn: 0,
      });
    }
    
    // Calculate balance from database transactions
    let balance = 0;
    let deposited = 0;
    let withdrawn = 0;
    
    try {
      // Try query with extended columns first, fall back to basic columns
      let allTransactions: any[] | null = null;
      let txError: any = null;
      let hasFeeColumn = true;
      
      // First try with fee_percentage and transaction_type columns
      const result1 = await supabase
        .from('zk_transactions')
        .select('id, status, sender_wallet, recipient_wallet, amount, fee_percentage, token_symbol, privacy_level, transaction_type')
        .or(`sender_wallet.eq.${wallet},recipient_wallet.eq.${wallet}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });
      
      if (result1.error) {
        console.warn(`[Balance] Extended query failed (${result1.error.message}), trying basic columns...`);
        hasFeeColumn = false;
        
        // Fallback: only core columns
        const result2 = await supabase
          .from('zk_transactions')
          .select('id, status, sender_wallet, recipient_wallet, amount, token_symbol, privacy_level')
          .or(`sender_wallet.eq.${wallet},recipient_wallet.eq.${wallet}`)
          .eq('status', 'completed')
          .order('created_at', { ascending: true });
        
        allTransactions = result2.data;
        txError = result2.error;
      } else {
        allTransactions = result1.data;
      }
      
      // Filter transactions that affect this token's balance
      const transactions = (allTransactions || []).filter((tx: any) => {
        return tx.token_symbol === token;
      });
      
      if (txError) {
        console.error(`[Balance] Error querying transactions:`, txError.message);
      }
      
      console.log(`[Balance] Found ${transactions?.length || 0} transactions for wallet ${wallet} (hasFeeColumn: ${hasFeeColumn})`);
      
      if (transactions && transactions.length > 0) {
        const DEFAULT_FEE_PERCENT = 10; // Default 10% fee for deposits
        
        transactions.forEach((tx: any, index: number) => {
          const amount = parseFloat(tx.amount || 0);
          
          // Get fee percentage from DB if available
          let feePercent = 0;
          if (hasFeeColumn && tx.fee_percentage !== null && tx.fee_percentage !== undefined) {
            feePercent = parseFloat(tx.fee_percentage);
          }
          
          // IMPORTANT: Check withdraw BEFORE deposit, because both have sender == recipient == wallet
          // Withdraw: transaction_type is 'withdraw'
          if (tx.transaction_type === 'withdraw') {
            balance -= amount;
            withdrawn += amount;
            console.log(`[Balance] -${amount} (withdrawal)`);
          }
          // Deposit: sender == recipient (depositing to self)
          else if (tx.sender_wallet === wallet && tx.recipient_wallet === wallet) {
            // Deposits always have fees (default 10% if not stored)
            const depositFee = feePercent > 0 ? feePercent : DEFAULT_FEE_PERCENT;
            const amountAfterFees = amount * (1 - depositFee / 100);
            balance += amountAfterFees;
            deposited += amount;
            console.log(`[Balance] +${amountAfterFees.toFixed(4)} (deposit $${amount}, fee ${depositFee}%)`);
          }
          // Internal transfer received (username to username) - NO fee
          else if (tx.recipient_wallet === wallet && tx.sender_wallet !== wallet) {
            // Internal transfers are fee-free; use stored fee (should be 0)
            const transferFee = feePercent; // 0 for internal transfers
            const amountAfterFees = transferFee > 0 ? amount * (1 - transferFee / 100) : amount;
            balance += amountAfterFees;
            console.log(`[Balance] +${amountAfterFees.toFixed(4)} (received transfer, fee ${transferFee}%)`);
          }
          // Transfer sent
          else if (tx.sender_wallet === wallet && tx.recipient_wallet !== wallet) {
            balance -= amount;
            console.log(`[Balance] -${amount} (sent transfer)`);
          }
        });
      }
      
      // Ensure balance is never negative
      balance = Math.max(0, balance);
      
      console.log(`[Balance] Calculated balance from database: ${balance} ${token} for wallet ${wallet}`);
      
      return res.status(200).json({
        balance: balance,
        token: token,
        available: balance,
        deposited: deposited,
        withdrawn: withdrawn,
      });
    } catch (error: any) {
      console.error(`[Balance] Error calculating balance from database:`, error.message);
      return res.status(200).json({
        balance: 0,
        token: token,
        available: 0,
        deposited: 0,
        withdrawn: 0,
      });
    }
  } catch (error: any) {
    console.error('❌ Error getting balance:', error);
    return res.status(500).json({ 
      error: 'Failed to get balance', 
      message: error?.message || 'Unknown error occurred',
    });
  }
}
