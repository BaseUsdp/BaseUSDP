/**
 * Script to create Token-2022 mint with confidential transfers
 * This uses the Solana Web3.js library instead of CLI
 * 
 * Run with: tsx src/scripts/createMint.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';

dotenv.config();

// Token-2022 Program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function createToken2022Mint() {
  console.log('🚀 Creating Token-2022 mint with confidential transfers...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Get payer from environment or use default
  const payerKeypairPath = process.env.SOLANA_KEYPAIR_PATH || '~/.config/solana/id.json';
  const fs = await import('fs');
  const path = await import('path');
  const homedir = await import('os');
  
  const expandedPath = payerKeypairPath.replace('~', homedir.default.homedir());
  const keypairData = JSON.parse(fs.default.readFileSync(expandedPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Payer:', payer.publicKey.toString());
  console.log('Network:', RPC_URL);
  console.log('');

  try {
    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.01 * 1e9) {
      console.log('⚠️  Low balance. Airdropping...');
      const signature = await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
      await connection.confirmTransaction(signature);
      console.log('✅ Airdrop received\n');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log('Mint Keypair:', mintKeypair.publicKey.toString());
    console.log('');

    // Get rent exemption
    const rentExempt = await getMinimumBalanceForRentExemptMint(connection);
    console.log(`Rent exemption: ${rentExempt / 1e9} SOL`);
    console.log('');

    // Note: Token-2022 with confidential transfers requires specific extension setup
    // This is a simplified version - full implementation would need to:
    // 1. Create mint account with extensions
    // 2. Initialize confidential transfer extension
    // 3. Set approval policy
    
    console.log('⚠️  Note: Full Token-2022 confidential transfer setup requires:');
    console.log('   1. Creating mint with extension space');
    console.log('   2. Initializing confidential transfer extension');
    console.log('   3. Setting approval policy');
    console.log('');
    console.log('   For now, use the CLI command:');
    console.log('   spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \\');
    console.log('     create-token --enable-confidential-transfers auto');
    console.log('');
    console.log('   Or fix OpenSSL and run the script:');
    console.log('   ./packages/void402-solana/scripts/create-token-2022-mint.sh devnet');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createToken2022Mint()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { createToken2022Mint };

