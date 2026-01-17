/**
 * Generate Intermediate Wallets for ZK Proof Privacy
 * 
 * This script generates a pool of intermediate wallets that will be used
 * to break the direct link between user deposits and recipient transfers.
 * 
 * Usage: tsx scripts/generate-intermediate-wallets.ts [count]
 * Default: 50 wallets
 */

import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const walletCount = process.argv[2] ? parseInt(process.argv[2], 10) : 50;

if (isNaN(walletCount) || walletCount < 1) {
  console.error('Invalid wallet count. Please provide a positive number.');
  process.exit(1);
}

console.log(`Generating ${walletCount} intermediate wallets...`);

const wallets = [];

for (let i = 0; i < walletCount; i++) {
  const keypair = Keypair.generate();
  wallets.push({
    index: i,
    publicKey: keypair.publicKey.toBase58(),
    privateKey: Array.from(keypair.secretKey),
  });
  
  if ((i + 1) % 10 === 0) {
    console.log(`Generated ${i + 1}/${walletCount} wallets...`);
  }
}

const output = {
  count: walletCount,
  wallets: wallets,
  generatedAt: new Date().toISOString(),
};

// Save to file
const outputPath = path.join(process.cwd(), 'intermediate-wallets.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\n✅ Generated ${walletCount} intermediate wallets!`);
console.log(`📁 Saved to: ${outputPath}`);
console.log(`\n⚠️  IMPORTANT: Keep this file secure!`);
console.log(`   Add the wallets array to your .env file as INTERMEDIATE_WALLETS`);
console.log(`   Example: INTERMEDIATE_WALLETS='${JSON.stringify(wallets)}'`);
console.log(`\n💰 Next steps:`);
console.log(`   1. Fund each wallet with ~0.01 SOL for transaction fees`);
console.log(`   2. Add INTERMEDIATE_WALLETS to your .env file`);
console.log(`   3. Never commit this file to git!`);
