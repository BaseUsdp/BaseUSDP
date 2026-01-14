/**
 * Simple Token-2022 Mint Creation
 * Creates a basic mint - confidential extension setup may need CLI
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
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

const RPC_URL = 'https://api.devnet.solana.com';

async function createMint() {
  console.log('🚀 Creating Token-2022 mint...\n');

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

  // Create mint
  const mintKeypair = Keypair.generate();
  const rentExempt = await getMinimumBalanceForRentExemptMint(connection);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: rentExempt,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      9,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log('Sending transaction...');
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair]
  );

  console.log('\n✅ Mint created!');
  console.log('Mint:', mintKeypair.publicKey.toString());
  console.log('Signature:', signature);
  console.log('\n💾 Add to .env:');
  console.log(`TOKEN_2022_MINT_ADDRESS=${mintKeypair.publicKey.toString()}`);

  // Save
  fs.writeFileSync('.mint_address.txt', mintKeypair.publicKey.toString());
  
  return mintKeypair.publicKey;
}

createMint().catch(console.error);

