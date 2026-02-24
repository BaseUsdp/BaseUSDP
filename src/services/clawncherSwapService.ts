/**
 * Clawncher Swap Service
 *
 * Calls the Clawncher swap API (0x aggregation proxy) directly.
 * Uses the AllowanceHolder path: approve → send tx (no Permit2 signing).
 * Matches the official @clawnch/clawncher-sdk swap flow exactly.
 *
 * No dependency on the SDK to avoid bundling issues with server-side
 * modules (wayfinder, @uniswap/v4-sdk).
 */
import {
  createPublicClient,
  http,
  erc20Abi,
  encodeFunctionData,
  maxUint256,
  maxUint160,
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

// Minimal Permit2 ABI for allowance checking and approval
const permit2Abi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ORB402 fee configuration
const ORB402_FEE_RECIPIENT: Address =
  "0x5e4de1d7ffe5bacd49f586cb6d0ad4c6473b5f6e";
const ORB402_FEE_BPS = 50; // 0.5%

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
    swapFeeRecipient: ORB402_FEE_RECIPIENT,
    swapFeeBps: ORB402_FEE_BPS.toString(),
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
    });
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
    return this.publicClient.readContract({
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
   * Execute a full swap with Permit2 AllowanceTransfer flow:
   *
   * For ERC-20 sells, three approvals are needed:
   *   Step 1: ERC20.approve(Permit2, max) — one-time per token
   *   Step 2: Permit2.approve(token, settler, amount, expiration) — grants
   *           the Settler contract permission to pull tokens via Permit2
   *   Step 3: Get fresh quote and send swap transaction
   */
  async swap(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    slippageBps?: number;
  }): Promise<SwapResult> {
    const taker = await this.getTakerAddress();

    // 1. Get initial quote to find the settler contract address
    let quote = await this.getQuote({ ...params, taker });

    if (!quote.liquidityAvailable) {
      throw new Error("Insufficient liquidity available for this swap");
    }

    const settlerAddress = quote.transaction.to;

    // 2. For ERC-20 sells, set up Permit2 allowances
    if (!isNativeToken(params.sellToken)) {
      // Step 2a: Ensure ERC20 token has approved Permit2 contract
      const erc20Allowance = await this.publicClient.readContract({
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

      // Step 2b: Ensure Permit2 has granted allowance to the Settler contract
      const [permit2Amount, permit2Expiration] = await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: permit2Abi,
        functionName: "allowance",
        args: [taker, params.sellToken, settlerAddress],
      });

      const now = Math.floor(Date.now() / 1000);
      if (permit2Amount < params.sellAmount || permit2Expiration <= now) {
        // Approve Settler on Permit2 with maxUint160 amount, 30 day expiration
        const expiration = now + 30 * 24 * 60 * 60;
        const permit2ApproveData = encodeFunctionData({
          abi: permit2Abi,
          functionName: "approve",
          args: [
            params.sellToken,
            settlerAddress,
            maxUint160,
            expiration,
          ],
        });

        const permit2Hash = await this.provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: taker,
            to: PERMIT2_ADDRESS,
            data: permit2ApproveData,
          }],
        });

        await this.waitForTx(permit2Hash);
      }
    }

    // 3. Get FRESH quote right before sending (old one may have expired)
    quote = await this.getQuote({ ...params, taker });

    // 4. Send swap transaction
    const tx = quote.transaction;
    const txHash: Hash = await this.provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: taker,
        to: tx.to,
        data: tx.data,
        gas: tx.gas > 0n ? `0x${tx.gas.toString(16)}` : undefined,
        gasPrice: tx.gasPrice > 0n ? `0x${tx.gasPrice.toString(16)}` : undefined,
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
