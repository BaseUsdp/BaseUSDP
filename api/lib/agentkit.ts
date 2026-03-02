/**
 * AgentKit initialization — CDP SDK Smart Account factory
 * Uses @coinbase/cdp-sdk directly for simpler types and reliable builds.
 * Provides gasless smart wallets on Base for ORB402 agents via user operations.
 */
import { CdpClient } from "@coinbase/cdp-sdk";

let cachedClient: CdpClient | null = null;

/**
 * Get or create a CDP client instance.
 * Cached at module scope for warm Vercel invocations.
 */
export function getCdpClient(): CdpClient {
  if (!cachedClient) {
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
      throw new Error("CDP API credentials not configured. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET in Vercel env vars.");
    }
    if (!process.env.CDP_WALLET_SECRET) {
      throw new Error(
        "CDP_WALLET_SECRET not configured. Create a Wallet Secret in the CDP Portal (portal.cdp.coinbase.com) and add it to your Vercel environment variables."
      );
    }

    // Vercel env vars may store the PEM key with literal \n instead of real newlines.
    // The CDP SDK expects actual newline characters in the EC private key.
    const apiKeySecret = process.env.CDP_API_KEY_SECRET.replace(/\\n/g, "\n");

    cachedClient = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret,
      walletSecret: process.env.CDP_WALLET_SECRET,
    });
  }
  return cachedClient;
}

/**
 * Create a new CDP smart account (gasless wallet on Base).
 * Returns the smart account address and owner address for storage.
 */
export async function createSmartWallet(ownerName?: string) {
  const cdp = getCdpClient();

  // Create a server-side owner account
  const owner = await cdp.evm.createAccount({
    name: ownerName ? `orb402-owner-${ownerName}` : undefined,
  });

  // Create a smart account owned by the server account
  const smartAccount = await cdp.evm.createSmartAccount({
    owner,
  });

  return {
    ownerAddress: owner.address,
    smartAccountAddress: smartAccount.address,
    ownerId: ownerName || owner.address,
  };
}

/**
 * Send a gasless ERC-20 transfer via a smart account's user operation.
 * Restores the owner account and smart account from stored addresses,
 * then dispatches a user operation via the CDP paymaster.
 */
export async function sendSmartAccountTransfer(options: {
  smartAccountAddress: string;
  ownerAddress: string;
  tokenAddress: string;
  recipientAddress: string;
  amount: bigint;
}): Promise<{ userOpHash: string; status: string }> {
  const cdp = getCdpClient();

  // Restore the owner server account by address
  const owner = await cdp.evm.getAccount({
    address: options.ownerAddress as `0x${string}`,
  });

  // Restore the smart account using the full owner account object
  const smartAccount = await cdp.evm.getSmartAccount({
    address: options.smartAccountAddress as `0x${string}`,
    owner,
  });

  // Build ERC-20 transfer calldata
  const recipientPadded = options.recipientAddress
    .toLowerCase()
    .replace("0x", "")
    .padStart(64, "0");
  const amountHex = options.amount.toString(16).padStart(64, "0");
  const data = `0xa9059cbb${recipientPadded}${amountHex}` as `0x${string}`;

  // Send as a user operation (gasless via Base paymaster)
  // CDP SDK has excessively deep type instantiation on sendUserOperation — cast args to any
  const userOpArgs: any = {
    smartAccount,
    network: "base",
    calls: [
      {
        to: options.tokenAddress as `0x${string}`,
        value: "0",
        data,
      },
    ],
  };
  const result = await cdp.evm.sendUserOperation(userOpArgs);

  return {
    userOpHash: result.userOpHash,
    status: result.status,
  };
}
