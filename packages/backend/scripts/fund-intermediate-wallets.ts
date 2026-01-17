/**
 * Fund Intermediate Wallets Script
 * Funds all intermediate wallets with SOL from a specified funding wallet
 * 
 * Usage:
 *   npm run fund-intermediate-wallets
 * 
 * Environment Variables:
 *   FUNDING_WALLET_PRIVATE_KEY - Private key of wallet to fund from (JSON array or base58)
 *   SOL_AMOUNT_PER_WALLET - Amount of SOL to send to each wallet (default: 0.02)
 *   SOLANA_RPC_URL - Solana RPC endpoint (default: mainnet)
 */

import { Connection, Keypair, PublicKey, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const SOL_AMOUNT_PER_WALLET = parseFloat(process.env.SOL_AMOUNT_PER_WALLET || '0.02');
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface IntermediateWallet {
  publicKey: string;
  privateKey: number[];
}

async function fundIntermediateWallets() {
  console.log('🚀 Funding Intermediate Wallets\n');
  console.log(`Amount per wallet: ${SOL_AMOUNT_PER_WALLET} SOL`);
  console.log(`RPC URL: ${RPC_URL}\n`);

  // Load funding wallet (use MAIN_WALLET_PRIVATE_KEY if FUNDING_WALLET_PRIVATE_KEY not set)
  const fundingPrivateKey = process.env.FUNDING_WALLET_PRIVATE_KEY || process.env.MAIN_WALLET_PRIVATE_KEY;
  if (!fundingPrivateKey) {
    console.error('❌ ERROR: No funding wallet found');
    console.error('   Set FUNDING_WALLET_PRIVATE_KEY or MAIN_WALLET_PRIVATE_KEY environment variable');
    console.error('   Format: JSON array [1,2,3,...] or base58 string');
    console.error('\n   You can set it in:');
    console.error('   - .env file in packages/backend/');
    console.error('   - Environment variable before running the script');
    console.error('   - Vercel environment variables (if deploying)');
    process.exit(1);
  }

  const usingMainWallet = !process.env.FUNDING_WALLET_PRIVATE_KEY && process.env.MAIN_WALLET_PRIVATE_KEY;
  if (usingMainWallet) {
    console.log('ℹ️  Using MAIN_WALLET_PRIVATE_KEY for funding\n');
  } else {
    console.log('ℹ️  Using FUNDING_WALLET_PRIVATE_KEY for funding\n');
  }

  let fundingKeypair: Keypair;
  try {
    const keyArray = JSON.parse(fundingPrivateKey);
    if (Array.isArray(keyArray)) {
      fundingKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } else {
      fundingKeypair = Keypair.fromSecretKey(bs58.decode(fundingPrivateKey));
    }
  } catch {
    fundingKeypair = Keypair.fromSecretKey(bs58.decode(fundingPrivateKey));
  }

  console.log(`Funding wallet: ${fundingKeypair.publicKey.toString()}\n`);

  // Load intermediate wallets
  const walletsPath = path.join(process.cwd(), 'intermediate-wallets.json');
  if (!fs.existsSync(walletsPath)) {
    console.error(`❌ ERROR: ${walletsPath} not found`);
    console.error('   Run: npm run generate-intermediate-wallets first');
    process.exit(1);
  }

  const walletsData = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
  const wallets: IntermediateWallet[] = walletsData.wallets || [];

  if (wallets.length === 0) {
    console.error('❌ ERROR: No intermediate wallets found');
    process.exit(1);
  }

  console.log(`Found ${wallets.length} intermediate wallets\n`);

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');

  // Check funding wallet balance
  const fundingBalance = await connection.getBalance(fundingKeypair.publicKey);
  const totalNeeded = SOL_AMOUNT_PER_WALLET * wallets.length * 1e9; // Convert to lamports
  const estimatedFees = wallets.length * 5000; // ~0.000005 SOL per transaction
  const totalRequired = totalNeeded + estimatedFees;

  console.log(`Funding wallet balance: ${(fundingBalance / 1e9).toFixed(6)} SOL`);
  console.log(`Total needed: ${(totalNeeded / 1e9).toFixed(6)} SOL`);
  console.log(`Estimated fees: ${(estimatedFees / 1e9).toFixed(6)} SOL`);
  console.log(`Total required: ${(totalRequired / 1e9).toFixed(6)} SOL\n`);

  if (fundingBalance < totalRequired) {
    console.error(`❌ ERROR: Insufficient balance`);
    console.error(`   Need: ${(totalRequired / 1e9).toFixed(6)} SOL`);
    console.error(`   Have: ${(fundingBalance / 1e9).toFixed(6)} SOL`);
    console.error(`   Shortfall: ${((totalRequired - fundingBalance) / 1e9).toFixed(6)} SOL`);
    process.exit(1);
  }

  // Check current balances and fund wallets
  let fundedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const walletPubkey = new PublicKey(wallet.publicKey);
    
    try {
      const currentBalance = await connection.getBalance(walletPubkey);
      const currentBalanceSOL = currentBalance / 1e9;
      const targetBalance = SOL_AMOUNT_PER_WALLET;

      if (currentBalanceSOL >= targetBalance) {
        console.log(`[${i + 1}/${wallets.length}] ✅ ${walletPubkey.toString().slice(0, 8)}... - Already funded (${currentBalanceSOL.toFixed(6)} SOL)`);
        skippedCount++;
        continue;
      }

      const amountToSend = (targetBalance - currentBalanceSOL) * 1e9;
      
      console.log(`[${i + 1}/${wallets.length}] 💰 Funding ${walletPubkey.toString().slice(0, 8)}... (${currentBalanceSOL.toFixed(6)} → ${targetBalance.toFixed(6)} SOL)`);

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: fundingKeypair.publicKey,
          recentBlockhash: blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: fundingKeypair.publicKey,
              toPubkey: walletPubkey,
              lamports: Math.floor(amountToSend),
            }),
          ],
        }).compileToLegacyMessage()
      );

      tx.sign([fundingKeypair]);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`   ✅ Funded! Signature: ${signature}\n`);
      fundedCount++;

      // Small delay to avoid rate limiting
      if (i < wallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total wallets: ${wallets.length}`);
  console.log(`   Funded: ${fundedCount}`);
  console.log(`   Already funded: ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total SOL sent: ${(fundedCount * SOL_AMOUNT_PER_WALLET).toFixed(6)} SOL\n`);

  if (errorCount > 0) {
    console.error('⚠️  Some wallets failed to fund. Check errors above.');
    process.exit(1);
  }

  console.log('✅ All wallets funded successfully!');
}

// Run script
fundIntermediateWallets().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
