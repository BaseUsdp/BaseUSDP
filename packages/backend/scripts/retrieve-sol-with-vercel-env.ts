/**
 * Retrieve SOL using Vercel env vars
 */
import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load .env.vercel
dotenv.config({ path: '.env.vercel' });

const intermediateWallets = process.env.INTERMEDIATE_WALLETS;

if (!intermediateWallets) {
  console.error('❌ INTERMEDIATE_WALLETS not found in .env.vercel');
  process.exit(1);
}

console.log('✅ Found INTERMEDIATE_WALLETS in .env.vercel');
const wallets = JSON.parse(intermediateWallets);
console.log(`📦 Found ${wallets.length || wallets.wallets?.length || 0} wallets\n`);

// Set env var and run the retrieval script
process.env.INTERMEDIATE_WALLETS = intermediateWallets;

// Import and run the retrieval function
import('./retrieve-sol-from-intermediate-wallets.ts').catch(() => {
  // If import fails, exec the script
  execSync('tsx scripts/retrieve-sol-from-intermediate-wallets.ts', {
    stdio: 'inherit',
    env: { ...process.env, INTERMEDIATE_WALLETS: intermediateWallets }
  });
});
