/**
 * Clawncher Swap Service
 *
 * Calls the Clawncher swap API (0x aggregation proxy) directly.
 * Uses Permit2 SignatureTransfer: approve Permit2 → sign EIP-712 → append sig to calldata.
 *
 * No dependency on the @clawnch/clawncher-sdk package to avoid bundling
 * issues with server-side modules (wayfinder, @uniswap/v4-sdk).
 */
import {
  createPublicClient,
  http,
  erc20Abi,
  encodeFunctionData,
  maxUint256,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { getApiUrl } from "@/utils/apiConfig";

// ============================================================================
// Constants
// ============================================================================

export const NATIVE_TOKEN_ADDRESS: Address =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const BASE_CHAIN_ID = 8453;
const PERMIT2_ADDRESS: Address =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// BASEUSDP fee configuration
const BASEUSDP_FEE_RECIPIENT: Address =
  "0x5e4de1d7ffe5bacd49f586cb6d0ad4c6473b5f6e";
const BASEUSDP_FEE_BPS = 50; // 0.5%

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logoUrl: string;
}

export interface SwapPriceResult {
  buyAmount: bigint;
  sellAmount: bigint;
  minBuyAmount: bigint;
  gas: bigint;
  gasPrice: bigint;
  totalNetworkFee: bigint;
  allowanceTarget: Address;
  liquidityAvailable: boolean;
  blockNumber: string;
}

export interface SwapQuoteResult extends SwapPriceResult {
  permit2?: {
    type: string;
    hash: string;
    eip712: any;
  };
  transaction: {
    to: Address;
    data: Hex;
    gas: bigint;
    gasPrice: bigint;
    value: bigint;
  };
}

export interface SwapResult {
  txHash: Hash;
  buyAmount: bigint;
  sellAmount: bigint;
}

// ============================================================================
// Token List
// ============================================================================

export const BASE_TOKENS: TokenInfo[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    logoUrl:
      "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    logoUrl:
      "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
    logoUrl:
      "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    logoUrl:
      "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    logoUrl:
      "https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png",
  },
];

// ============================================================================
// Helpers
// ============================================================================

function isNativeToken(address: Address): boolean {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
}

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => e[1] !== undefined
  );
  return new URLSearchParams(entries).toString();
}

async function apiRequest(path: string): Promise<any> {
  const apiBase = getApiUrl();
  const url = `${apiBase}/api/swap${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    let msg: string;
    try {
      const body = await response.json();
      msg = body.error || body.reason || JSON.stringify(body);
    } catch {
      msg = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(`Swap API error: ${msg}`);
  }

  return response.json();
}

function parsePriceResponse(raw: any): SwapPriceResult {
  return {
    buyAmount: BigInt(raw.buyAmount),
    sellAmount: BigInt(raw.sellAmount),
    minBuyAmount: BigInt(raw.minBuyAmount),
    gas: BigInt(raw.gas || raw.transaction?.gas || "0"),
    gasPrice: BigInt(raw.gasPrice || raw.transaction?.gasPrice || "0"),
    totalNetworkFee: BigInt(raw.totalNetworkFee || "0"),
    allowanceTarget: raw.allowanceTarget,
    liquidityAvailable: raw.liquidityAvailable ?? true,
    blockNumber: raw.blockNumber ?? "0",
  };
}

function parseQuoteResponse(raw: any): SwapQuoteResult {
  const base = parsePriceResponse(raw);
  const tx = raw.transaction;
  return {
    ...base,
    permit2: raw.permit2 || undefined,
    transaction: {
      to: tx.to,
      data: tx.data,
      gas: BigInt(tx.gas || "0"),
      gasPrice: BigInt(tx.gasPrice || "0"),
      value: BigInt(tx.value || "0"),
    },
  };
}

function buildSwapQuery(
  params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    slippageBps?: number;
    taker?: Address;
  },
  includeTaker: boolean
): string {
  return buildQuery({
    chainId: BASE_CHAIN_ID.toString(),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount.toString(),
    slippageBps: (params.slippageBps ?? 300).toString(),
    taker: includeTaker ? params.taker : undefined,
    swapFeeRecipient: BASEUSDP_FEE_RECIPIENT,
    swapFeeBps: BASEUSDP_FEE_BPS.toString(),
  });
}

// ============================================================================
// Swapper Class
// ============================================================================

export class ClawnchSwapper {
  private provider: any;
  private publicClient: PublicClient;

  constructor(provider: any) {
    this.provider = provider;
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(),
    }) as any;
  }

  async getTakerAddress(): Promise<Address> {
    const accounts = await this.provider.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please connect your wallet.");
    }
    return accounts[0] as Address;
  }

  async getPrice(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    slippageBps?: number;
  }): Promise<SwapPriceResult> {
    const query = buildSwapQuery(params, false);
    const raw = await apiRequest(`/price?${query}`);
    return parsePriceResponse(raw);
  }

  async getQuote(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    slippageBps?: number;
    taker?: Address;
  }): Promise<SwapQuoteResult> {
    const taker = params.taker ?? (await this.getTakerAddress());
    const query = buildSwapQuery({ ...params, taker }, true);
    const raw = await apiRequest(`/quote?${query}`);
    return parseQuoteResponse(raw);
  }

  async getBalance(token: Address, owner: Address): Promise<bigint> {
    if (isNativeToken(token)) {
      return this.publicClient.getBalance({ address: owner });
    }
    return (this.publicClient as any).readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    });
  }

  /**
   * Wait for a transaction to be confirmed.
   */
  private async waitForTx(hash: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const receipt = await this.provider.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      });
      if (receipt && receipt.status === "0x1") return;
      if (receipt && receipt.status === "0x0") {
        throw new Error("Transaction failed");
      }
    }
    throw new Error("Transaction confirmation timed out");
  }

  /**
   * Execute a full swap using Permit2 SignatureTransfer:
   *
   *   Step 1: ERC20.approve(Permit2, max) — one-time per token
   *   Step 2: Get fresh quote (includes permit2.eip712 message)
   *   Step 3: Sign permit2.eip712 via eth_signTypedData_v4
   *   Step 4: Append signature + length to transaction.data
   *   Step 5: Send the swap transaction
   */
  async swap(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    slippageBps?: number;
  }): Promise<SwapResult> {
    const taker = await this.getTakerAddress();

    // 1. For ERC-20 sells, ensure Permit2 has ERC20 approval
    if (!isNativeToken(params.sellToken)) {
      const erc20Allowance = await (this.publicClient as any).readContract({
        address: params.sellToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [taker, PERMIT2_ADDRESS],
      });

      if (erc20Allowance < params.sellAmount) {
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2_ADDRESS, maxUint256],
        });

        const approveHash = await this.provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: taker,
            to: params.sellToken,
            data: approveData,
          }],
        });

        await this.waitForTx(approveHash);
      }
    }

    // 2. Get FRESH quote (must be as close to sending as possible)
    const quote = await this.getQuote({ ...params, taker });

    if (!quote.liquidityAvailable) {
      throw new Error("Insufficient liquidity available for this swap");
    }

    // 3. Build the final transaction data
    let txData: Hex = quote.transaction.data;

    if (quote.permit2 && quote.permit2.eip712) {
      // Sign the Permit2 EIP-712 typed data
      const signature: string = await this.provider.request({
        method: "eth_signTypedData_v4",
        params: [taker, JSON.stringify(quote.permit2.eip712)],
      });

      // The last action in the calldata has an ABI-encoded bytes offset (0xc0)
      // pointing to where the signature should be. We append it as ABI-encoded
      // bytes: uint256(length) + signature padded to 32-byte boundary
      const sigWithout0x = signature.startsWith("0x")
        ? signature.slice(2)
        : signature;
      const sigByteLength = sigWithout0x.length / 2; // 65

      // ABI-encoded bytes: uint256(length) + data padded to 32 bytes
      const lengthHex = sigByteLength.toString(16).padStart(64, "0");
      // Pad signature to next 32-byte boundary (65 -> 96 bytes = 192 hex chars)
      const paddedSig = sigWithout0x.padEnd(
        Math.ceil(sigByteLength / 32) * 64, "0"
      );

      txData = (quote.transaction.data + lengthHex + paddedSig) as Hex;

      console.log("[Swap] Signature bytes:", sigByteLength);
      console.log("[Swap] Original calldata bytes:", (quote.transaction.data.length - 2) / 2);
      console.log("[Swap] Final calldata bytes:", (txData.length - 2) / 2);
    }

    // 4. Send swap transaction with extra gas headroom for signature bytes
    const tx = quote.transaction;
    const gasLimit = tx.gas > 0n ? tx.gas * 3n / 2n : 500000n; // 50% more gas
    const txHash: Hash = await this.provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: taker,
        to: tx.to,
        data: txData,
        gas: `0x${gasLimit.toString(16)}`,
        value: tx.value > 0n ? `0x${tx.value.toString(16)}` : "0x0",
      }],
    });

    // 5. Wait for confirmation
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const receipt = await this.provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt && receipt.status === "0x1") {
        return {
          txHash,
          buyAmount: quote.buyAmount,
          sellAmount: quote.sellAmount,
        };
      }
      if (receipt && receipt.status === "0x0") {
        throw new Error(`Swap transaction reverted. View on Basescan: https://basescan.org/tx/${txHash}`);
      }
    }

    throw new Error("Transaction confirmation timed out");
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || isNaN(Number(amount))) return 0n;
  const [whole = "0", fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals);
  const fraction = str.slice(str.length - decimals);
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
