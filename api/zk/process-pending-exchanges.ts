/**
 * Void402 Process Pending Exchanges API (1:1 with NolviPay)
 * POST /api/zk/process-pending-exchanges
 * 
 * Processes ChangeNow exchanges and credits user accounts.
 * Uses smart contract deposit instruction to properly initialize UserBalance PDA.
 * Flow: Mixer Withdrawal Wallet -> Intermediate Wallet -> Pool PDA
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import { 
  derivePoolPDA, 
  deriveUserBalancePDA,
  VOID402_PROGRAM_ID,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';

// Token mints
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for deposit
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

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

function buildDepositInstruction({
  user,
  userBalance,
  pool,
  tokenMint,
  userTokenAccount,
  poolTokenAccount,
  amountLamports,
}: {
  user: PublicKey;
  userBalance: PublicKey;
  pool: PublicKey;
  tokenMint: PublicKey;
  userTokenAccount: PublicKey;
  poolTokenAccount: PublicKey;
  amountLamports: bigint;
}) {
  const args = Buffer.alloc(8);
  args.writeBigUInt64LE(amountLamports, 0);
  
  const instructionData = Buffer.concat([DEPOSIT_DISCRIMINATOR, args]);
  
  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userBalance, isSigner: false, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('🔍 process-pending-exchanges: Handler started');

  try {
    const { wallet } = req.body;
    console.log(`📋 Processing exchanges for wallet: ${wallet || 'ALL'}`);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find exchanges that haven't been credited to user yet
    let query = supabase
      .from('zk_exchanges')
      .select('*')
      .or('deposit_processed.is.null,deposit_processed.eq.false')
      .order('created_at', { ascending: true })
      .limit(20);
    
    // Filter by wallet if provided
    if (wallet) {
      const { data: holdingWallets } = await supabase
        .from('zk_holding_wallets')
        .select('deposit_id')
        .eq('user_wallet', wallet);
      
      if (holdingWallets && holdingWallets.length > 0) {
        const depositIds = holdingWallets.map((hw: any) => hw.deposit_id);
        query = query.in('deposit_id', depositIds);
        console.log(`📋 Filtering exchanges by ${depositIds.length} deposit(s) for wallet ${wallet}`);
      } else {
        query = query.or(`deposit_id.ilike.${wallet}_%,user_wallet.eq.${wallet}`);
        console.log(`📋 No holding wallets found, checking by deposit_id pattern or user_wallet`);
      }
    }
    
    const { data: exchanges, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      return res.status(500).json({ error: 'Query failed', details: queryError.message });
    }

    console.log(`📋 Found ${exchanges?.length || 0} exchanges to process`);

    if (!exchanges || exchanges.length === 0) {
      // Check for recently completed deposits
      if (wallet) {
        const { data: recentDeposits } = await supabase
          .from('zk_transactions')
          .select('tx_hash, created_at, amount')
          .eq('sender_wallet', wallet)
          .eq('recipient_wallet', wallet)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (recentDeposits && recentDeposits.length > 0) {
          const mostRecent = recentDeposits[0];
          const minutesAgo = (Date.now() - new Date(mostRecent.created_at).getTime()) / 1000 / 60;
          
          if (minutesAgo < 10) {
            return res.status(200).json({ 
              success: true, 
              message: 'Deposit was processed directly',
              processed: 0,
              results: [{
                status: 'already_processed',
                message: 'Deposit completed',
                amount: mostRecent.amount
              }]
            });
          }
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'No pending exchanges',
        processed: 0
      });
    }

    const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY || '';
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const results: any[] = [];
    let processedCount = 0;
    let updatedCount = 0;

    for (const exchange of exchanges) {
      try {
        console.log(`\n🔄 Processing exchange ${exchange.exchange_id}`);

        // Get user wallet
        let userWallet = exchange.user_wallet;
        let token = exchange.token;
        
        if (!userWallet) {
          const { data: holdingData } = await supabase
            .from('zk_holding_wallets')
            .select('user_wallet, token')
            .eq('deposit_id', exchange.deposit_id)
            .maybeSingle();
          
          if (holdingData) {
            userWallet = holdingData.user_wallet;
            token = token || holdingData.token;
          }
        }
        
        if (!userWallet) {
          console.log(`  ⚠️ No user_wallet for ${exchange.exchange_id}`);
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No user_wallet' });
          continue;
        }

        // Check ChangeNow status
        if (exchange.status !== 'finished') {
          const cnResponse = await fetch(
            `https://api.changenow.io/v1/transactions/${exchange.exchange_id}/${CHANGENOW_API_KEY}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
          );
          
          if (!cnResponse.ok) {
            console.log(`  ⚠️ ChangeNow API error: ${cnResponse.status}`);
            results.push({ exchangeId: exchange.exchange_id, status: 'api_error' });
            continue;
          }

          const cnStatus = await cnResponse.json();
          console.log(`  📊 ChangeNow status: ${cnStatus.status}`);

          // Update status in DB
          if (cnStatus.status !== exchange.status) {
            await supabase
              .from('zk_exchanges')
              .update({ 
                status: cnStatus.status,
                changenow_status: cnStatus.status,
              })
              .eq('id', exchange.id);
            updatedCount++;
          }

          if (cnStatus.status !== 'finished') {
            results.push({ exchangeId: exchange.exchange_id, status: cnStatus.status, action: 'waiting' });
            continue;
          }
        }

        // Skip if already processed
        if (exchange.deposit_processed === true) {
          console.log(`  ✅ Already processed`);
          results.push({ exchangeId: exchange.exchange_id, status: 'already_processed' });
          continue;
        }

        // Exchange is finished - process it
        console.log(`  💰 Processing for user ${userWallet}`);

        // Get user's intermediate wallet
        let { data: walletMapping } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('user_wallet', userWallet)
          .maybeSingle();

        let intermediateWallet: string;

        if (!walletMapping?.intermediate_wallet) {
          console.log(`  📝 No intermediate wallet for ${userWallet}, creating one...`);
          
          try {
            const intermediatePool = getPrivacyUsdWalletPool();
            await intermediatePool.initialize();
            
            const { data: assignedWallets } = await supabase
              .from('zk_user_wallets')
              .select('intermediate_wallet')
              .not('intermediate_wallet', 'is', null);
            
            const assignedWalletSet = new Set((assignedWallets || []).map((w: any) => w.intermediate_wallet));
            
            let foundWallet = null;
            let attempts = 0;
            const maxAttempts = 100;
            
            while (attempts < maxAttempts && !foundWallet) {
              const candidate = await intermediatePool.getAvailableWallet();
              if (!assignedWalletSet.has(candidate.publicKey)) {
                foundWallet = candidate;
                break;
              }
              attempts++;
            }
            
            if (!foundWallet) {
              const allWallets = intermediatePool.getAllWallets();
              if (allWallets.length > 0) {
                foundWallet = allWallets[0];
                console.log(`  ⚠️ Reusing wallet ${foundWallet.publicKey}`);
              }
            }
            
            if (!foundWallet) {
              results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No intermediate wallets' });
              continue;
            }
            
            intermediateWallet = foundWallet.publicKey;
            
            const { error: insertError } = await supabase
              .from('zk_user_wallets')
              .insert({
                user_wallet: userWallet,
                intermediate_wallet: intermediateWallet,
                token: token,
              });
            
            if (insertError) {
              const { data: existingMapping } = await supabase
                .from('zk_user_wallets')
                .select('intermediate_wallet')
                .eq('user_wallet', userWallet)
                .maybeSingle();
              
              if (existingMapping?.intermediate_wallet) {
                intermediateWallet = existingMapping.intermediate_wallet;
              } else {
                results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Failed to assign intermediate wallet' });
                continue;
              }
            } else {
              console.log(`  ✅ Assigned intermediate wallet: ${intermediateWallet.substring(0, 8)}...`);
            }
          } catch (poolError: any) {
            console.error(`  ❌ Error creating intermediate wallet:`, poolError.message);
            results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Failed to create intermediate wallet' });
            continue;
          }
        } else {
          intermediateWallet = walletMapping.intermediate_wallet;
        }

        const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;

        // Get mixer wallet
        const mixerAddress = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;
        const mixerPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY;

        if (!mixerAddress || !mixerPrivateKey) {
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Mixer not configured' });
          continue;
        }

        // Load mixer keypair
        let mixerKeypair: Keypair;
        try {
          const privateKeyArray = JSON.parse(mixerPrivateKey);
          mixerKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        } catch {
          const bs58Module = await import('bs58');
          const bs58 = bs58Module.default || bs58Module;
          mixerKeypair = Keypair.fromSecretKey(bs58.decode(mixerPrivateKey));
        }

        const mixerPubkey = new PublicKey(mixerAddress);
        const mixerTokenAccount = await getAssociatedTokenAddress(tokenMint, mixerPubkey);
        const intermediatePubkey = new PublicKey(intermediateWallet);
        const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);

        // Check if funds are already in intermediate wallet
        let intermediateBalance = 0;
        try {
          const intAccount = await getAccount(connection, intermediateTokenAccount);
          intermediateBalance = Number(intAccount.amount) / 1_000_000;
        } catch {
          // ATA doesn't exist yet
        }

        const splitAmount = parseFloat(exchange.split_amount);
        
        // If intermediate already has funds >= 80% of split, skip mixer transfer
        if (intermediateBalance >= splitAmount * 0.8) {
          console.log(`  💰 Funds already in intermediate: ${intermediateBalance.toFixed(6)} ${token}`);
        } else {
          // Check mixer balance
          let mixerBalance: number;
          try {
            const mixerAccount = await getAccount(connection, mixerTokenAccount);
            mixerBalance = Number(mixerAccount.amount) / 1_000_000;
            console.log(`  💰 Mixer balance: ${mixerBalance}`);
          } catch {
            console.log(`  ⚠️ No funds in mixer yet`);
            results.push({ exchangeId: exchange.exchange_id, status: 'waiting_for_funds' });
            continue;
          }

          if (mixerBalance < 0.5) {
            console.log(`  ⚠️ Balance too low: ${mixerBalance}`);
            results.push({ exchangeId: exchange.exchange_id, status: 'waiting_for_funds', balance: mixerBalance });
            continue;
          }

          // Transfer from mixer to intermediate
          const transferAmount = Math.min(mixerBalance - 0.001, splitAmount * 1.1);
          const transferLamports = Math.floor(transferAmount * 1_000_000);

          console.log(`  📤 Transferring ${transferAmount.toFixed(6)} ${token}`);

          let needsCreateATA = false;
          try {
            await getAccount(connection, intermediateTokenAccount);
          } catch {
            needsCreateATA = true;
          }

          const { blockhash } = await connection.getLatestBlockhash();
          const tx = new Transaction();
          tx.recentBlockhash = blockhash;
          tx.feePayer = mixerPubkey;

          if (needsCreateATA) {
            tx.add(createAssociatedTokenAccountInstruction(
              mixerPubkey, intermediateTokenAccount, intermediatePubkey, tokenMint
            ));
          }

          tx.add(createTransferInstruction(
            mixerTokenAccount, intermediateTokenAccount, mixerPubkey, BigInt(transferLamports)
          ));

          tx.sign(mixerKeypair);
          const sig1 = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
          console.log(`  📤 Mixer → Intermediate: ${sig1}`);
          
          // Poll for confirmation
          let confirmed1 = false;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const status = await connection.getSignatureStatus(sig1);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
              confirmed1 = true;
              break;
            }
            if (status.value?.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }
          }
          if (!confirmed1) {
            throw new Error(`Transaction ${sig1} not confirmed after 60 seconds`);
          }
        }

        // Smart contract deposit: Intermediate → Pool
        const walletPool = getPrivacyUsdWalletPool();
        await walletPool.initialize();

        const intWalletData = await walletPool.getWalletByPublicKey(intermediateWallet);
        if (!intWalletData) {
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No keypair' });
          continue;
        }
        const intKeypair = Keypair.fromSecretKey(Uint8Array.from(intWalletData.privateKey));

        // Get intermediate balance
        const intAccount = await getAccount(connection, intermediateTokenAccount);
        const intBalance = Number(intAccount.amount);
        const intBalanceBigInt = BigInt(intBalance);

        // Derive PDAs
        const poolPDA = await derivePoolPDA(tokenMint.toBase58());
        const userBalancePDA = await deriveUserBalancePDA(intermediateWallet, tokenMint.toBase58());
        const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);

        console.log(`  🔐 Smart contract deposit: Intermediate → Pool`);
        console.log(`     Amount: ${(intBalance / 1_000_000).toFixed(6)} ${token}`);

        // Build smart contract deposit transaction
        const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
        const tx2 = new Transaction();
        tx2.recentBlockhash = blockhash2;
        tx2.feePayer = mixerPubkey; // Mixer pays the fee

        // Check if pool token account exists
        let needsPoolATA = false;
        try {
          await getAccount(connection, poolTokenAccount);
        } catch {
          needsPoolATA = true;
        }

        if (needsPoolATA) {
          tx2.add(createAssociatedTokenAccountInstruction(
            mixerPubkey, poolTokenAccount, poolPDA, tokenMint
          ));
        }

        // Add deposit instruction
        const depositIx = buildDepositInstruction({
          user: intermediatePubkey,
          userBalance: userBalancePDA,
          pool: poolPDA,
          tokenMint: tokenMint,
          userTokenAccount: intermediateTokenAccount,
          poolTokenAccount: poolTokenAccount,
          amountLamports: intBalanceBigInt,
        });
        tx2.add(new TransactionInstruction(depositIx));

        tx2.sign(mixerKeypair, intKeypair);
        
        const sig2 = await connection.sendRawTransaction(tx2.serialize(), { skipPreflight: false, maxRetries: 3 });
        console.log(`  📤 Intermediate → Pool: ${sig2}`);
        
        // Poll for confirmation
        let confirmed2 = false;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const status = await connection.getSignatureStatus(sig2);
          if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
            confirmed2 = true;
            break;
          }
          if (status.value?.err) {
            throw new Error(`Deposit failed: ${JSON.stringify(status.value.err)}`);
          }
        }
        if (!confirmed2) {
          throw new Error(`Transaction ${sig2} not confirmed after 60 seconds`);
        }

        console.log(`  ✅ Smart contract deposit confirmed!`);

        // Calculate amounts
        const finalAmount = intBalance / 1_000_000;
        const FEE_PERCENTAGE = 10.0;
        const feeAmount = finalAmount * (FEE_PERCENTAGE / 100);
        const amountReceived = finalAmount - feeAmount;

        // Record deposit in zk_transactions
        try {
          const { error: insertError } = await supabase.from('zk_transactions').insert({
            sender_wallet: userWallet,
            recipient_wallet: userWallet,
            amount: finalAmount,
            fee_percentage: FEE_PERCENTAGE,
            token_symbol: token,
            tx_hash: sig2,
            status: 'completed',
            privacy_level: 'full',
            transaction_type: 'deposit',
          });
          if (insertError) {
            console.warn(`⚠️ Full insert failed (${insertError.message}), trying minimal...`);
            await supabase.from('zk_transactions').insert({
              sender_wallet: userWallet,
              recipient_wallet: userWallet,
              amount: finalAmount,
              token_symbol: token,
              tx_hash: sig2,
              status: 'completed',
              privacy_level: 'full',
            });
          }
        } catch (logError: any) {
          console.error('❌ Error logging deposit:', logError);
        }

        console.log(`  ✅ Recorded: $${amountReceived.toFixed(2)} ${token}`);

        // Mark exchange as processed
        await supabase.from('zk_exchanges')
          .update({ status: 'finished', user_wallet: userWallet, deposit_processed: true })
          .eq('id', exchange.id);

        processedCount++;
        results.push({ exchangeId: exchange.exchange_id, status: 'processed', amount: amountReceived });

      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({ exchangeId: exchange.exchange_id, status: 'error', error: error.message });
      }
    }

    console.log(`\n✅ Done: ${processedCount} processed, ${updatedCount} updated`);

    return res.status(200).json({
      success: true,
      processed: processedCount,
      updated: updatedCount,
      results
    });

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({ error: 'Failed', message: error.message });
  }
}
