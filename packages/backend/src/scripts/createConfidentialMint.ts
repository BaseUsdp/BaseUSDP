/**
 * Create Token-2022 Mint with Confidential Transfers
 * Uses @solana-program/token-2022 library
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as token2022 from '@solana-program/token-2022';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

const RPC_URL = 'https://api.devnet.solana.com';

async function createConfidentialMint() {
  console.log('🚀 Creating Token-2022 mint with confidential transfers...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Payer:', payer.publicKey.toString());

  // Check balance
  let balance = await connection.getBalance(payer.publicKey);
  if (balance < 0.01 * 1e9) {
    console.log('Airdropping...');
    const sig = await connection.requestAirdrop(payer.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    balance = await connection.getBalance(payer.publicKey);
  }
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  // Create mint keypair
  const mintKeypair = Keypair.generate();
  console.log('Mint Keypair:', mintKeypair.publicKey.toString());
  console.log('');

  try {
    // Get mint size with confidential transfer extension
    // Use the correct extension format
    const extensions = [{
      extension: token2022.ExtensionType.ConfidentialTransferMint,
      config: {
        authority: payer.publicKey,
        autoApproveNewAccounts: true,
        auditorElgamalPubkey: null,
      }
    }];
    
    const mintSize = token2022.getMintSize(extensions);
    const rentExempt = await connection.getMinimumBalanceForRentExemption(mintSize);

    console.log(`Mint size with extension: ${mintSize} bytes`);
    console.log(`Rent exemption: ${rentExempt / 1e9} SOL\n`);

    // Get pre-initialization instructions (before initializeMint)
    const preInitInstructions = token2022.getPreInitializeInstructionsForMintExtensions(
      mintKeypair.publicKey,
      extensions
    );

    // Get post-initialization instructions (after initializeMint)
    const postInitInstructions = token2022.getPostInitializeInstructionsForMintExtensions(
      mintKeypair.publicKey,
      payer,
      extensions
    );

    console.log('📝 Initialization instructions:', initInstructions.length);
    console.log('');

    // Build transaction
    const transaction = new Transaction().add(
      // Create account
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintSize,
        lamports: rentExempt,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // Pre-initialization instructions (for extensions)
      ...preInitInstructions,
      // Initialize mint
      token2022.getInitializeMint2Instruction({
        mint: mintKeypair.publicKey,
        decimals: 9,
        mintAuthority: payer.publicKey,
        freezeAuthority: null,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // Post-initialization instructions (for extensions)
      ...postInitInstructions
    );

    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('\n✅ Mint created with confidential transfers!');
    console.log('Mint:', mintKeypair.publicKey.toString());
    console.log('Signature:', signature);
    console.log('\n💾 Add to .env:');
    console.log(`TOKEN_2022_MINT_ADDRESS=${mintKeypair.publicKey.toString()}`);

    // Save
    fs.writeFileSync('.mint_address.txt', mintKeypair.publicKey.toString());
    console.log('\n✅ Mint address saved to .mint_address.txt');

    return mintKeypair.publicKey;

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    throw error;
  }
}

createConfidentialMint()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

