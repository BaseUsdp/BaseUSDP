/**
 * Void402 x402 Process Deposits API (1:1 with CrabPrivacy)
 * POST/GET /api/x402/process-deposits
 * 
 * Detects Base USDC deposits by scanning Transfer events,
 * bridges via ChangeNow (usdcbase → usdcsol),
 * and credits user balance on completion.
 * 
 * Supports GET for Vercel cron jobs.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const BASE_WALLET_ADDRESS = process.env.BASE_WALLET_ADDRESS;
const BASE_WALLET_PRIVATE_KEY = process.env.BASE_WALLET_PRIVATE_KEY;
const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY;
const CHANGENOW_BASE_URL = 'https://api.changenow.io/v1';
const MIXER_WITHDRAWAL_WALLET = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;

// Base USDC contract and constants
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_USDC_DECIMALS = 6;
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com';
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Max blocks to scan per request (Base ~2s blocks, 2000 = ~67 min)
const MAX_BLOCKS_PER_SCAN = 2000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

/**
 * Get current Base block number
 */
async function getCurrentBlockNumber(): Promise<number> {
  const response = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: []
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return parseInt(data.result, 16);
}

/**
 * Detect USDC transfers to our wallet within a block range
 */
async function detectUsdcTransfers(
  targetAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<Array<{
  txHash: string;
  from: string;
  amount: number;
  blockNumber: number;
}>> {
  console.log(`[x402] Scanning blocks ${fromBlock} to ${toBlock} for transfers to ${targetAddress}`);

  const targetAddressTopic = '0x000000000000000000000000' + targetAddress.toLowerCase().replace('0x', '');

  const response = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [{
        address: BASE_USDC_ADDRESS,
        topics: [
          TRANSFER_EVENT_TOPIC,
          null, // from (any)
          targetAddressTopic // to (our address)
        ],
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16)
      }]
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('[x402] RPC error:', data.error);
    throw new Error(`RPC error: ${data.error.message}`);
  }

  const logs = data.result || [];
  console.log(`[x402] Found ${logs.length} Transfer events in block range`);

  const transfers: Array<{
    txHash: string;
    from: string;
    amount: number;
    blockNumber: number;
  }> = [];

  for (const log of logs) {
    const txHash = log.transactionHash;
    const blockNumber = parseInt(log.blockNumber, 16);
    const valueHex = log.data;
    const valueBigInt = BigInt(valueHex);
    const amount = Number(valueBigInt) / Math.pow(10, BASE_USDC_DECIMALS);
    const fromAddress = '0x' + log.topics[1].slice(-40);

    transfers.push({
      txHash,
      from: fromAddress,
      amount,
      blockNumber,
    });
  }

  return transfers;
}

/**
 * Transfer Base USDC to ChangeNow deposit address
 */
async function transferBaseUsdc(
  privateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  console.log(`[x402] Transferring ${amount} USDC to ${toAddress}`);

  const { ethers } = await import('ethers');
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const wallet = new ethers.Wallet(privateKey.trim(), provider);
  
  const erc20Abi = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)'
  ];

  const usdcContract = new ethers.Contract(BASE_USDC_ADDRESS, erc20Abi, wallet);
  const amountWei = ethers.parseUnits(amount.toString(), BASE_USDC_DECIMALS);

  const tx = await usdcContract.transfer(toAddress, amountWei);
  console.log(`[x402] TX sent: ${tx.hash}`);
  
  const receipt = await tx.wait();
  if (receipt.status === 0) {
    throw new Error('Transaction reverted');
  }

  console.log(`[x402] TX confirmed in block ${receipt.blockNumber}`);
  return tx.hash;
}

/**
 * Check ChangeNow bridge status and complete deposit if finished.
 * Polls ChangeNow up to 15 times (~75 seconds) in one call so the
 * entire deposit can complete without waiting for the next cron run.
 */
async function checkAndCompleteBridge(
  supabase: any,
  deposit: any
): Promise<{ completed: boolean; result: any }> {
  const MAX_POLLS = 15;
  const POLL_INTERVAL_MS = 5000; // 5 seconds between polls

  for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
    console.log(`[x402] Checking ChangeNow status for ${deposit.bridge_exchange_id} (attempt ${attempt}/${MAX_POLLS})`);
    
    const statusResponse = await fetch(
      `${CHANGENOW_BASE_URL}/transactions/${deposit.bridge_exchange_id}/${CHANGENOW_API_KEY}`
    );
    const statusData = await statusResponse.json();
    
    console.log(`[x402] ChangeNow status: ${statusData.status}`);

    if (statusData.status === 'finished') {
      // No platform fee — users get full amount
      const amountToCredit = deposit.received_amount;

      // ATOMIC CLAIM: Only complete if still 'bridging' (prevents double-credit)
      const { data: completeClaim, error: completeErr } = await supabase
        .from('x402_deposits')
        .update({
          status: 'completed',
          bridge_status: 'finished',
          bridge_progress: 'Bridge complete!',
          fee_amount: 0,
          amount_credited: amountToCredit,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('deposit_id', deposit.deposit_id)
        .eq('status', 'bridging')
        .select('deposit_id');

      if (completeErr || !completeClaim || completeClaim.length === 0) {
        console.log(`[x402] Deposit ${deposit.deposit_id} already completed by another instance`);
        return { completed: false, result: { depositId: deposit.deposit_id, status: 'already_completed' } };
      }

      // Record transaction in zk_transactions for user's balance
      try {
        await supabase.from('zk_transactions').insert({
          sender_wallet: deposit.user_wallet,
          recipient_wallet: deposit.user_wallet,
          amount: amountToCredit,
          fee_percentage: 0,
          token_symbol: 'USDC',
          tx_hash: `x402_${deposit.deposit_id}`,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: 'deposit',
        });
      } catch (txInsertError: any) {
        console.warn(`[x402] Transaction insert warning:`, txInsertError.message);
        try {
          await supabase.from('zk_transactions').insert({
            sender_wallet: deposit.user_wallet,
            recipient_wallet: deposit.user_wallet,
            amount: amountToCredit,
            token_symbol: 'USDC',
            tx_hash: `x402_${deposit.deposit_id}`,
            status: 'completed',
            privacy_level: 'full',
          });
        } catch (fallbackErr: any) {
          console.error(`[x402] Fallback insert also failed:`, fallbackErr.message);
        }
      }

      // Ensure user has intermediate wallet assigned
      const { data: existingMapping } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', deposit.user_wallet)
        .maybeSingle();

      if (!existingMapping) {
        try {
          const { getPrivacyUsdWalletPool } = await import('../lib/intermediate-wallet-pool.js');
          const intermediatePool = getPrivacyUsdWalletPool();
          await intermediatePool.initialize();
          const availableWallet = await intermediatePool.getAvailableWallet();
          
          await supabase.from('zk_user_wallets').upsert({
            user_wallet: deposit.user_wallet,
            intermediate_wallet: availableWallet.publicKey,
            token: 'USDC',
          }, { onConflict: 'user_wallet,token' });

          console.log(`[x402] Assigned intermediate wallet to ${deposit.user_wallet}`);
        } catch (walletError: any) {
          console.warn(`[x402] Could not assign intermediate wallet:`, walletError.message);
        }
      }

      console.log(`[x402] Deposit ${deposit.deposit_id} COMPLETED! Credited $${amountToCredit.toFixed(2)}`);
      return { completed: true, result: { depositId: deposit.deposit_id, status: 'completed', amountReceived: amountToCredit } };
      
    } else if (statusData.status === 'failed' || statusData.status === 'refunded') {
      await supabase.from('x402_deposits').update({
        status: 'failed',
        bridge_status: statusData.status,
        error_message: statusData.message || 'Bridge failed',
        updated_at: new Date().toISOString(),
      }).eq('deposit_id', deposit.deposit_id);
      
      console.log(`[x402] Deposit ${deposit.deposit_id} failed: ${statusData.status}`);
      return { completed: false, result: { depositId: deposit.deposit_id, status: 'failed', error: 'Bridge failed' } };
    }

    // Update bridge progress in DB so the frontend can see the current status
    const progressLabel = statusData.status === 'waiting' ? 'Waiting for ChangeNow...'
      : statusData.status === 'confirming' ? 'Confirming Base transaction...'
      : statusData.status === 'exchanging' ? 'Exchanging USDC (Base → Solana)...'
      : statusData.status === 'sending' ? 'Sending USDC to Solana...'
      : `Bridge status: ${statusData.status}`;

    await supabase.from('x402_deposits').update({
      bridge_status: statusData.status,
      bridge_progress: progressLabel,
      updated_at: new Date().toISOString(),
    }).eq('deposit_id', deposit.deposit_id);

    // Don't wait on the last attempt
    if (attempt < MAX_POLLS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  // After all polls, still bridging
  console.log(`[x402] Deposit ${deposit.deposit_id} still bridging after ${MAX_POLLS} polls`);
  return { completed: false, result: { depositId: deposit.deposit_id, status: 'bridging', message: 'Still waiting for bridge' } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey || !BASE_WALLET_ADDRESS || !BASE_WALLET_PRIVATE_KEY || !CHANGENOW_API_KEY || !MIXER_WITHDRAWAL_WALLET) {
    console.error('[x402] Missing env vars:', {
      hasSupabase: !!supabaseUrl && !!supabaseKey,
      hasBaseWallet: !!BASE_WALLET_ADDRESS,
      hasPrivateKey: !!BASE_WALLET_PRIVATE_KEY,
      hasChangeNow: !!CHANGENOW_API_KEY,
      hasMixerWallet: !!MIXER_WITHDRAWAL_WALLET,
    });
    return res.status(500).json({ error: 'Server not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('[x402] ========== Processing deposits ==========');

    const currentBlock = await getCurrentBlockNumber();
    console.log(`[x402] Current block: ${currentBlock}`);

    // Get pending deposits — exclude 'processing_received' and 'processing_bridge'
    // which indicate another instance is actively working on the transition
    const { data: pendingDeposits, error: fetchError } = await supabase
      .from('x402_deposits')
      .select('*')
      .in('status', ['pending', 'received', 'bridging'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('[x402] Fetch error:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch deposits' });
    }

    if (!pendingDeposits || pendingDeposits.length === 0) {
      console.log('[x402] No pending deposits');
      return res.status(200).json({ success: true, message: 'No pending deposits', processed: 0 });
    }

    console.log(`[x402] Found ${pendingDeposits.length} deposits to process`);

    // Get all tx hashes already used (prevent double-processing)
    const { data: existingTxHashes } = await supabase
      .from('x402_deposits')
      .select('base_tx_hash')
      .not('base_tx_hash', 'is', null);
    
    const usedTxHashes = new Set((existingTxHashes || []).map((d: any) => d.base_tx_hash?.toLowerCase()));

    const results: any[] = [];
    let completedCount = 0;

    for (const deposit of pendingDeposits) {
      try {
        console.log(`[x402] --- Processing ${deposit.deposit_id} (status: ${deposit.status}, expected: $${deposit.expected_amount}) ---`);

        // ========== PENDING: Look for incoming USDC ==========
        if (deposit.status === 'pending') {
          let scanFromBlock = deposit.starting_block_number;
          
          if (!scanFromBlock) {
            const createdAt = new Date(deposit.created_at).getTime();
            const now = Date.now();
            const secondsSinceCreation = (now - createdAt) / 1000;
            const blocksSinceCreation = Math.ceil(secondsSinceCreation / 2) + 100;
            scanFromBlock = Math.max(0, currentBlock - blocksSinceCreation);
            console.log(`[x402] No starting block, scanning from ~${blocksSinceCreation} blocks ago`);
          }

          const adjustedFromBlock = Math.max(scanFromBlock, currentBlock - MAX_BLOCKS_PER_SCAN);
          console.log(`[x402] Scanning from block ${adjustedFromBlock} to ${currentBlock}`);

          const transfers = await detectUsdcTransfers(BASE_WALLET_ADDRESS, adjustedFromBlock, currentBlock);
          console.log(`[x402] Found ${transfers.length} total transfers, checking for match...`);

          let matchingTransfer = null;
          
          for (const transfer of transfers) {
            if (usedTxHashes.has(transfer.txHash.toLowerCase())) {
              continue;
            }

            if (deposit.starting_block_number && transfer.blockNumber < deposit.starting_block_number) {
              continue;
            }

            // 1% tolerance for rounding
            const tolerance = deposit.expected_amount * 0.01;
            const amountDiff = Math.abs(transfer.amount - deposit.expected_amount);
            
            if (amountDiff <= tolerance) {
              matchingTransfer = transfer;
              console.log(`[x402] MATCH FOUND! tx ${transfer.txHash}`);
              break;
            }
          }

          if (matchingTransfer) {
            usedTxHashes.add(matchingTransfer.txHash.toLowerCase());
            
            // ATOMIC CLAIM: Only update if still 'pending' (prevents duplicate processing)
            const { data: claimed, error: claimErr } = await supabase
              .from('x402_deposits')
              .update({
                status: 'received',
                received_amount: matchingTransfer.amount,
                base_tx_hash: matchingTransfer.txHash,
                sender_address: matchingTransfer.from,
                received_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('deposit_id', deposit.deposit_id)
              .eq('status', 'pending')
              .select('deposit_id');

            if (claimErr || !claimed || claimed.length === 0) {
              console.log(`[x402] Deposit ${deposit.deposit_id} already claimed by another instance, skipping`);
              results.push({ depositId: deposit.deposit_id, status: 'already_claimed' });
              continue;
            }

            console.log(`[x402] Claimed deposit ${deposit.deposit_id} → 'received'`);

            // Create ChangeNow exchange (usdcbase → usdcsol)
            console.log(`[x402] Creating ChangeNow exchange...`);
            
            const cnResponse = await fetch(`${CHANGENOW_BASE_URL}/transactions/${CHANGENOW_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'usdcbase',
                to: 'usdcsol',
                amount: matchingTransfer.amount,
                address: MIXER_WITHDRAWAL_WALLET,
                refundAddress: BASE_WALLET_ADDRESS,
              }),
            });

            const cnData = await cnResponse.json();

            if (!cnResponse.ok || !cnData.id) {
              console.error(`[x402] ChangeNow error:`, cnData);
              await supabase.from('x402_deposits').update({
                status: 'failed',
                error_message: `ChangeNow: ${JSON.stringify(cnData)}`,
                updated_at: new Date().toISOString(),
              }).eq('deposit_id', deposit.deposit_id);
              
              results.push({ depositId: deposit.deposit_id, status: 'failed', error: 'ChangeNow error' });
              continue;
            }

            console.log(`[x402] ChangeNow exchange created: ${cnData.id}, payin: ${cnData.payinAddress}`);

            // Transfer Base USDC to ChangeNow
            try {
              const txHash = await transferBaseUsdc(
                BASE_WALLET_PRIVATE_KEY,
                cnData.payinAddress,
                matchingTransfer.amount
              );

              await supabase.from('x402_deposits').update({
                status: 'bridging',
                bridge_exchange_id: cnData.id,
                bridge_provider: 'changenow',
                bridge_status: 'waiting',
                bridge_progress: 'Sent to bridge, awaiting confirmation',
                bridge_tx_hash: txHash,
                updated_at: new Date().toISOString(),
              }).eq('deposit_id', deposit.deposit_id);

              console.log(`[x402] Deposit ${deposit.deposit_id} is now bridging, checking status immediately...`);

              // IMMEDIATELY check ChangeNow status (don't wait for next cron run)
              const bridgeResult = await checkAndCompleteBridge(supabase, {
                ...deposit,
                status: 'bridging',
                bridge_exchange_id: cnData.id,
                received_amount: matchingTransfer.amount,
              });

              if (bridgeResult.completed) {
                completedCount++;
              }
              results.push(bridgeResult.result);
            } catch (txError: any) {
              console.error(`[x402] Transfer to ChangeNow failed:`, txError);
              await supabase.from('x402_deposits').update({
                status: 'failed',
                error_message: `Transfer failed: ${txError.message}`,
                updated_at: new Date().toISOString(),
              }).eq('deposit_id', deposit.deposit_id);
              
              results.push({ depositId: deposit.deposit_id, status: 'failed', error: txError.message });
            }
          } else {
            results.push({ 
              depositId: deposit.deposit_id, 
              status: 'waiting', 
              message: 'No matching transfer found',
              scannedBlocks: currentBlock - adjustedFromBlock,
              transfersChecked: transfers.length,
            });
          }
        }

        // ========== BRIDGING: Check ChangeNow status ==========
        else if (deposit.status === 'bridging' && deposit.bridge_exchange_id) {
          const bridgeResult = await checkAndCompleteBridge(supabase, deposit);
          if (bridgeResult.completed) {
            completedCount++;
          }
          results.push(bridgeResult.result);
        }

        // ========== RECEIVED: Edge case ==========
        else if (deposit.status === 'received') {
          console.log(`[x402] Deposit ${deposit.deposit_id} stuck in 'received' - needs exchange creation`);
          results.push({ depositId: deposit.deposit_id, status: 'received', message: 'Needs exchange creation' });
        }

      } catch (error: any) {
        console.error(`[x402] Error processing ${deposit.deposit_id}:`, error);
        results.push({ depositId: deposit.deposit_id, status: 'error', error: error.message });
      }
    }

    console.log('[x402] ========== Processing complete ==========');
    console.log(`[x402] Processed: ${pendingDeposits.length}, Completed: ${completedCount}`);

    return res.status(200).json({
      success: true,
      processed: pendingDeposits.length,
      completed: completedCount,
      currentBlock,
      results,
    });
  } catch (error: any) {
    console.error('[x402] Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
