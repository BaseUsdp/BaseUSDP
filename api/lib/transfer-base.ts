/**
 * Shared Base Chain Transfer Logic
 * Extracted from api/zk/transfer.ts for reuse by cast-payment webhook.
 *
 * Executes ZK transfers via the X402PrivacyPool contract on Base.
 */

import { createClient } from "@supabase/supabase-js";
import { ethers as ethersLib } from "ethers";
import {
  isValidBaseAddress,
  getPrivacyPoolContract,
  getTokenAddress,
  parseUsdc,
  getBaseProvider,
} from "./void402-base.js";
import {
  generatePrivacyNonce,
  getProofId,
  generateMockProof,
} from "./privacy-utils-base.js";
import { getBaseIntermediateWalletPool } from "./intermediate-wallet-pool-base.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export interface BaseTransferParams {
  senderWallet: string;
  recipientWallet: string;
  amount: number;
  token: "USDC" | "USDT";
  /** If true, always use external transfer (tokens leave the contract) */
  forceExternal?: boolean;
}

export interface BaseTransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Execute a Base chain ZK transfer via X402PrivacyPool.
 * Finds an intermediate wallet with sufficient pool balance,
 * uploads a proof, and executes an internal or external transfer.
 */
export async function executeBaseTransfer(
  params: BaseTransferParams
): Promise<BaseTransferResult> {
  const { senderWallet, recipientWallet, amount, token, forceExternal } = params;
  const supabase = getSupabase();

  if (!isValidBaseAddress(senderWallet)) {
    return { success: false, error: "Invalid sender Base address" };
  }
  if (!isValidBaseAddress(recipientWallet)) {
    return { success: false, error: "Invalid recipient Base address" };
  }
  if (senderWallet.toLowerCase() === recipientWallet.toLowerCase()) {
    return { success: false, error: "Self-transfers are not allowed" };
  }

  try {
    const tokenAddress = getTokenAddress(token || 'USDC');
    const provider = getBaseProvider();
    const amountInUnits = parseUsdc(amount.toString());

    const baseIntPool = getBaseIntermediateWalletPool();
    await baseIntPool.initialize();

    // Find an intermediate wallet with sufficient on-chain pool balance
    let intWalletData: any = null;
    const readonlyPool = getPrivacyPoolContract(provider as any);
    const allWallets = baseIntPool.getAllWallets();
    for (const candidate of allWallets) {
      try {
        const [available] = await readonlyPool.getUserBalance(
          candidate.address,
          tokenAddress
        );
        console.log(
          `[BaseTransfer] Intermediate ${candidate.address.slice(0, 10)}... pool balance: ${available.toString()}`
        );
        if (available >= amountInUnits) {
          intWalletData = candidate;
          break;
        }
      } catch (e: any) {
        console.warn(
          `[BaseTransfer] Failed to check balance for ${candidate.address}: ${e.message}`
        );
      }
    }

    if (!intWalletData) {
      return {
        success: false,
        error: "Insufficient pool balance. No intermediate wallet has enough funds.",
      };
    }

    const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);

    // Fund intermediate wallet with ETH for gas if needed
    const intEthBalance = await provider.getBalance(intWalletData.address);
    const ethNeeded = ethersLib.parseEther("0.002");
    if (intEthBalance < ethNeeded) {
      const fundAmount = ethNeeded - intEthBalance;
      let funded = false;
      const funderKeys = [
        { name: "collection", key: process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE },
        { name: "mixer", key: process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY_BASE },
      ];
      for (const { name, key } of funderKeys) {
        if (!key || funded) continue;
        try {
          const funder = new ethersLib.Wallet(key, provider);
          const funderBalance = await provider.getBalance(funder.address);
          const estimatedGas = ethersLib.parseEther("0.00015");
          if (funderBalance < fundAmount + estimatedGas) {
            console.warn(
              `[BaseTransfer] ${name} wallet (${funder.address.slice(0, 10)}...) insufficient ETH: ${ethersLib.formatEther(funderBalance)}`
            );
            continue;
          }
          const fundTx = await funder.sendTransaction({
            to: intWalletData.address,
            value: fundAmount,
          });
          await fundTx.wait();
          console.log(
            `[BaseTransfer] Funded intermediate with ${ethersLib.formatEther(fundAmount)} ETH from ${name} wallet: ${fundTx.hash}`
          );
          funded = true;
        } catch (fundErr: any) {
          console.warn(
            `[BaseTransfer] Failed to fund from ${name} wallet: ${fundErr.message}`
          );
        }
      }
      if (!funded) {
        console.error(
          "[BaseTransfer] Cannot fund intermediate with ETH - all funder wallets depleted"
        );
      }
    }

    const privacyPoolContract = getPrivacyPoolContract(intSigner);

    // Generate nonce and proof
    const privacyNonce = generatePrivacyNonce(senderWallet);
    const proofId = getProofId(privacyNonce);
    const { proofBytes, commitmentBytes, blindingFactorBytes } =
      generateMockProof(senderWallet, amountInUnits, privacyNonce);

    // Upload proof
    console.log(`[BaseTransfer] Uploading proof for nonce ${privacyNonce}...`);
    const uploadTx = await privacyPoolContract.uploadProof(
      privacyNonce,
      amountInUnits,
      tokenAddress,
      proofBytes,
      commitmentBytes,
      blindingFactorBytes
    );
    const uploadReceipt = await uploadTx.wait();
    console.log(`[BaseTransfer] Proof uploaded: ${uploadReceipt.hash}`);

    // Determine if internal or external transfer
    let recipientIsVoid402User = false;
    if (!forceExternal && supabase) {
      const { data: recipientProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .ilike("wallet_address", recipientWallet)
        .maybeSingle();
      if (recipientProfile) {
        recipientIsVoid402User = true;
      }
    }

    const relayerFee = 0n;
    let signature: string;

    if (recipientIsVoid402User) {
      console.log(`[BaseTransfer] Executing internal transfer to Void402 user...`);
      const transferTx = await privacyPoolContract.internalTransfer(
        proofId,
        recipientWallet,
        relayerFee
      );
      const transferReceipt = await transferTx.wait();
      signature = transferReceipt.hash;
      console.log(`[BaseTransfer] Internal transfer complete: ${signature}`);
    } else {
      console.log(`[BaseTransfer] Executing external transfer to raw address...`);
      const transferTx = await privacyPoolContract.externalTransfer(
        proofId,
        recipientWallet,
        relayerFee
      );
      const transferReceipt = await transferTx.wait();
      signature = transferReceipt.hash;
      console.log(`[BaseTransfer] External transfer complete: ${signature}`);
    }

    // Log to database
    if (supabase) {
      try {
        await supabase.from("zk_transactions").insert({
          sender_wallet: senderWallet,
          recipient_wallet: recipientWallet,
          amount,
          fee_percentage: 0,
          token_symbol: token,
          tx_hash: signature,
          status: "completed",
          privacy_level: "full",
          transaction_type: "transfer",
        });
      } catch (logErr: any) {
        console.warn(`[BaseTransfer] Failed to log transfer:`, logErr.message);
      }
    }

    console.log(
      `[BaseTransfer] ${senderWallet.slice(0, 8)}... -> ${recipientWallet.slice(0, 8)}... | $${amount} ${token} | tx: ${signature}`
    );

    return { success: true, txHash: signature };
  } catch (error: any) {
    console.error(`[BaseTransfer] Transfer failed:`, error.message);
    return { success: false, error: error.message || "Transfer execution failed" };
  }
}
