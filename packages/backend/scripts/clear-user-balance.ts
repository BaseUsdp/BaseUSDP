/**
 * Clear User Balance Script
 * Removes all user wallet mappings and transaction history from database
 * This allows you to start fresh with new intermediate wallets
 * 
 * Usage:
 *   npm run clear-user-balance [wallet_address]
 * 
 * WARNING: This will delete all your deposits, balances, and transaction history!
 */

import dotenv from 'dotenv';
import { getDatabaseService } from '../src/services/databaseService.js';

// Load environment variables
dotenv.config({ path: '.env.vercel' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });
dotenv.config();

const userWallet = process.argv[2];

if (!userWallet) {
  console.error('❌ ERROR: Wallet address required');
  console.error('   Usage: npm run clear-user-balance <wallet_address>');
  console.error('   Example: npm run clear-user-balance BkQiVanfqtvyieDEJQxgxFNEzHftAHoBUr4nagro8Dqf');
  process.exit(1);
}

async function clearUserBalance() {
  console.log('🗑️  Clearing User Balance and Transaction History\n');
  console.log(`User wallet: ${userWallet}\n`);

  const dbService = getDatabaseService();

  if (!dbService.isAvailable()) {
    console.error('❌ ERROR: Database not available');
    console.error('   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will delete:');
  console.log('   - All user wallet mappings (intermediate wallets)');
  console.log('   - All transaction history');
  console.log('   - All payment requests');
  console.log('   - All used proofs');
  console.log('\n   Your on-chain balances in the ZK pool will remain, but');
  console.log('   you won\'t be able to access them without the User Balance PDA mapping.\n');

  try {
    // Access supabase client directly (we need to add a getter or use a workaround)
    // For now, we'll use a direct Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ ERROR: Supabase credentials not found');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete user wallet mappings
    console.log('📝 Deleting user wallet mappings...');
    const { error: walletError } = await supabase
      .from('user_wallets')
      .delete()
      .eq('user_wallet', userWallet);
    
    if (walletError) {
      console.error('❌ Error deleting wallet mappings:', walletError);
    } else {
      console.log('   ✅ User wallet mappings deleted');
    }

    // Delete transaction history
    console.log('📝 Deleting transaction history...');
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_wallet', userWallet);
    
    if (txError) {
      console.error('❌ Error deleting transactions:', txError);
    } else {
      console.log('   ✅ Transaction history deleted');
    }

    // Delete payment requests
    console.log('📝 Deleting payment requests...');
    const { error: paymentError } = await supabase
      .from('payment_requests')
      .delete()
      .eq('user_wallet', userWallet);
    
    if (paymentError) {
      console.error('❌ Error deleting payment requests:', paymentError);
    } else {
      console.log('   ✅ Payment requests deleted');
    }

    // Delete used proofs
    console.log('📝 Deleting used proofs...');
    const { error: proofError } = await supabase
      .from('used_proofs')
      .delete()
      .eq('user_wallet', userWallet);
    
    if (proofError) {
      console.error('❌ Error deleting used proofs:', proofError);
    } else {
      console.log('   ✅ Used proofs deleted');
    }

    console.log('\n✅ User balance cleared successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Make a new deposit to get a new intermediate wallet');
    console.log('   2. Your balance will start fresh at $0');
    console.log('   3. New deposits will use the new 5-wallet pool\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run script
clearUserBalance().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
