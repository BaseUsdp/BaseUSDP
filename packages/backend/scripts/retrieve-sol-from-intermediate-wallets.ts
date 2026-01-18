/**
 * Retrieve SOL from Intermediate Wallets Script
 * Retrieves all SOL from intermediate wallets back to the main wallet
 * 
 * Usage:
 *   npm run retrieve-sol-from-intermediate-wallets
 * 
 * Environment Variables:
 *   MAIN_WALLET_PRIVATE_KEY - Private key of wallet to receive SOL (JSON array or base58)
 *   SOLANA_RPC_URL - Solana RPC endpoint (default: mainnet)
 *   MIN_SOL_TO_KEEP - Minimum SOL to keep in each wallet (default: 0.0001 for rent exemption)
 */

import { Connection, Keypair, PublicKey, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables from .env file (try multiple sources)
// Try .env.vercel first (from Vercel CLI)
try {
  dotenv.config({ path: '.env.vercel' });
} catch {}
// Try .env.local (most common for local development)
try {
  dotenv.config({ path: '.env.local' });
} catch {}
// Then try .env.production
try {
  dotenv.config({ path: '.env.production' });
} catch {}
// Finally try .env
dotenv.config(); // .env.vercel takes precedence, then .env.local, then .env.production, then .env

const MIN_SOL_TO_KEEP = parseFloat(process.env.MIN_SOL_TO_KEEP || '0.0001'); // Keep minimum for rent exemption
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface IntermediateWallet {
  publicKey: string;
  privateKey: number[];
}

async function retrieveSOLFromIntermediateWallets() {
  console.log('💰 Retrieving SOL from Intermediate Wallets\n');
  console.log(`Minimum SOL to keep per wallet: ${MIN_SOL_TO_KEEP} SOL`);
  console.log(`RPC URL: ${RPC_URL}\n`);

  // Load main wallet (receiver)
  const mainPrivateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
  if (!mainPrivateKey) {
    console.error('❌ ERROR: MAIN_WALLET_PRIVATE_KEY not found');
    console.error('   Set MAIN_WALLET_PRIVATE_KEY environment variable');
    console.error('   Format: JSON array [1,2,3,...] or base58 string');
    process.exit(1);
  }

  let mainKeypair: Keypair;
  try {
    // First try as base58 string (most common format)
    mainKeypair = Keypair.fromSecretKey(bs58.decode(mainPrivateKey));
  } catch {
    // Fallback to JSON array format
    try {
      const keyArray = JSON.parse(mainPrivateKey);
      if (Array.isArray(keyArray)) {
        mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } else {
        throw new Error('Invalid format');
      }
    } catch (parseError) {
      console.error('❌ ERROR: Failed to parse MAIN_WALLET_PRIVATE_KEY');
      console.error('   Format must be: JSON array [1,2,3,...] or base58 string');
      process.exit(1);
    }
  }

  console.log(`Main wallet (receiver): ${mainKeypair.publicKey.toString()}\n`);

  // Load intermediate wallets from file OR environment variable
  let wallets: IntermediateWallet[] = [];
  
  // First try environment variable (for Vercel/old wallets)
  const envWallets = process.env.INTERMEDIATE_WALLETS;
  if (envWallets) {
    try {
      const parsed = JSON.parse(envWallets);
      if (Array.isArray(parsed)) {
        wallets = parsed;
        console.log(`📦 Loaded ${wallets.length} wallets from INTERMEDIATE_WALLETS environment variable\n`);
      } else if (parsed.wallets && Array.isArray(parsed.wallets)) {
        wallets = parsed.wallets;
        console.log(`📦 Loaded ${wallets.length} wallets from INTERMEDIATE_WALLETS environment variable\n`);
      }
    } catch (e) {
      console.warn('⚠️  Failed to parse INTERMEDIATE_WALLETS from env, trying file...');
    }
  }
  
  // Fallback to file if env var not available
  if (wallets.length === 0) {
    const walletsPath = path.join(process.cwd(), 'intermediate-wallets.json');
    if (!fs.existsSync(walletsPath)) {
      console.error(`❌ ERROR: ${walletsPath} not found and INTERMEDIATE_WALLETS not set`);
      console.error('   Either set INTERMEDIATE_WALLETS environment variable or run: npm run generate-intermediate-wallets');
      process.exit(1);
    }

    const walletsData = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
    wallets = walletsData.wallets || [];
    console.log(`📦 Loaded ${wallets.length} wallets from intermediate-wallets.json file\n`);
  }

  if (wallets.length === 0) {
    console.error('❌ ERROR: No intermediate wallets found');
    process.exit(1);
  }

  console.log(`Found ${wallets.length} intermediate wallets\n`);

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');

  // Check main wallet balance
  const mainBalance = await connection.getBalance(mainKeypair.publicKey);
  console.log(`Main wallet balance: ${(mainBalance / 1e9).toFixed(6)} SOL\n`);

  // Retrieve SOL from each wallet
  let retrievedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let totalRetrieved = 0;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(wallet.privateKey));
    const walletPubkey = walletKeypair.publicKey;
    
    try {
      const currentBalance = await connection.getBalance(walletPubkey);
      const currentBalanceSOL = currentBalance / 1e9;
      const minToKeepLamports = MIN_SOL_TO_KEEP * 1e9;
      const availableToRetrieve = currentBalance - minToKeepLamports - 5000; // Subtract fees

      if (availableToRetrieve <= 0) {
        console.log(`[${i + 1}/${wallets.length}] ⏭️  ${walletPubkey.toString().slice(0, 8)}... - Insufficient balance (${currentBalanceSOL.toFixed(6)} SOL, keeping ${MIN_SOL_TO_KEEP} SOL)`);
        skippedCount++;
        continue;
      }

      const amountToRetrieve = Math.floor(availableToRetrieve);
      const amountToRetrieveSOL = amountToRetrieve / 1e9;
      
      console.log(`[${i + 1}/${wallets.length}] 💰 Retrieving ${amountToRetrieveSOL.toFixed(6)} SOL from ${walletPubkey.toString().slice(0, 8)}...`);

      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: walletKeypair.publicKey,
          recentBlockhash: blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: walletPubkey,
              toPubkey: mainKeypair.publicKey,
              lamports: amountToRetrieve,
            }),
          ],
        }).compileToLegacyMessage()
      );

      tx.sign([walletKeypair]);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`   ✅ Retrieved! Signature: ${signature}\n`);
      retrievedCount++;
      totalRetrieved += amountToRetrieveSOL;

      // Small delay to avoid rate limiting
      if (i < wallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      errorCount++;
    }
  }

  // Check final main wallet balance
  const finalMainBalance = await connection.getBalance(mainKeypair.publicKey);
  const actualRetrieved = (finalMainBalance - mainBalance) / 1e9;

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total wallets: ${wallets.length}`);
  console.log(`   Retrieved from: ${retrievedCount}`);
  console.log(`   Skipped (insufficient): ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total SOL retrieved: ${totalRetrieved.toFixed(6)} SOL`);
  console.log(`   Actual increase in main wallet: ${actualRetrieved.toFixed(6)} SOL\n`);

  if (errorCount > 0) {
    console.error('⚠️  Some wallets failed to retrieve. Check errors above.');
    process.exit(1);
  }

  console.log('✅ SOL retrieval complete!');
}

// Run script
retrieveSOLFromIntermediateWallets().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
