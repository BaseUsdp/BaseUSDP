/**
 * Void402 Internal Transfer API (1:1 with Nolvipay)
 * POST /api/zk/transfer
 * 
 * Transfers funds between Void402 users internally (on-chain via Solana program)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { 
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { 
  derivePoolPDA, 
  deriveUserBalancePDA,
  deriveProofPDA,
  getSolanaConnection,
  VOID402_PROGRAM_ID,
  isValidSolanaAddress,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { createClient } from '@supabase/supabase-js';
import { getUSDPHolderTier, calculateFeePercentage } from '../lib/tier-service.js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import bs58 from 'bs58';
import { isBaseChain } from '../lib/chain-config.js';
import { isValidBaseAddress, getBaseSigner, getPrivacyPoolContract, getUsdcAddress, parseUsdc, getBaseProvider } from '../lib/void402-base.js';
import { generatePrivacyNonce, getProofId, generateMockProof } from '../lib/privacy-utils-base.js';
import { getBaseIntermediateWalletPool } from '../lib/intermediate-wallet-pool-base.js';
import { ethers as ethersLib } from 'ethers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for internal_transfer: [56, 217, 60, 137, 252, 221, 185, 114]
const INTERNAL_TRANSFER_DISCRIMINATOR = Buffer.from([56, 217, 60, 137, 252, 221, 185, 114]);

// Instruction discriminator for upload_proof: [57, 235, 171, 213, 237, 91, 79, 2]
const UPLOAD_PROOF_DISCRIMINATOR = Buffer.from([57, 235, 171, 213, 237, 91, 79, 2]);

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

function buildInternalTransferInstruction({
  relayer,
  proof,
  senderBalance,
  recipient,
  recipientBalance,
  systemProgram,
  relayerFee,
}: {
  relayer: PublicKey;
  proof: PublicKey;
  senderBalance: PublicKey;
  recipient: PublicKey;
  recipientBalance: PublicKey;
  systemProgram: PublicKey;
  relayerFee: number;
}) {
  const feeBuffer = Buffer.allocUnsafe(8);
  const feeBigInt = BigInt(relayerFee);
  for (let i = 0; i < 8; i++) {
    feeBuffer[i] = Number((feeBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  const instructionData = Buffer.concat([
    INTERNAL_TRANSFER_DISCRIMINATOR,
    feeBuffer,
  ]);

  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: relayer, isSigner: true, isWritable: true },
      { pubkey: proof, isSigner: false, isWritable: true },
      { pubkey: senderBalance, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: recipientBalance, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

function buildUploadProofInstruction({
  sender,
  proof,
  tokenMint,
  nonce,
  amount,
  proofBytes,
  commitmentBytes,
  blindingFactorBytes,
}: {
  sender: PublicKey;
  proof: PublicKey;
  tokenMint: PublicKey;
  nonce: number;
  amount: number;
  proofBytes: Buffer;
  commitmentBytes: Buffer;
  blindingFactorBytes: Buffer;
}) {
  const nonceBuffer = Buffer.allocUnsafe(8);
  const nonceBigInt = BigInt(nonce);
  for (let i = 0; i < 8; i++) {
    nonceBuffer[i] = Number((nonceBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  const amountBuffer = Buffer.allocUnsafe(8);
  const amountBigInt = BigInt(amount);
  for (let i = 0; i < 8; i++) {
    amountBuffer[i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  const proofLengthBuffer = Buffer.allocUnsafe(4);
  proofLengthBuffer.writeUInt32LE(proofBytes.length, 0);
  const commitmentLengthBuffer = Buffer.allocUnsafe(4);
  commitmentLengthBuffer.writeUInt32LE(commitmentBytes.length, 0);
  const blindingLengthBuffer = Buffer.allocUnsafe(4);
  blindingLengthBuffer.writeUInt32LE(blindingFactorBytes.length, 0);

  const instructionData = Buffer.concat([
    UPLOAD_PROOF_DISCRIMINATOR,
    nonceBuffer,
    amountBuffer,
    proofLengthBuffer,
    proofBytes,
    commitmentLengthBuffer,
    commitmentBytes,
    blindingLengthBuffer,
    blindingFactorBytes,
  ]);

  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: proof, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

// Relayer wallet - should be stored securely in environment variable
function getRelayerKeypair(): Keypair {
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error('RELAYER_PRIVATE_KEY environment variable not set');
  }
  
  try {
    const privateKeyArray = JSON.parse(relayerPrivateKey);
    return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch {
    // Try as base58 string
    return Keypair.fromSecretKey(bs58.decode(relayerPrivateKey));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const { 
      sender_wallet,
      recipient_wallet: recipient_wallet_input,
      recipient_username,
      amount,
      token,
      nonce,
      force_external,
    } = req.body;

    // =====================================================================
    // CRITICAL SECURITY: Require authentication and verify sender owns wallet
    // This prevents attackers from initiating transfers from other users' accounts
    // =====================================================================
    if (!sender_wallet) {
      return res.status(400).json({ error: 'sender_wallet is required' });
    }

    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      console.error(`❌ SECURITY: Transfer attempted without authentication for wallet ${sender_wallet?.slice(0,8)}...`);
      return res.status(401).json({ error: 'Authentication required. Please sign in with your wallet.' });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, sender_wallet);
    if (!tokenVerification.valid) {
      console.error(`❌ SECURITY: Invalid token for transfer from ${sender_wallet?.slice(0,8)}...: ${tokenVerification.error}`);
      return res.status(403).json({ error: 'Invalid authentication. Please reconnect your wallet.' });
    }

    console.log(`✅ Authenticated transfer request from ${sender_wallet.slice(0,8)}...`);

    // ================================================================
    // BASE CHAIN: Internal/external transfer via X402PrivacyPool contract
    // ================================================================
    if (isBaseChain()) {
      // Resolve recipient for Base chain
      let base_recipient_wallet = recipient_wallet_input;

      if (!base_recipient_wallet && recipient_username) {
        const cleanUsername = recipient_username.startsWith("@") ? recipient_username.substring(1) : recipient_username;
        const { data: userProfile, error: lookupError } = await supabase!
          .from("user_profiles")
          .select("wallet_address")
          .ilike("username", cleanUsername)
          .maybeSingle();

        if (lookupError || !userProfile) {
          return res.status(404).json({ error: `Username "${recipient_username}" not found` });
        }
        base_recipient_wallet = userProfile.wallet_address;
      }

      if (!base_recipient_wallet || !amount || !token) {
        return res.status(400).json({ error: 'All fields are required (sender_wallet, recipient_wallet or recipient_username, amount, token)' });
      }

      if (!['USDC', 'USDT'].includes(token)) {
        return res.status(400).json({ error: 'Token must be USDC or USDT' });
      }

      if (!isValidBaseAddress(sender_wallet)) {
        return res.status(400).json({ error: 'Invalid sender Base address' });
      }

      if (!isValidBaseAddress(base_recipient_wallet)) {
        return res.status(400).json({ error: 'Invalid recipient Base address' });
      }

      if (sender_wallet.toLowerCase() === base_recipient_wallet.toLowerCase()) {
        return res.status(400).json({ error: 'Self-transfers are not allowed' });
      }

      const transferAmount = parseFloat(amount);
      const usdcAddress = getUsdcAddress();
      const provider = getBaseProvider();

      // Look up sender's intermediate wallet (has pool balance)
      const { data: senderWalletData } = await supabase!
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', sender_wallet)
        .limit(1)
        .maybeSingle();

      if (!senderWalletData?.intermediate_wallet) {
        return res.status(400).json({ error: 'Sender has not deposited funds yet' });
      }

      const baseIntPool = getBaseIntermediateWalletPool();
      await baseIntPool.initialize();
      const intWalletData = baseIntPool.getWalletByAddress(senderWalletData.intermediate_wallet);
      if (!intWalletData) {
        return res.status(400).json({ error: 'Intermediate wallet not found in pool' });
      }

      const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);

      // Fund intermediate wallet with ETH for gas if needed
      const intEthBalance = await provider.getBalance(intWalletData.address);
      const ethNeeded = ethersLib.parseEther("0.002");
      if (intEthBalance < ethNeeded) {
        const collectionKey = process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE;
        if (collectionKey) {
          const funder = getBaseSigner(collectionKey);
          const fundTx = await funder.sendTransaction({ to: intWalletData.address, value: ethNeeded });
          await fundTx.wait();
          console.log(`[Base Transfer] Funded intermediate with ETH`);
        }
      }

      const privacyPoolContract = getPrivacyPoolContract(intSigner);

      // Generate nonce and proof
      const privacyNonce = generatePrivacyNonce(sender_wallet);
      const proofId = getProofId(privacyNonce);
      const amountInUnits = parseUsdc(transferAmount.toString());
      const { proofBytes, commitmentBytes, blindingFactorBytes } = generateMockProof(
        sender_wallet,
        amountInUnits,
        privacyNonce,
      );

      // STEP 1: Upload proof (using intermediate wallet which has pool balance)
      console.log(`[Base Transfer] Uploading proof for nonce ${privacyNonce}...`);
      const uploadTx = await privacyPoolContract.uploadProof(
        privacyNonce,
        amountInUnits,
        usdcAddress,
        proofBytes,
        commitmentBytes,
        blindingFactorBytes,
      );
      const uploadReceipt = await uploadTx.wait();
      console.log(`[Base Transfer] Proof uploaded: ${uploadReceipt.hash}`);

      // STEP 2: Internal transfer (fee-free for username-to-username)
      const relayerFee = 0n;
      console.log(`[Base Transfer] Executing internal transfer...`);
      const transferTx = await privacyPoolContract.internalTransfer(
        proofId,
        base_recipient_wallet,
        relayerFee,
      );
      const transferReceipt = await transferTx.wait();
      const signature = transferReceipt.hash;
      console.log(`[Base Transfer] Internal transfer complete: ${signature}`);

      // Log to database
      try {
        await supabase!.from('zk_transactions').insert({
          sender_wallet: sender_wallet,
          recipient_wallet: base_recipient_wallet,
          amount: transferAmount,
          fee_percentage: 0,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: 'transfer',
        });
      } catch (logErr: any) {
        console.warn(`Failed to log Base transfer:`, logErr.message);
      }

      console.log(`Base internal transfer: ${sender_wallet.slice(0, 8)}... -> ${base_recipient_wallet.slice(0, 8)}... | $${transferAmount} ${token} | tx: ${signature}`);

      return res.status(200).json({
        success: true,
        signature,
        amount: transferAmount,
        fee: 0,
        fee_percentage: 0,
      });
    }

    // ================================================================
    // SOLANA CHAIN: Existing Solana transfer logic below
    // ================================================================

    // Resolve recipient: either from wallet address or username
    let recipient_wallet = recipient_wallet_input;
    
    if (!recipient_wallet && recipient_username) {
      // Resolve username to wallet address server-side (privacy: frontend never sees the full address)
      const cleanUsername = recipient_username.startsWith("@") ? recipient_username.substring(1) : recipient_username;
      const { data: userProfile, error: lookupError } = await supabase
        .from("user_profiles")
        .select("wallet_address")
        .ilike("username", cleanUsername)
        .maybeSingle();
      
      if (lookupError || !userProfile) {
        return res.status(404).json({ error: `Username "${recipient_username}" not found` });
      }
      
      recipient_wallet = userProfile.wallet_address;
      console.log(`📋 Resolved username @${cleanUsername} to wallet ${recipient_wallet.slice(0, 8)}...`);
    }

    if (!sender_wallet || !recipient_wallet || !amount || !token || !nonce) {
      return res.status(400).json({ error: 'All fields are required (sender_wallet, recipient_wallet or recipient_username, amount, token, nonce)' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    // CRITICAL SECURITY: Prevent self-transfers
    if (sender_wallet.toLowerCase() === recipient_wallet.toLowerCase()) {
      console.error(`❌ SECURITY: User ${sender_wallet} attempted to transfer to themselves. Blocking self-transfer.`);
      return res.status(400).json({ 
        error: 'Self-transfers are not allowed',
        message: 'You cannot transfer funds to yourself. Please use a different recipient address.'
      });
    }

    // Check if recipient is a Void402 user (has intermediate wallet)
    let recipientMapping = null;
    let isExternalTransfer = false;

    // If force_external is set (user chose "Solana Address"), always treat as external
    if (force_external) {
      isExternalTransfer = true;
      console.log(`📤 Force external transfer (Solana Address mode) to: ${recipient_wallet.slice(0, 8)}...`);
    } else {
      try {
        const result = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet, user_wallet')
          .eq('user_wallet', recipient_wallet)
          .maybeSingle();
        
        recipientMapping = result.data;
      } catch (tableError: any) {
        console.warn('zk_user_wallets table check failed:', tableError.message);
      }
    }
    
    // If not found in zk_user_wallets (and not forced external), check if they have any transaction history
    if (!recipientMapping && !isExternalTransfer) {
      try {
        const { data: transactions } = await supabase
          .from('zk_transactions')
          .select('sender_wallet, recipient_wallet, status')
          .or(`sender_wallet.eq.${recipient_wallet},recipient_wallet.eq.${recipient_wallet}`)
          .in('status', ['confirmed', 'completed'])
          .limit(1);

        if (transactions && transactions.length > 0) {
          // Recipient has deposited but no intermediate wallet assigned — assign one
          console.warn(`⚠️ Recipient ${recipient_wallet} has deposited but no intermediate wallet. Assigning...`);
          
          const { data: senderMappingTemp } = await supabase
            .from('zk_user_wallets')
            .select('intermediate_wallet')
            .eq('user_wallet', sender_wallet)
            .eq('token', token)
            .maybeSingle();
          
          const { data: assignedWallets } = await supabase
            .from('zk_user_wallets')
            .select('intermediate_wallet')
            .eq('token', token);
          
          const excludedWallets = new Set<string>();
          if (senderMappingTemp?.intermediate_wallet) {
            excludedWallets.add(senderMappingTemp.intermediate_wallet.toLowerCase());
          }
          if (assignedWallets) {
            assignedWallets.forEach((w: any) => {
              if (w.intermediate_wallet) excludedWallets.add(w.intermediate_wallet.toLowerCase());
            });
          }
          
          const intermediatePool = getPrivacyUsdWalletPool();
          await intermediatePool.initialize();
          
          let availableWallet = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = await intermediatePool.getAvailableWallet();
            if (!excludedWallets.has(candidate.publicKey.toLowerCase())) {
              availableWallet = candidate;
              break;
            }
          }
          
          if (availableWallet) {
            const { data: newMapping } = await supabase
              .from('zk_user_wallets')
              .upsert({
                user_wallet: recipient_wallet,
                intermediate_wallet: availableWallet.publicKey,
                token: token,
              }, { onConflict: 'user_wallet,token' })
              .select('intermediate_wallet, user_wallet')
              .single();
            
            if (newMapping) {
              recipientMapping = newMapping;
              console.log(`✅ Assigned intermediate wallet to Void402 recipient ${recipient_wallet}`);
            }
          }
        }
      } catch (txTableError: any) {
        console.warn('Transaction table check failed:', txTableError.message);
      }
    }

    // Determine transfer type: if recipient is NOT a Void402 user and this is an address-based transfer,
    // treat it as an external send (direct token transfer to their Solana address)
    if (!isExternalTransfer && (!recipientMapping || !recipientMapping.intermediate_wallet)) {
      if (recipient_username) {
        // Username-based transfers MUST be to Void402 users
        return res.status(400).json({ 
          error: 'This user hasn\'t deposited yet — they must deposit before they can receive transfers.',
          exists: false,
        });
      }
      // Address-based transfer to non-Void402 user = external send
      isExternalTransfer = true;
      console.log(`📤 External transfer to non-Void402 address: ${recipient_wallet}`);
    }

    // Get sender's intermediate wallet (try with token first, then any token)
    let senderMapping: any = null;
    
    const { data: senderByToken } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet')
      .eq('user_wallet', sender_wallet)
      .eq('token', token)
      .maybeSingle();

    if (senderByToken?.intermediate_wallet) {
      senderMapping = senderByToken;
    } else {
      // Fallback: look up without token filter (user may have deposited a different token)
      const { data: senderAny } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', sender_wallet)
        .limit(1)
        .maybeSingle();
      
      if (senderAny?.intermediate_wallet) {
        senderMapping = senderAny;
      }
    }

    if (!senderMapping || !senderMapping.intermediate_wallet) {
      return res.status(400).json({ error: 'Sender has not deposited funds yet' });
    }

    const connection = getSolanaConnection();
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;
    const transferAmount = parseFloat(amount);

    // ================================================================
    // EXTERNAL TRANSFER: Uses smart contract external_transfer instruction
    // (same as withdrawal — moves tokens from Pool PDA to recipient)
    // ================================================================
    if (isExternalTransfer) {
      console.log(`[External Transfer] ${sender_wallet.slice(0, 8)}... → ${recipient_wallet.slice(0, 8)}... | $${transferAmount} ${token}`);

      const intermediatePool = getPrivacyUsdWalletPool();
      await intermediatePool.initialize();

      const senderIntermediateWallet = await intermediatePool.getWalletByPublicKey(senderMapping.intermediate_wallet);
      if (!senderIntermediateWallet) {
        return res.status(400).json({ error: 'Sender intermediate wallet not found' });
      }

      const senderIntKeypair = Keypair.fromSecretKey(Uint8Array.from(senderIntermediateWallet.privateKey));
      const senderIntPubkey = senderIntKeypair.publicKey;
      const recipientPubkey = new PublicKey(recipient_wallet);

      const relayerKeypair = getRelayerKeypair();
      const relayerPubkey = relayerKeypair.publicKey;

      // Derive PDAs
      const poolPDA = await derivePoolPDA(tokenMint.toString());
      const senderBalancePDA = await deriveUserBalancePDA(senderMapping.intermediate_wallet, tokenMint.toString());
      const proofPDA = await deriveProofPDA(nonce);
      const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);
      const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

      // STEP 1: Fund intermediate wallet with SOL for proof account rent if needed
      const intSolBalance = await connection.getBalance(senderIntPubkey);
      const PROOF_ACCOUNT_RENT = 9_396_000;
      const MIN_SOL = PROOF_ACCOUNT_RENT + 1_010_000;

      if (intSolBalance < MIN_SOL) {
        const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.COLLECTION_WALLET_PRIVATE_KEY;
        if (mainWalletKey) {
          let mainKeypair: Keypair;
          try {
            mainKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(mainWalletKey)));
          } catch {
            mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletKey) as Uint8Array);
          }

          const solToSend = MIN_SOL - intSolBalance;
          const { blockhash: fb } = await connection.getLatestBlockhash('finalized');
          const fundTx = new VersionedTransaction(
            new TransactionMessage({
              payerKey: mainKeypair.publicKey,
              recentBlockhash: fb,
              instructions: [SystemProgram.transfer({
                fromPubkey: mainKeypair.publicKey,
                toPubkey: senderIntPubkey,
                lamports: solToSend,
              })],
            }).compileToLegacyMessage()
          );
          fundTx.sign([mainKeypair]);
          const fundSig = await connection.sendRawTransaction(fundTx.serialize(), { skipPreflight: true });
          console.log(`[External Transfer] Funded intermediate with SOL: ${fundSig}`);
          
          try {
            await connection.confirmTransaction(fundSig, 'confirmed');
          } catch {
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 2000));
              const status = await connection.getSignatureStatus(fundSig);
              if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') break;
            }
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // STEP 2: Upload proof (create proof PDA)
      const amountLamports = Math.floor(transferAmount * 1_000_000);
      const proofBytes = Buffer.alloc(32, 0);
      const commitmentBytes = Buffer.alloc(32, 0);
      const blindingFactorBytes = Buffer.alloc(32, 0);

      const uploadProofIx = buildUploadProofInstruction({
        sender: senderIntPubkey,
        proof: proofPDA,
        tokenMint: tokenMint,
        nonce: nonce,
        amount: amountLamports,
        proofBytes,
        commitmentBytes,
        blindingFactorBytes,
      });

      const { blockhash: proofBlockhash, lastValidBlockHeight: proofBH } = await connection.getLatestBlockhash('finalized');
      const proofTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: senderIntPubkey,
          recentBlockhash: proofBlockhash,
          instructions: [new TransactionInstruction(uploadProofIx)],
        }).compileToLegacyMessage()
      );
      proofTx.sign([senderIntKeypair]);

      const proofSig = await connection.sendRawTransaction(proofTx.serialize(), { skipPreflight: false, maxRetries: 3 });
      try {
        await connection.confirmTransaction({ signature: proofSig, blockhash: proofBlockhash, lastValidBlockHeight: proofBH }, 'confirmed');
      } catch (confirmErr: any) {
        const status = await connection.getSignatureStatus(proofSig);
        if (!status.value?.confirmationStatus || (status.value.confirmationStatus !== 'confirmed' && status.value.confirmationStatus !== 'finalized')) {
          throw new Error(`Proof upload not confirmed: ${confirmErr.message}`);
        }
      }
      console.log(`[External Transfer] Proof uploaded: ${proofSig}`);
      await new Promise(r => setTimeout(r, 500));

      // STEP 3: Build external_transfer instruction (moves from Pool PDA to recipient)
      // This is the same instruction used by withdrawals
      const EXTERNAL_TRANSFER_DISCRIMINATOR = Buffer.from([11, 179, 85, 190, 61, 53, 105, 169]);

      const feeBuffer = Buffer.allocUnsafe(8);
      const feeBigInt = BigInt(0);
      for (let i = 0; i < 8; i++) {
        feeBuffer[i] = Number((feeBigInt >> BigInt(i * 8)) & BigInt(0xff));
      }

      const extTransferData = Buffer.concat([EXTERNAL_TRANSFER_DISCRIMINATOR, feeBuffer]);

      const extTransferIx = new TransactionInstruction({
        programId: VOID402_PROGRAM_ID,
        keys: [
          { pubkey: senderIntPubkey, isSigner: true, isWritable: true },
          { pubkey: proofPDA, isSigner: false, isWritable: true },
          { pubkey: senderBalancePDA, isSigner: false, isWritable: true },
          { pubkey: poolPDA, isSigner: false, isWritable: true },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
          { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: extTransferData,
      });

      // Build transaction with ATA creation if needed + external_transfer
      const instructions: TransactionInstruction[] = [];

      let recipientATAExists = false;
      try {
        await connection.getTokenAccountBalance(recipientTokenAccount);
        recipientATAExists = true;
      } catch {}

      if (!recipientATAExists) {
        instructions.push(createAssociatedTokenAccountInstruction(
          relayerPubkey, recipientTokenAccount, recipientPubkey, tokenMint
        ));
      }

      instructions.push(extTransferIx);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const txMessage = new TransactionMessage({
        payerKey: relayerPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(txMessage);
      transaction.sign([relayerKeypair, senderIntKeypair]);

      const signature = await connection.sendTransaction(transaction, { skipPreflight: false, maxRetries: 3 });
      console.log(`[External Transfer] TX sent: ${signature}`);

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      // Log to database
      try {
        await supabase.from('zk_transactions').insert({
          sender_wallet: sender_wallet,
          recipient_wallet: recipient_wallet,
          amount: transferAmount,
          fee_percentage: 0,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: 'transfer',
        });
      } catch (logErr: any) {
        console.warn(`⚠️ Failed to log external transfer:`, logErr.message);
        try {
          await supabase.from('zk_transactions').insert({
            sender_wallet: sender_wallet,
            recipient_wallet: recipient_wallet,
            amount: transferAmount,
            token_symbol: token,
            tx_hash: signature,
            status: 'completed',
            privacy_level: 'full',
            transaction_type: 'transfer',
          });
        } catch { /* ignore */ }
      }

      console.log(`✅ External transfer: ${sender_wallet.slice(0, 8)}... → ${recipient_wallet.slice(0, 8)}... | $${transferAmount} ${token} | tx: ${signature}`);

      return res.status(200).json({
        success: true,
        signature,
        amount: transferAmount,
        fee: 0,
        fee_percentage: 0,
        external: true,
      });
    }

    // ================================================================
    // INTERNAL TRANSFER: Between Void402 users via smart contract
    // ================================================================

    // CRITICAL: If recipient has the same intermediate wallet as sender, reassign recipient a different one
    if (recipientMapping!.intermediate_wallet.toLowerCase() === senderMapping.intermediate_wallet.toLowerCase()) {
      console.warn(`⚠️ Recipient ${recipient_wallet} has same intermediate wallet as sender ${sender_wallet}. Reassigning recipient...`);
      
      try {
        const { data: assignedWallets } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('token', token);
        
        const excludedWallets = new Set<string>();
        excludedWallets.add(senderMapping.intermediate_wallet.toLowerCase());
        if (assignedWallets) {
          assignedWallets.forEach((w: any) => {
            if (w.intermediate_wallet) {
              excludedWallets.add(w.intermediate_wallet.toLowerCase());
            }
          });
        }
        
        const intermediatePool = getPrivacyUsdWalletPool();
        await intermediatePool.initialize();
        
        let availableWallet = null;
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const candidate = await intermediatePool.getAvailableWallet();
          if (!excludedWallets.has(candidate.publicKey.toLowerCase())) {
            availableWallet = candidate;
            break;
          }
        }
        
        if (!availableWallet) {
          return res.status(400).json({ error: 'No available intermediate wallets. Please contact support.' });
        }
        
        const { data: updatedMapping, error: updateError } = await supabase
          .from('zk_user_wallets')
          .update({
            intermediate_wallet: availableWallet.publicKey,
            updated_at: new Date().toISOString(),
          })
          .eq('user_wallet', recipient_wallet)
          .eq('token', token)
          .select('intermediate_wallet, user_wallet')
          .single();
        
        if (updateError || !updatedMapping) {
          return res.status(400).json({ error: 'Failed to reassign intermediate wallet. Please contact support.' });
        }
        
        recipientMapping = updatedMapping;
        console.log(`✅ Reassigned intermediate wallet ${availableWallet.publicKey} to recipient ${recipient_wallet}`);
      } catch (reassignError: any) {
        return res.status(400).json({ error: 'Failed to reassign intermediate wallet. Please contact support.' });
      }
    }

    const relayerKeypair = getRelayerKeypair();
    const relayerPubkey = relayerKeypair.publicKey;

    // Derive PDAs
    const poolPDA = await derivePoolPDA(tokenMint.toString());
    const recipientBalancePDA = await deriveUserBalancePDA(recipientMapping!.intermediate_wallet, tokenMint.toString());
    const recipientIntermediatePubkey = new PublicKey(recipientMapping!.intermediate_wallet);
    
    // Derive proof PDA and sender balance PDA
    const proofPDA = await deriveProofPDA(nonce);
    const senderBalancePDA = await deriveUserBalancePDA(senderMapping.intermediate_wallet, tokenMint.toString());

    // CRITICAL SECURITY: Prevent transfers where sender and recipient use the same intermediate wallet
    if (senderMapping.intermediate_wallet.toLowerCase() === recipientMapping!.intermediate_wallet.toLowerCase()) {
      console.error(`❌ SECURITY: Sender ${sender_wallet} and recipient ${recipient_wallet} share the same intermediate wallet. Blocking transfer.`);
      return res.status(400).json({ 
        error: 'Invalid transfer',
        message: 'Sender and recipient cannot use the same intermediate wallet.'
      });
    }

    // Verify sender and recipient intermediate wallets exist in pool
    const intermediatePool = getPrivacyUsdWalletPool();
    await intermediatePool.initialize();

    const senderIntermediateWallet = await intermediatePool.getWalletByPublicKey(senderMapping.intermediate_wallet);
    if (!senderIntermediateWallet) {
      return res.status(400).json({ error: 'Sender intermediate wallet not found in pool' });
    }

    const recipientIntermediateWallet = await intermediatePool.getWalletByPublicKey(recipientMapping!.intermediate_wallet);
    if (!recipientIntermediateWallet) {
      return res.status(400).json({ error: 'Recipient intermediate wallet not found in pool' });
    }

    // Internal transfers (username to username) are fee-free
    const feePercentage = 0;
    const feeAmount = 0;
    const amountAfterFees = transferAmount;

    // Get sender's intermediate keypair (needed to sign the proof upload)
    const senderIntermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(senderIntermediateWallet.privateKey));
    const senderIntermediatePubkey = senderIntermediateKeypair.publicKey;

    // STEP 1: Check if intermediate wallet has enough SOL for proof account rent
    const intermediateBalance = await connection.getBalance(senderIntermediatePubkey);
    const PROOF_ACCOUNT_RENT = 9_396_000; // ~0.009396 SOL
    const TRANSACTION_FEE = 10_000;
    const MIN_REQUIRED_BALANCE = PROOF_ACCOUNT_RENT + TRANSACTION_FEE + 1_000_000; // buffer

    if (intermediateBalance < MIN_REQUIRED_BALANCE) {
      console.log(`[Transfer] Intermediate wallet needs SOL. Balance: ${intermediateBalance}, Required: ${MIN_REQUIRED_BALANCE}`);
      
      const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.COLLECTION_WALLET_PRIVATE_KEY;
      if (!mainWalletKey) {
        return res.status(500).json({ error: 'No funding wallet configured for proof account rent' });
      }

      let mainKeypair: Keypair;
      try {
        const keyArray = JSON.parse(mainWalletKey);
        mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
      } catch {
        mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletKey) as Uint8Array);
      }

      const solToSend = MIN_REQUIRED_BALANCE - intermediateBalance;
      const { blockhash: fundBlockhash } = await connection.getLatestBlockhash('finalized');
      const fundTx = new VersionedTransaction(
        new TransactionMessage({
          payerKey: mainKeypair.publicKey,
          recentBlockhash: fundBlockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: mainKeypair.publicKey,
              toPubkey: senderIntermediatePubkey,
              lamports: solToSend,
            })
          ],
        }).compileToLegacyMessage()
      );
      fundTx.sign([mainKeypair]);

      const fundSig = await connection.sendRawTransaction(fundTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      try {
        await connection.confirmTransaction(fundSig, 'confirmed');
        console.log(`[Transfer] Funded intermediate wallet: ${fundSig}`);
      } catch (confirmErr: any) {
        const status = await connection.getSignatureStatus(fundSig);
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          console.log(`[Transfer] Funding confirmed despite timeout: ${fundSig}`);
        } else {
          throw new Error(`Failed to fund intermediate wallet for proof: ${confirmErr.message}`);
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    // STEP 2: Upload proof (create proof PDA)
    const amountLamports = Math.floor(transferAmount * 1_000_000);
    const proofBytes = Buffer.alloc(32, 0);
    const commitmentBytes = Buffer.alloc(32, 0);
    const blindingFactorBytes = Buffer.alloc(32, 0);

    const uploadProofIx = buildUploadProofInstruction({
      sender: senderIntermediatePubkey,
      proof: proofPDA,
      tokenMint: tokenMint,
      nonce: nonce,
      amount: amountLamports,
      proofBytes,
      commitmentBytes,
      blindingFactorBytes,
    });

    const { blockhash: proofBlockhash, lastValidBlockHeight: proofBlockHeight } = await connection.getLatestBlockhash('finalized');
    const proofTxMessage = new TransactionMessage({
      payerKey: senderIntermediatePubkey,
      recentBlockhash: proofBlockhash,
      instructions: [new TransactionInstruction(uploadProofIx)],
    }).compileToLegacyMessage();

    const proofTx = new VersionedTransaction(proofTxMessage);
    proofTx.sign([senderIntermediateKeypair]);

    const proofSignature = await connection.sendRawTransaction(proofTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    try {
      await connection.confirmTransaction({
        signature: proofSignature,
        blockhash: proofBlockhash,
        lastValidBlockHeight: proofBlockHeight,
      }, 'confirmed');
      console.log(`[Transfer] Proof uploaded: nonce=${nonce}, tx=${proofSignature}`);
    } catch (confirmErr: any) {
      const status = await connection.getSignatureStatus(proofSignature);
      if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
        console.log(`[Transfer] Proof upload confirmed despite timeout: ${proofSignature}`);
      } else {
        throw new Error(`Proof upload not confirmed: ${confirmErr.message}`);
      }
    }

    // Small delay for on-chain state propagation
    await new Promise(r => setTimeout(r, 500));

    // STEP 3: Build and send internal_transfer instruction
    const internalTransferIx = buildInternalTransferInstruction({
      relayer: relayerPubkey,
      proof: proofPDA,
      senderBalance: senderBalancePDA,
      recipient: recipientIntermediatePubkey,
      recipientBalance: recipientBalancePDA,
      systemProgram: SystemProgram.programId,
      relayerFee: 0,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const messageV0 = new TransactionMessage({
      payerKey: relayerPubkey,
      recentBlockhash: blockhash,
      instructions: [new TransactionInstruction(internalTransferIx)],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([relayerKeypair]);

    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    // Log transaction to database
    try {
      const { error: insertError } = await supabase.from('zk_transactions').insert({
        sender_wallet: sender_wallet,
        recipient_wallet: recipient_wallet,
        amount: transferAmount,
        fee_percentage: feePercentage,
        token_symbol: token,
        tx_hash: signature,
        status: 'completed',
        privacy_level: 'full',
        transaction_type: 'transfer',
      });
      if (insertError) {
        console.warn(`⚠️ Full insert failed (${insertError.message}), trying minimal insert...`);
        await supabase.from('zk_transactions').insert({
          sender_wallet: sender_wallet,
          recipient_wallet: recipient_wallet,
          amount: transferAmount,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: 'transfer',
        });
      }
    } catch (logError: any) {
      console.error('❌ Error logging transfer:', logError);
    }

    console.log(`✅ Internal transfer: ${sender_wallet.slice(0, 8)}... → ${recipient_wallet.slice(0, 8)}... | ${amountAfterFees} ${token} | tx: ${signature}`);

    return res.status(200).json({
      success: true,
      signature: signature,
      amount: amountAfterFees,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error('Error processing internal transfer:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
