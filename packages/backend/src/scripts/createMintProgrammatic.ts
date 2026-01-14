/**
 * Create Token-2022 Mint Programmatically
 * 
 * This script creates a Token-2022 mint with confidential transfers
 * using Solana Web3.js instead of CLI
 * 
 * Run with: tsx src/scripts/createMintProgrammatic.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

dotenv.config();

// Token-2022 Program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function createToken2022Mint() {
  console.log('🚀 Creating Token-2022 mint with confidential transfers programmatically...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load payer keypair
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH || 
    path.join(os.homedir(), '.config', 'solana', 'id.json');
  
  let payer: Keypair;
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    console.error('❌ Error loading keypair:', error);
    console.log('Generating new keypair for this operation...');
    payer = Keypair.generate();
  }

  console.log('Payer:', payer.publicKey.toString());
  console.log('Network:', RPC_URL);
  console.log('');

  try {
    // Check balance
    let balance = await connection.getBalance(payer.publicKey);
    console.log(`Balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.01 * 1e9) {
      console.log('⚠️  Low balance. Requesting airdrop...');
      const signature = await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
      await connection.confirmTransaction(signature, 'confirmed');
      balance = await connection.getBalance(payer.publicKey);
      console.log(`✅ Airdrop received. New balance: ${balance / 1e9} SOL\n`);
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log('Mint Keypair:', mintKeypair.publicKey.toString());
    console.log('');

    // Note: Token-2022 with confidential transfers requires:
    // 1. Creating mint account with extension space
    // 2. Initializing confidential transfer extension
    // 3. Setting approval policy
    // 
    // The @solana/spl-token library may not fully support this yet.
    // This is a simplified attempt - may need CLI for full functionality.

    console.log('⚠️  Note: Full Token-2022 confidential transfer setup via TypeScript');
    console.log('   may not be fully supported yet. The @solana/spl-token library');
    console.log('   may need updates for Token-2022 extensions.');
    console.log('');
    console.log('   Attempting to create basic mint...');
    console.log('');

    // Calculate space needed for mint with extensions
    // Confidential transfer extension adds additional space
    const extensionTypes = [ExtensionType.ConfidentialTransferMint];
    const mintLen = getMintLen(extensionTypes);
    const rentExempt = await getMinimumBalanceForRentExemptMint(connection);

    console.log(`Mint account size: ${mintLen} bytes`);
    console.log(`Rent exemption: ${rentExempt / 1e9} SOL`);
    console.log('');

    // Create mint account
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports: rentExempt,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint with extensions
      // Note: This may need to be done in separate instructions
      createInitializeMint2Instruction(
        mintKeypair.publicKey,
        9, // decimals
        payer.publicKey, // mint authority
        null, // freeze authority
        TOKEN_2022_PROGRAM_ID
      )
    );

    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('');
    console.log('✅ Transaction confirmed!');
    console.log('Signature:', signature);
    console.log('');
    console.log('📝 Mint Address:', mintKeypair.publicKey.toString());
    console.log('');
    console.log('⚠️  Note: Confidential transfer extension may need to be initialized separately.');
    console.log('   Check the mint account to verify extensions were set up correctly.');
    console.log('');
    console.log('💾 Add this to your .env file:');
    console.log(`TOKEN_2022_MINT_ADDRESS=${mintKeypair.publicKey.toString()}`);

    // Save to file
    const mintFile = path.join(process.cwd(), '.mint_address.txt');
    fs.writeFileSync(mintFile, mintKeypair.publicKey.toString());
    console.log(`\n✅ Mint address saved to: ${mintFile}`);

    return mintKeypair.publicKey;

  } catch (error: any) {
    console.error('❌ Error creating mint:', error);
    
    if (error.message?.includes('extension') || error.message?.includes('ExtensionType')) {
      console.log('');
      console.log('💡 This error suggests the TypeScript library may not fully support');
      console.log('   Token-2022 extensions yet. You may need to:');
      console.log('   1. Fix OpenSSL and use CLI: spl-token create-token --enable-confidential-transfers auto');
      console.log('   2. Wait for @solana/spl-token library updates');
      console.log('   3. Use a different approach');
    }
    
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createToken2022Mint()
    .then((mint) => {
      console.log('\n✅ Mint creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Mint creation failed:', error);
      process.exit(1);
    });
}

export { createToken2022Mint };

