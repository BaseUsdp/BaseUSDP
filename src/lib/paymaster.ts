/**
 * CDP Paymaster integration for client-side ERC-20 sends.
 *
 * When the connected wallet supports EIP-5792 `paymasterService` capability
 * on Base (typically Coinbase Smart Wallet), the transfer is submitted via
 * `wallet_sendCalls` so the user pays no gas. Otherwise this falls back to
 * a regular `writeContract` and the user pays gas as before. The fallback
 * is silent — any error in the sponsored path (unsupported, paymaster down,
 * etc.) cleanly drops to the legacy path so EOA wallets like MetaMask /
 * Phantom / OKX / Rabby keep working exactly as today.
 *
 * Disabled entirely unless `VITE_ENABLE_CDP_PAYMASTER === "true"`.
 *
 * Optional `VITE_CDP_PAYMASTER_URL` points at a CDP-managed paymaster proxy
 * (created in portal.cdp.coinbase.com). Without it we omit the capability
 * URL and let the wallet's built-in paymaster (free tier) decide.
 */

import {
  createWalletClient,
  custom,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

const BASE_CHAIN_ID_HEX = "0x2105"; // 8453

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const PAYMASTER_URL =
  (import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined) || undefined;
const PAYMASTER_ENABLED =
  (import.meta.env.VITE_ENABLE_CDP_PAYMASTER as string | undefined) === "true";

interface SendArgs {
  provider: any;
  from: Address;
  tokenAddress: Address;
  recipient: Address;
  amount: string;
  decimals: number;
}

export interface SendResult {
  txHash: Hex;
  sponsored: boolean;
}

async function checkPaymasterSupport(
  provider: any,
  account: Address,
): Promise<boolean> {
  try {
    const caps: any = await provider.request({
      method: "wallet_getCapabilities",
      params: [account],
    });
    return caps?.[BASE_CHAIN_ID_HEX]?.paymasterService?.supported === true;
  } catch {
    return false;
  }
}

async function pollForTxHash(
  provider: any,
  batchId: string,
  timeoutMs = 60_000,
): Promise<Hex> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status: any = await provider.request({
      method: "wallet_getCallsStatus",
      params: [batchId],
    });
    const hash = status?.receipts?.[0]?.transactionHash;
    if (hash) return hash as Hex;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Paymaster call timed out waiting for tx hash");
}

export async function sendErc20WithOptionalPaymaster(
  args: SendArgs,
): Promise<SendResult> {
  const { provider, from, tokenAddress, recipient, amount, decimals } = args;
  const amountWei = parseUnits(amount, decimals);

  if (PAYMASTER_ENABLED) {
    try {
      const supported = await checkPaymasterSupport(provider, from);
      if (supported) {
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [recipient, amountWei],
        });
        const sendParams: any = {
          version: "1.0",
          from,
          chainId: BASE_CHAIN_ID_HEX,
          calls: [{ to: tokenAddress, data, value: "0x0" }],
        };
        if (PAYMASTER_URL) {
          sendParams.capabilities = {
            paymasterService: { url: PAYMASTER_URL },
          };
        }
        const batchId: string = await provider.request({
          method: "wallet_sendCalls",
          params: [sendParams],
        });
        const txHash = await pollForTxHash(provider, batchId);
        return { txHash, sponsored: true };
      }
    } catch (err) {
      // Sponsored path failed — fall through to writeContract. Surfaced in
      // console so we can spot misconfiguration, but never raised to the user.
      console.warn("[paymaster] sponsored path failed, falling back:", err);
    }
  }

  const walletClient = createWalletClient({
    account: from,
    chain: base,
    transport: custom(provider),
  });
  const txHash: Hex = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [recipient, amountWei],
  });
  return { txHash, sponsored: false };
}
